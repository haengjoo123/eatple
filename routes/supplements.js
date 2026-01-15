const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { requireLogin } = require('../utils/authMiddleware');

// 식약처 API 관련 모듈
const FoodSafetyAPI = require('../utils/foodSafetyAPI');
const { 
    filterProductsByAllCriteria, 
    filterProductsBySupplementName,
    filterProductsByNewOrder,  // 새로운 매칭 순서 함수 추가
    formatProductForFrontend 
} = require('../utils/healthKeywordMatcher');

const USERS_FILE = path.join(__dirname, '../data/users.json');

// Gemini API 설정
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

function readUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(data);
}

function writeUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// 서비스 이용 횟수 추적 모듈
const { incrementServiceUsage, SERVICE_TYPES } = require('../utils/serviceUsageTracker');

// AI 영양제 추천 API
router.post('/recommend', async (req, res) => {
    try {
        const { healthGoals, preferences, avoidIngredients, otherAllergy, currentMedications, reactionDetails, profile } = req.body;
        
        // API 키 확인
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ 
                error: 'AI 서비스가 현재 이용 불가합니다. 나중에 다시 시도해주세요.' 
            });
        }
        
        // AI API 호출
        const recommendations = await generateAIRecommendations({
            healthGoals,
            preferences,
            avoidIngredients,
            otherAllergy,
            currentMedications,
            reactionDetails,
            profile
        });
        
        // 로그인한 사용자인 경우 서비스 이용 횟수 증가
        if (req.session && req.session.user) {
            incrementServiceUsage(req.session.user.id, SERVICE_TYPES.SUPPLEMENT_RECOMMENDATION);
        }
        
        res.json(recommendations);
    } catch (error) {
        console.error('영양제 추천 오류:', error.message);
        res.status(500).json({ 
            error: 'AI 영양제 추천 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.' 
        });
    }
});

// 개별 영양제 저장
router.post('/save-supplement', requireLogin, (req, res) => {
    try {
        const { supplement, recommendationId } = req.body;
        
        if (!supplement) {
            return res.status(400).json({ error: '저장할 영양제 정보가 없습니다.' });
        }
        
        const users = readUsers();
        const userIndex = users.findIndex(u => u.id === req.session.user.id);
        
        if (userIndex === -1) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }
        
        if (!users[userIndex].savedSupplements) {
            users[userIndex].savedSupplements = [];
        }
        
        // 중복 저장 방지
        const existingIndex = users[userIndex].savedSupplements.findIndex(
            saved => saved.name === supplement.name && saved.recommendationId === recommendationId
        );
        
        if (existingIndex !== -1) {
            return res.status(400).json({ error: '이미 저장된 영양제입니다.' });
        }
        
        const savedSupplement = {
            id: Date.now().toString(),
            name: supplement.name,
            category: supplement.category,
            dosage: supplement.dosage,
            timing: supplement.timing,
            benefits: supplement.benefits,
            scientificRationale: supplement.scientificRationale,
            priority: supplement.priority,
            safetyNotes: supplement.safetyNotes,
            interactions: supplement.interactions,
            expectedResults: supplement.expectedResults,
            recommendationId: recommendationId,
            savedAt: new Date().toISOString()
        };
        
        users[userIndex].savedSupplements.unshift(savedSupplement);
        
        // 최대 50개까지만 저장
        if (users[userIndex].savedSupplements.length > 50) {
            users[userIndex].savedSupplements = users[userIndex].savedSupplements.slice(0, 50);
        }
        
        writeUsers(users);
        res.json({ success: true, supplement: savedSupplement });
        
    } catch (error) {
        console.error('영양제 저장 오류:', error);
        res.status(500).json({ error: '저장 중 오류가 발생했습니다.' });
    }
});

// 저장된 영양제 목록 조회
router.get('/saved-supplements', requireLogin, (req, res) => {
    try {
        const users = readUsers();
        const user = users.find(u => u.id === req.session.user.id);
        
        if (!user || !user.savedSupplements) {
            return res.json([]);
        }
        
        res.json(user.savedSupplements);
        
    } catch (error) {
        console.error('저장된 영양제 조회 오류:', error);
        res.status(500).json({ error: '조회 중 오류가 발생했습니다.' });
    }
});

// 저장된 영양제 삭제
router.delete('/saved-supplements/:supplementId', requireLogin, (req, res) => {
    try {
        const users = readUsers();
        const userIndex = users.findIndex(u => u.id === req.session.user.id);
        
        if (userIndex === -1) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }
        
        if (!users[userIndex].savedSupplements) {
            return res.status(404).json({ error: '저장된 영양제가 없습니다.' });
        }
        
        const supplementIndex = users[userIndex].savedSupplements.findIndex(
            supplement => supplement.id === req.params.supplementId
        );
        
        if (supplementIndex === -1) {
            return res.status(404).json({ error: '저장된 영양제를 찾을 수 없습니다.' });
        }
        
        users[userIndex].savedSupplements.splice(supplementIndex, 1);
        writeUsers(users);
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('영양제 삭제 오류:', error);
        res.status(500).json({ error: '삭제 중 오류가 발생했습니다.' });
    }
});



function generateSupplementPrompt(data) {
    const { healthGoals, preferences, avoidIngredients, otherAllergy, currentMedications, reactionDetails, profile } = data;
    
    let prompt = `당신은 영양제 추천 전문가입니다. 다음 정보를 바탕으로 개인 맞춤 영양제를 추천해주세요.

**사용자 기본 정보:**
- 나이: ${profile?.age || '정보 없음'}세
- 성별: ${profile?.gender === 'male' ? '남성' : profile?.gender === 'female' ? '여성' : '정보 없음'}
- 키: ${profile?.height || '정보 없음'}cm
- 몸무게: ${profile?.weight || '정보 없음'}kg
- BMI: ${profile?.height && profile?.weight ? (profile.weight / Math.pow(profile.height/100, 2)).toFixed(1) : '정보 없음'}

**생활 습관:**
- 활동량: ${getActivityLevelKorean(profile?.activity_level)}
- 식사 패턴: ${getEatingPatternKorean(profile?.eating_patterns)}
- 수면 패턴: ${getSleepPatternKorean(profile?.sleep_patterns)}
- 하루 식사 횟수: ${profile?.meals_per_day || '정보 없음'}회
- 음주 여부: ${getAlcoholKorean(profile?.alcohol_consumption)}
- 흡연 여부: ${getSmokingKorean(profile?.smoking_status)}

**건강 상태:**
- 현재 질병: ${getIllnessesKorean(profile?.illnesses) || '없음'}
- 건강검진 수치: ${getBiomarkersKorean(profile?.biomarkers) || '정보 없음'}

**현재 복용 중인 건강기능식품:**
${getCurrentSupplementsKorean(profile?.supplements) || '없음'}

**건강 고민:**
${healthGoals?.map(goal => `- ${getGoalKoreanName(goal)}`).join('\n') || '정보 없음'}

**복용 선호도:**
- 선호 형태: ${getFormKoreanName(preferences?.supplement_form)}
- 채식 여부: ${getVegetarianKoreanName(preferences?.vegetarian)}
- 월 예산: ${getBudgetKoreanName(preferences?.budget)}

**기피 성분:**
- 피하고 싶은 성분: ${Array.isArray(avoidIngredients) ? avoidIngredients.filter(a => a !== 'none').join(', ') : avoidIngredients || '없음'}
${otherAllergy ? `- 기타 기피 성분: ${otherAllergy}` : ''}

**주의사항:**
- 임신/수유 상태: ${getPregnancyKoreanName(preferences?.pregnancy_status)}
- 현재 복용 약물: ${currentMedications || '없음'}
- 소화 관련 문제: ${getDigestiveKoreanName(preferences?.digestive_issues)}
- 과거 부작용 경험: ${reactionDetails || '없음'}

**요청사항:**
당신은 임상 영양학 전문가이자 개인 맞춤 영양 컨설턴트입니다. 다음 전문적 가이드라인을 준수하여 개인 맞춤 영양제를 추천해주세요:

1. **종합적 건강 평가**: 제공된 모든 생체지표, 생활습관, 건강 상태를 통합 분석하여 개인의 영양 상태를 평가하세요.

2. **영양소 상호작용 분석**: 현재 복용 중인 건강기능식품과의 시너지 효과 및 길항 작용을 고려하여 중복 방지 및 흡수율 최적화를 달성하세요.

3. **생리학적 맞춤 설계**: 연령, 성별, BMI, 활동량에 따른 기초대사율과 영양소 요구량을 계산하여 개인화된 용량을 제시하세요.

4. **질병 예방 및 관리**: 기존 질환의 진행 억제와 동시에 건강검진 수치 개선을 위한 타겟 영양소를 우선순위화하여 추천하세요.

5. **생활 패턴 최적화**: 식사 시간, 수면 주기, 운동 루틴과 연계하여 영양소 흡수율을 극대화하는 복용 타이밍을 제시하세요.

6. **안전성 프로토콜**: 임신/수유, 약물 상호작용, 알레르기 반응 등 모든 금기사항을 고려한 안전한 복용 가이드라인을 제시하세요.

7. **근거 기반 추천**: 각 영양제의 추천 근거를 생리학적 메커니즘과 임상 연구 결과를 바탕으로 설명하세요.

8. **개인화 우선순위**: 건강 고민 해결을 위한 영양제의 중요도를 과학적으로 평가하여 3단계(필수/권장/선택)로 분류하세요.

**응답 형식:** 반드시 아래와 같은 JSON 형식으로만 응답해주세요. 다른 텍스트는 포함하지 마세요.

\`\`\`json
{
  "supplements": [
    {
      "name": "영양제명",
      "category": "비타민|미네랄|오메가|프로바이오틱스|허브|기타",
      "dosage": "용량 (단위 포함)",
      "timing": {
        "when": "아침|점심|저녁|식전|식후|공복|취침전",
        "frequency": "1일 1회|1일 2회|1일 3회|주 3회",
        "duration": "1개월|2개월|3개월|지속 복용"
      },
      "benefits": [
        "주요 효능 1",
        "주요 효능 2",
        "주요 효능 3"
      ],
      "scientificRationale": [
        "생리학적 메커니즘 설명 1",
        "생리학적 메커니즘 설명 2",
        "생리학적 메커니즘 설명 3"
      ],
      "priority": "essential|recommended|optional",
      "safetyNotes": "일반적 주의사항 및 과도한 복용 시 주의사항 (있는 경우, 없으면 없음)",
      "interactions": "상호작용 정보 (있는 경우, 없으면 없음)",
      "expectedResults": "예상 효과 발현 시기 및 정도"
    }
  ],
  "lifestyleIntegration": {
    "dailyRoutine": "일상 루틴 통합 가이드 (구조화된 형식으로 작성: 1. **규칙적인 식사**: 하루 1회 식사는..., 2. **적정한 수면**: 주 3회 이상의..., 3. **음주량 감소**: 음주 빈도를... 등)",
    "mealPlanning": "식사와 연계한 복용 계획 (구조화된 형식으로 작성: 1. **아침**: (프로바이오틱스 공복 복용) 간단한 하루와..., 2. **점심**: 현재 유일한 식사와..., 3. **저녁**: (가능하다면) 가벼운 식사 추가 시도..., 4. **마그네슘**: 저녁 식후 또는 취침 전 복용하여 수면 질 개선 등)",
    "monitoringTips": "효과 모니터링 방법 (구조화된 형식으로 작성: 1. **신체 증상 변화**: 피로도, 소화 불편감..., 2. **주요 건강 지표**: 3-6개월 후 병원에서..., 3. **부작용 발견 여부**: 새로운 불편감이나..., 4. **관절/근력 개선**: 당뇨 관리 수치(혈당)를 다시 확인 등)"
  },
  "safetyProtocol": {
    "generalPrecautions": [
      "일반적 주의사항 1",
      "일반적 주의사항 2"
    ],
    "emergencySignals": "즉시 복용 중단해야 할 증상들"
  }
}
\`\`\`

위 JSON 구조를 정확히 따라서 전문적이고 개인화된 영양제 추천을 제공해주세요.

**중요한 지침:**
- scientificRationale은 반드시 항목별로 제공하세요.
- 각 근거는 간결하고 명확하게 작성하세요.
- lifestyleIntegration의 각 항목(dailyRoutine, mealPlanning, monitoringTips)은 반드시 구조화된 형식으로 작성하세요:
  * 형식: "1. **주제**: 설명. 2. **주제**: 설명. 3. **주제**: 설명."
  * **주제** 부분은 반드시 **별표 2개**로 감싸서 볼드 처리되도록 작성
  * 각 항목은 번호와 함께 명확하게 구분
  * 사용자의 실제 상황(식사 패턴, 수면, 활동량 등)에 맞춰 구체적으로 작성
- 줄글 형태가 아닌 번호가 있는 구조화된 리스트 형식으로 작성하여 가독성을 높이세요.`;
    
    return prompt;
}

function getGoalKoreanName(goal) {
    const goalMap = {
        // 신경계
        'cognitive_memory': '인지기능/기억력',
        'tension_stress': '긴장',
        'sleep_quality': '수면의 질',
        'fatigue': '피로',
        
        // 감각계
        'dental': '치아',
        'eye': '눈',
        'skin': '피부',
        
        // 소화 대사계
        'liver': '간',
        'stomach': '위',
        'intestine': '장',
        'body_fat': '체지방',
        'calcium_absorption': '칼슘흡수',
        
        // 내분비계
        'blood_glucose': '혈당',
        'menopause_women': '갱년기 여성',
        'menopause_men': '갱년기 남성',
        'premenstrual': '월경 전 불편한 상태',
        
        // 심혈관계
        'triglycerides': '혈중 중성지방',
        'cholesterol': '콜레스테롤',
        'blood_pressure': '혈압',
        'blood_circulation': '혈행',
        
        // 신체방어 및 면역계
        'immunity': '면역',
        'antioxidant': '항산화',
        
        // 근육계
        'joint': '관절',
        'bone': '뼈',
        'muscle_strength': '근력',
        'exercise_performance': '운동수행능력',
        
        // 생식&비뇨계
        'prostate': '전립선',
        'urination': '배뇨',
        'urinary_tract': '요로'
    };
    return goalMap[goal] || goal;
}

function getFormKoreanName(form) {
    const formMap = {
        'tablet': '정제',
        'capsule': '캡슐',
        'liquid': '액상',
        'gummy': '구미',
        'any': '무관'
    };
    return formMap[form] || form;
}

function getVegetarianKoreanName(vegetarian) {
    const vegetarianMap = {
        'vegetarian': '채식주의',
        'vegan': '비건',
        'none': '무관'
    };
    return vegetarianMap[vegetarian] || vegetarian;
}

function getBudgetKoreanName(budget) {
    const budgetMap = {
        'under_10000': '1만원 미만',
        '10000_30000': '1-3만원',
        '30000_50000': '3-5만원',
        'over_50000': '5만원 이상'
    };
    return budgetMap[budget] || budget;
}

function getPregnancyKoreanName(pregnancy) {
    const pregnancyMap = {
        'pregnant': '임신중',
        'breastfeeding': '수유중',
        'planning': '계획중',
        'no': '해당없음'
    };
    return pregnancyMap[pregnancy] || pregnancy;
}

function getDigestiveKoreanName(digestive) {
    const digestiveMap = {
        'heartburn': '속쓰림, 위산 역류',
        'difficulty_swallowing': '알약 삼키기 어려움',
        'none': '없음'
    };
    return digestiveMap[digestive] || digestive;
}

function getActivityLevelKorean(level) {
    const levelMap = {
        'sedentary': '좌식 생활 (운동 거의 안함)',
        'light': '가벼운 활동 (주 1-3회 운동)',
        'moderate': '보통 활동 (주 3-5회 운동)',
        'active': '활발한 활동 (주 6-7회 운동)',
        'very_active': '매우 활발함 (하루 2회 이상 운동)'
    };
    return levelMap[level] || level || '정보 없음';
}

function getEatingPatternKorean(pattern) {
    const patternMap = {
        'regular': '규칙적 (정해진 시간에 식사)',
        'irregular': '불규칙적',
        'intermittent_fasting': '간헐적 단식'
    };
    return patternMap[pattern] || pattern || '정보 없음';
}

function getSleepPatternKorean(pattern) {
    const patternMap = {
        'less_than_6': '6시간 미만',
        '6_to_8': '6-8시간',
        'more_than_8': '8시간 이상'
    };
    return patternMap[pattern] || pattern || '정보 없음';
}

function getAlcoholKorean(alcohol) {
    const alcoholMap = {
        'none': '없음',
        'socially': '사회적 음주 (월 1~2회)',
        'weekly_light': '주 1회 가볍게 (1병 이내)',
        'weekly_moderate': '주 1~2회 적당히 (1병 이상)',
        'frequent': '잦은 음주 (주 3회 이상)'
    };
    return alcoholMap[alcohol] || alcohol || '정보 없음';
}

function getSmokingKorean(smoking) {
    const smokingMap = {
        'smoker': '흡연',
        'non_smoker': '비흡연'
    };
    return smokingMap[smoking] || smoking || '정보 없음';
}

function getIllnessesKorean(illnesses) {
    if (!illnesses || illnesses.length === 0) return '없음';
    
    const illnessMap = {
        'none': '없음',
        'diabetes': '당뇨병',
        'hypertension': '고혈압',
        'heart_disease': '심장병',
        'kidney_disease': '신장병',
        'liver_disease': '간 질환',
        'osteoporosis': '골다공증',
        'anemia': '빈혈',
        'thyroid_disorder': '갑상선 질환',
        'gastritis': '위염',
        'ibs': '과민성 대장 증후군'
    };
    
    if (Array.isArray(illnesses)) {
        return illnesses.map(illness => illnessMap[illness] || illness).join(', ');
    }
    return illnessMap[illnesses] || illnesses;
}

function getBiomarkersKorean(biomarkers) {
    if (!biomarkers || biomarkers.length === 0) return '정보 없음';
    
    const biomarkerMap = {
        'blood_glucose': '혈당',
        'hba1c': '당화혈색소',
        'total_cholesterol': '총 콜레스테롤',
        'ldl_cholesterol': 'LDL 콜레스테롤',
        'hdl_cholesterol': 'HDL 콜레스테롤',
        'triglycerides': '중성지방',
        'blood_pressure_systolic': '수축기 혈압',
        'blood_pressure_diastolic': '이완기 혈압',
        'bmi': 'BMI'
    };
    
    if (Array.isArray(biomarkers)) {
        return biomarkers.map(marker => {
            if (typeof marker === 'object' && marker.type) {
                return `${biomarkerMap[marker.type] || marker.type}: ${marker.value}`;
            }
            return biomarkerMap[marker] || marker;
        }).join(', ');
    }
    return biomarkerMap[biomarkers] || biomarkers;
}

function getCurrentSupplementsKorean(supplements) {
    if (!supplements || supplements.length === 0) return '없음';
    
    const supplementMap = {
        'vitamin_a': '비타민 A',
        'vitamin_d': '비타민 D',
        'vitamin_e': '비타민 E',
        'vitamin_k': '비타민 K',
        'iron': '철분',
        'calcium': '칼슘',
        'magnesium': '마그네슘',
        'potassium': '칼륨',
        'zinc': '아연'
    };
    
    if (Array.isArray(supplements)) {
        return supplements.map(supplement => {
            if (typeof supplement === 'object' && supplement.type) {
                return `${supplementMap[supplement.type] || supplement.type}: ${supplement.value}`;
            }
            return supplementMap[supplement] || supplement;
        }).join(', ');
    }
    return supplementMap[supplements] || supplements;
}

// 기본 영양제 추천 함수 (백업용)
function generateBasicSupplementRecommendations(data) {
    const { healthGoals, profile } = data;
    const supplements = [];
    
    // 기본 건강 관리 영양소
    supplements.push({
        name: "멀티비타민",
        category: "비타민",
        dosage: "1정",
        timing: {
            when: "식후",
            frequency: "1일 1회",
            duration: "지속 복용"
        },
        benefits: [
            "전반적인 건강 유지",
            "면역력 강화",
            "피로 개선"
        ],
        scientificRationale: [
            "현대인의 불규칙한 식습관으로 인한 기본 영양소 부족을 보충합니다.",
            "다양한 비타민과 미네랄의 시너지 효과로 전반적인 건강을 증진시킵니다.",
            "식품으로만 섭취하기 어려운 영양소들을 효율적으로 보충할 수 있습니다."
        ],
        priority: "essential",
        safetyNotes: null,
        interactions: null,
        expectedResults: "1개월 이내 피로감 개선, 2개월 이내 전반적인 컨디션 향상"
    });
    
    // 건강 고민별 추천
    if (healthGoals) {
        // 면역력 관련
        if (healthGoals.includes('immunity')) {
            supplements.push({
                name: "비타민 C",
                category: "비타민",
                dosage: "1000mg",
                timing: {
                    when: "식후",
                    frequency: "1일 1회",
                    duration: "지속 복용"
                },
                benefits: [
                    "면역력 강화",
                    "항산화 작용",
                    "콜라겐 생성"
                ],
                scientificRationale: [
                    "면역세포 기능 향상과 감염 예방에 도움을 줍니다.",
                    "항산화 작용으로 자유라디칼을 제거하여 세포 손상을 방지합니다.",
                    "콜라겐 합성을 촉진하여 피부와 혈관 건강을 개선합니다."
                ],
                priority: "essential",
                safetyNotes: null,
                interactions: null,
                expectedResults: "2-3주 이내 감염 저항성 향상"
            });
        }
        
        // 피로 관련
        if (healthGoals.includes('fatigue')) {
            supplements.push({
                name: "비타민 B 복합체",
                category: "비타민",
                dosage: "1캡슐",
                timing: {
                    when: "아침",
                    frequency: "1일 1회",
                    duration: "지속 복용"
                },
                benefits: [
                    "에너지 생성",
                    "피로 회복",
                    "신경 기능 개선"
                ],
                scientificRationale: [
                    "에너지 대사 과정에서 필수 코엔자임으로 작용합니다.",
                    "탄수화물, 지방, 단백질 대사를 촉진하여 에너지 생성을 돕습니다.",
                    "신경 전달물질 합성에 관여하여 피로 회복과 집중력 향상에 기여합니다."
                ],
                priority: "essential",
                safetyNotes: null,
                interactions: null,
                expectedResults: "1-2주 이내 피로감 개선"
            });
        }
        
        // 뼈 건강 관련
        if (healthGoals.includes('bone')) {
            supplements.push({
                name: "칼슘+비타민D",
                category: "미네랄",
                dosage: "칼슘 500mg + 비타민D 400IU",
                timing: {
                    when: "식후",
                    frequency: "1일 1회",
                    duration: "지속 복용"
                },
                benefits: [
                    "뼈 건강 유지",
                    "골밀도 개선",
                    "칼슘 흡수 증진"
                ],
                scientificRationale: [
                    "뼈 형성과 칼슘 흡수에 필수적인 영양소입니다.",
                    "비타민D는 칼슘의 장 흡수를 촉진하여 골밀도 증가에 기여합니다.",
                    "골다공증 예방과 근육 기능 개선에 효과적입니다."
                ],
                priority: "essential",
                safetyNotes: null,
                interactions: null,
                expectedResults: "3-6개월 이내 골밀도 개선"
            });
        }
        
        // 눈 건강 관련
        if (healthGoals.includes('eye')) {
            supplements.push({
                name: "루테인",
                category: "기타",
                dosage: "20mg",
                timing: {
                    when: "식후",
                    frequency: "1일 1회",
                    duration: "지속 복용"
                },
                benefits: [
                    "눈 피로 개선",
                    "시력 보호",
                    "황반 건강"
                ],
                scientificRationale: [
                    "황반부 보호와 블루라이트 차단에 도움을 줍니다.",
                    "항산화 작용으로 망막 세포 손상을 방지합니다.",
                    "나이 관련 황반변성 예방에 효과적입니다."
                ],
                priority: "recommended",
                safetyNotes: null,
                interactions: null,
                expectedResults: "4-6주 이내 눈 피로감 개선"
            });
        }
        
        // 심혈관 건강 관련
        if (healthGoals.includes('cholesterol') || healthGoals.includes('blood_pressure')) {
            supplements.push({
                name: "오메가-3",
                category: "오메가",
                dosage: "1000mg",
                timing: {
                    when: "식후",
                    frequency: "1일 1회",
                    duration: "지속 복용"
                },
                benefits: [
                    "심혈관 건강",
                    "콜레스테롤 개선",
                    "혈압 조절"
                ],
                scientificRationale: [
                    "혈관 건강과 염증 감소에 도움을 줍니다.",
                    "오메가-3 지방산이 혈중 중성지방을 감소시킵니다.",
                    "심혈관 질환 위험 감소와 혈압 조절에 기여합니다."
                ],
                priority: "essential",
                safetyNotes: null,
                interactions: null,
                expectedResults: "2-3개월 이내 혈관 건강 개선"
            });
        }
    }
    
    // 최대 6개로 제한
    return supplements.slice(0, 6);
}

// Gemini API 호출 함수
async function sendPromptToGemini(prompt) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 302000); // 302초 타임아웃

    try {
        const response = await axios.post(
            GEMINI_API_URL,
            {
                contents: [{ parts: [{ text: prompt }] }]
            },
            {
                headers: { "Content-Type": "application/json" },
                timeout: 300000,
                signal: controller.signal
            }
        );
        
        clearTimeout(timeoutId);
        
        if (!response.data) {
            throw new Error("Gemini API 응답이 비어있습니다.");
        }

        let responseText = '';
        if (response.data.candidates && response.data.candidates.length > 0) {
            const candidate = response.data.candidates[0];
            
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                const part = candidate.content.parts[0];
                
                if (part.text) {
                    responseText = part.text;
                } else {
                    throw new Error('part.text가 없습니다.');
                }
            } else {
                throw new Error('content.parts가 없거나 비어있습니다.');
            }
        } else {
            throw new Error('candidates가 없거나 비어있습니다.');
        }

        if (responseText) {
            return responseText;
        } else {
            if (response.data.promptFeedback && response.data.promptFeedback.blockReason) {
                throw new Error(`영양제 추천 요청이 거부되었습니다. 이유: ${response.data.promptFeedback.blockReason}`);
            }
            throw new Error("응답 형식이 올바르지 않거나 내용이 비어있습니다.");
        }
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.response) {
            console.error('Gemini API HTTP 오류:', error.response.status, error.response.data);
        }
        
        if (error.name === 'AbortError') {
            throw new Error('요청 시간이 초과되었습니다.');
        }
        
        throw error;
    }
}

// AI 영양제 추천 생성 함수
async function generateAIRecommendations(data) {
    const { healthGoals, preferences, avoidIngredients, otherAllergy, currentMedications, reactionDetails, profile } = data;
    
    try {
        // AI 프롬프트 생성
        const prompt = generateSupplementPrompt({
            healthGoals,
            preferences,
            avoidIngredients,
            otherAllergy,
            currentMedications,
            reactionDetails,
            profile
        });
        
        // Gemini API 호출
        const aiResponse = await sendPromptToGemini(prompt);
        
        // JSON 응답 파싱
        let recommendations;
        try {
            console.log('AI 응답 원문:', aiResponse);
            
            // 여러 방법으로 JSON 파싱 시도
            let jsonString = '';
            
            // 1. 코드 블록 추출 시도
            const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                jsonString = jsonMatch[1].trim();
                console.log('JSON 코드 블록 추출됨:', jsonString);
            } else {
                // 2. 백틱 제거 후 시도
                jsonString = aiResponse.replace(/```json|```/g, '').trim();
                console.log('백틱 제거 후:', jsonString);
            }
            
            // 3. 중괄호 사이의 내용 추출 시도
            if (!jsonString || jsonString.length === 0) {
                const braceMatch = aiResponse.match(/\{[\s\S]*\}/);
                if (braceMatch) {
                    jsonString = braceMatch[0];
                    console.log('중괄호 내용 추출됨:', jsonString);
                }
            }
            
            // 4. 여전히 없으면 전체 응답 사용
            if (!jsonString || jsonString.length === 0) {
                jsonString = aiResponse;
                console.log('전체 응답 사용:', jsonString);
            }
            
            // JSON 파싱 시도
            recommendations = JSON.parse(jsonString);
            console.log('JSON 파싱 성공');
            
        } catch (parseError) {
            console.error('JSON 파싱 오류:', parseError.message);
            console.error('파싱 실패한 응답:', aiResponse);
            
            // 백업 응답 생성
            console.log('백업 응답 생성 중...');
            recommendations = {
                personalizedAnalysis: {
                    healthProfile: "개인 정보를 바탕으로 맞춤형 영양제를 추천하고 있습니다.",
                    nutritionalGaps: "선택하신 건강 고민을 해결하기 위한 영양소 분석을 진행했습니다.",
                    recommendationStrategy: "안전하고 효과적인 영양제 조합을 제안합니다."
                },
                supplements: generateBasicSupplementRecommendations(data),
                lifestyleIntegration: {
                    dailyRoutine: "규칙적인 시간에 영양제를 복용하시기 바랍니다.",
                    mealPlanning: "식후 30분 이내에 복용하시는 것을 권장합니다.",
                    monitoringTips: "복용 후 몸의 변화를 주의 깊게 관찰하시기 바랍니다."
                },
                safetyProtocol: {
                    generalPrecautions: [
                        "권장량을 초과하여 복용하지 마세요",
                        "다른 약물과 함께 복용 시 의사와 상담하세요"
                    ],
                    medicalConsultation: "기존 질환이 있거나 약물 복용 중인 경우 의사와 상담하세요",
                    emergencySignals: "알레르기 반응, 심한 복통, 호흡곤란 등의 증상이 나타날 경우 즉시 복용을 중단하고 의료진에게 연락하세요"
                }
            };
        }
        
        // 응답 검증
        if (!recommendations || typeof recommendations !== 'object') {
            console.error('AI 응답 형식이 올바르지 않습니다:', typeof recommendations);
            throw new Error('AI 응답 형식이 올바르지 않습니다.');
        }
        
        // 필수 필드 확인 및 기본값 설정
        if (!recommendations.supplements) {
            console.log('supplements 필드 없음, 빈 배열로 초기화');
            recommendations.supplements = [];
        }
        if (!recommendations.summary) {
            console.log('summary 필드 없음, 기본값으로 초기화');
            recommendations.summary = '개인 맞춤 영양제 추천 결과입니다.';
        }
        if (!recommendations.warnings) {
            console.log('warnings 필드 없음, 빈 배열로 초기화');
            recommendations.warnings = [];
        }
        
        return recommendations;
        
    } catch (error) {
        console.error('AI 영양제 추천 생성 오류:', error.message);
        throw error;
    }
}

// 식약처 승인 건강기능식품 추천 API
router.post('/government-approved-products', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { healthGoals, dosagePreference, requiredIngredients, avoidIngredients } = req.body;
        
        console.log('정부승인 제품 조회 요청:', {
            healthGoals,
            dosagePreference,
            requiredIngredients,
            avoidIngredients
        });

        // 식약처 API 인스턴스 생성
        const foodSafetyAPI = new FoodSafetyAPI();
        
        // 캐시 상태 확인
        const cacheStatus = foodSafetyAPI.getCacheStatus();
        
        // 식약처 API에서 건강기능식품 데이터 조회 (전체 데이터)
        const apiResponse = await foodSafetyAPI.getAllHealthFunctionalFoods();
        
        if (!apiResponse || !apiResponse.C003) {
            console.log('식약처 API 응답 없음 또는 형식 오류');
            return res.json({ 
                products: [], 
                matchCount: 0,
                totalCount: 0,
                message: '현재 정부승인 제품 정보를 불러올 수 없습니다.'
            });
        }

        const allProducts = apiResponse.C003.row || [];

        // 새로운 매칭 순서로 제품 필터링 (건강고민 → 복용선호 → 기피성분 → 유사도 매칭)
        const filteredProducts = filterProductsByNewOrder(
            allProducts,
            healthGoals,
            dosagePreference,
            avoidIngredients || [],
            null, // 영양제 명칭은 없으므로 null
            {
                similarityThreshold: 0.6,
                maxResults: 500 // 더 많은 결과를 반환하도록 증가
            }
        );

        // 프론트엔드용 데이터 포맷팅 (건강고민 정보 포함)
        const formattedProducts = filteredProducts.map(product => 
            formatProductForFrontend(product, healthGoals)
        );

        // 로그인한 사용자인 경우 서비스 이용 횟수 증가 (선택사항)
        if (req.session && req.session.user) {
            incrementServiceUsage(req.session.user.id, SERVICE_TYPES.SUPPLEMENT_RECOMMENDATION);
        }

        // 성능 로깅 (간단하게)
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        console.log(`✅ 정부승인 제품 조회 완료: ${formattedProducts.length}개 (${duration}초)`);

        res.json({
            products: formattedProducts,
            matchCount: formattedProducts.length,
            totalCount: allProducts.length,
            performance: {
                duration: `${duration}초`,
                cacheUsed: !cacheStatus.expired && cacheStatus.exists
            },
            filterCriteria: {
                healthGoals: healthGoals || [],
                dosagePreference: dosagePreference || null
            },
            message: formattedProducts.length > 0 
                ? `${formattedProducts.length}개의 정부승인 제품을 찾았습니다.`
                : '조건에 맞는 정부승인 제품이 없습니다.'
        });

    } catch (error) {
        console.error('정부승인 제품 조회 실패:', error);
        res.status(500).json({ 
            error: '정부승인 제품 정보를 불러오는 중 오류가 발생했습니다.',
            products: [],
            matchCount: 0,
            totalCount: 0
        });
    }
});

// 특정 정부승인 제품 상세 정보 조회
router.get('/government-approved-products/:reportNo', async (req, res) => {
    try {
        const { reportNo } = req.params;
        
        const foodSafetyAPI = new FoodSafetyAPI();
        const product = await foodSafetyAPI.getProductDetail(reportNo);
        
        if (!product) {
            return res.status(404).json({ 
                error: '해당 제품을 찾을 수 없습니다.' 
            });
        }

        const formattedProduct = formatProductForFrontend(product, []);
        res.json({ product: formattedProduct });

    } catch (error) {
        console.error('제품 상세 정보 조회 실패:', error);
        res.status(500).json({ 
            error: '제품 상세 정보를 불러오는 중 오류가 발생했습니다.' 
        });
    }
});

// 캐시 상태 확인 API
router.get('/cache-status', async (req, res) => {
    try {
        const foodSafetyAPI = new FoodSafetyAPI();
        const cacheStatus = foodSafetyAPI.getCacheStatus();
        
        res.json({
            cache: cacheStatus,
            message: cacheStatus.exists 
                ? `캐시 존재: ${cacheStatus.count}개 제품, ${cacheStatus.age.toFixed(1)}시간 전 생성${cacheStatus.expired ? ' (만료됨)' : ''}`
                : '캐시 없음'
        });
    } catch (error) {
        console.error('캐시 상태 확인 실패:', error);
        res.status(500).json({ error: '캐시 상태 확인 중 오류가 발생했습니다.' });
    }
});

// 캐시 삭제 API
router.delete('/cache', async (req, res) => {
    try {
        const foodSafetyAPI = new FoodSafetyAPI();
        const success = foodSafetyAPI.clearCache();
        
        res.json({
            success: success,
            message: success ? '캐시가 삭제되었습니다.' : '삭제할 캐시가 없습니다.'
        });
    } catch (error) {
        console.error('캐시 삭제 실패:', error);
        res.status(500).json({ error: '캐시 삭제 중 오류가 발생했습니다.' });
    }
});

// 캐시 강제 새로고침 API
router.post('/refresh-cache', async (req, res) => {
    try {
        console.log('캐시 강제 새로고침 시작...');
        const startTime = Date.now();
        
        const foodSafetyAPI = new FoodSafetyAPI();
        const data = await foodSafetyAPI.getAllHealthFunctionalFoods(42000, true); // 강제 새로고침
        
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(1);
        
        if (data && data.C003) {
            res.json({
                success: true,
                count: data.C003.row ? data.C003.row.length : 0,
                totalCount: data.C003.total_count || 0,
                duration: `${duration}초`,
                message: `캐시가 새로고침되었습니다. ${data.C003.row ? data.C003.row.length : 0}개 제품 로드`
            });
        } else {
            res.status(500).json({
                success: false,
                error: '데이터 로드 실패',
                duration: `${duration}초`
            });
        }
    } catch (error) {
        console.error('캐시 새로고침 실패:', error);
        res.status(500).json({ 
            success: false,
            error: '캐시 새로고침 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// 특정 영양제 명칭으로 정부승인 제품 검색
router.post('/search-by-supplement-name', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { supplementName, healthGoals, dosagePreference, avoidIngredients } = req.body;
        
        if (!supplementName) {
            return res.status(400).json({ 
                error: '영양제 명칭이 필요합니다.' 
            });
        }
        
        // 식약처 API 인스턴스 생성
        const foodSafetyAPI = new FoodSafetyAPI();
        
        // 식약처 API에서 건강기능식품 데이터 조회 (전체 데이터)
        const apiResponse = await foodSafetyAPI.getAllHealthFunctionalFoods();
        
        if (!apiResponse || !apiResponse.C003) {
            console.log('식약처 API 응답 없음 또는 형식 오류');
            return res.json({ 
                products: [], 
                matchCount: 0,
                totalCount: 0,
                message: '현재 정부승인 제품 정보를 불러올 수 없습니다.'
            });
        }

        const allProducts = apiResponse.C003.row || [];
        
        // 새로운 매칭 순서로 제품 필터링 (건강고민 → 복용선호 → 기피성분 → 유사도 매칭)
        const filteredProducts = filterProductsByNewOrder(
            allProducts,
            healthGoals,
            dosagePreference,
            avoidIngredients || [],
            supplementName, // 영양제 명칭을 마지막 단계에서 유사도 매칭
            {
                similarityThreshold: 0.6,
                maxResults: 500, // 더 많은 결과를 반환하도록 증가
                useExactMatch: true,
                useSimilarityMatch: true
            }
        );

        // 프론트엔드용 데이터 포맷팅 (건강고민 정보 포함)
        const formattedProducts = filteredProducts.map(product => 
            formatProductForFrontend(product, healthGoals || [])
        );

        // 로그인한 사용자인 경우 서비스 이용 횟수 증가 (선택사항)
        if (req.session && req.session.user) {
            incrementServiceUsage(req.session.user.id, SERVICE_TYPES.SUPPLEMENT_RECOMMENDATION);
        }

        // 성능 로깅 (간단하게)
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        console.log(`✅ "${supplementName}" 검색 완료: ${formattedProducts.length}개 제품 (${duration}초)`);

        res.json({
            products: formattedProducts,
            matchCount: formattedProducts.length,
            totalCount: allProducts.length,
            supplementName: supplementName,
            performance: {
                duration: `${duration}초`
            },
            filterCriteria: {
                healthGoals: healthGoals || [],
                dosagePreference: dosagePreference || null,
                avoidIngredients: avoidIngredients || []
            },
            message: formattedProducts.length > 0 
                ? `"${supplementName}"에 대한 ${formattedProducts.length}개의 정부승인 제품을 찾았습니다.`
                : `"${supplementName}"에 해당하는 정부승인 제품이 없습니다.`
        });

    } catch (error) {
        console.error('영양제 명칭 검색 실패:', error);
        res.status(500).json({ 
            error: '영양제 검색 중 오류가 발생했습니다.',
            products: [],
            matchCount: 0,
            totalCount: 0
        });
    }
});

module.exports = router; 