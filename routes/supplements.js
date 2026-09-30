const express = require('express');
const router = express.Router();
const { readUsers, writeUsers } = require('../utils/userStore');
const { generateText, isOpenAIConfigured, AIServiceError } = require('../utils/openaiClient');
const { requireLogin } = require('../utils/authMiddleware');

// 식약처 API 관련 모듈
const FoodSafetyAPI = require('../utils/foodSafetyAPI');
const { 
    filterProductsByAllCriteria, 
    filterProductsBySupplementName,
    filterProductsByNewOrder,  // 새로운 매칭 순서 함수 추가
    formatProductForFrontend 
} = require('../utils/healthKeywordMatcher');

// 서비스 이용 횟수 추적 모듈
const { incrementServiceUsage, SERVICE_TYPES } = require('../utils/serviceUsageTracker');

// AI 요청 큐 모듈
const aiRequestQueue = require('../utils/aiRequestQueue');

// AI 영양제 추천 API
router.post('/recommend', async (req, res) => {
    try {
        const { healthGoals, preferences, avoidIngredients, otherAllergy, currentMedications, reactionDetails, profile } = req.body;
        
        // API 키 확인
        if (!isOpenAIConfigured()) {
            return res.status(503).json({
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
        res.status(error.status || 500).json({
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
- 각 근거는 간결하고 명확하게 작성하세요.`;
    
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

// OpenAI 호출에 공통 요청 큐를 적용합니다.
async function sendPromptToOpenAI(prompt, metadata = {}) {
    const response = await aiRequestQueue.add(
        (signal) => generateText(prompt, { signal, timeout: 300000, json: true }),
        { type: "supplement-detail", ...metadata }
    );
    return response.text;
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
        
        // OpenAI API 호출
        const aiResponse = await sendPromptToOpenAI(prompt);
        
        // A malformed AI answer must not become a fabricated health recommendation.
        let recommendations;
        try {
            recommendations = JSON.parse(aiResponse.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim());
        } catch {
            throw new AIServiceError('AI 영양제 추천 응답을 해석하지 못했습니다. 다시 시도해주세요.', 'INVALID_AI_RESULT');
        }
        if (!recommendations || typeof recommendations !== 'object' ||
            !Array.isArray(recommendations.supplements)) {
            throw new AIServiceError('AI 영양제 추천 형식이 올바르지 않습니다.', 'INVALID_AI_RESULT');
        }

        // 필수 필드 확인 및 기본값 설정
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
        
        // 식약처 API에서 건강기능식품 데이터 조회 (영구 저장소 → 캐시 → API 순서)
        const apiResponse = await foodSafetyAPI.getAllHealthFunctionalFoods();
        
        if (!apiResponse || !apiResponse.C003) {
            console.log('❌ 데이터 조회 실패: 응답 없음 또는 형식 오류');
            return res.json({ 
                products: [], 
                matchCount: 0,
                totalCount: 0,
                message: '현재 정부승인 제품 정보를 불러올 수 없습니다.'
            });
        }

        const allProducts = apiResponse.C003.row || [];
        const dataSource = apiResponse.C003.source || 'unknown';
        console.log(`📊 데이터 소스: ${dataSource}, 전체 제품 수: ${allProducts.length}`);

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
        console.log(`✅ 정부승인 제품 조회 완료: ${formattedProducts.length}개 매칭 (전체 ${allProducts.length}개 중) - ${duration}초 소요`);

        res.json({
            products: formattedProducts,
            matchCount: formattedProducts.length,
            totalCount: allProducts.length,
            dataSource: dataSource, // 데이터 소스 정보 추가
            performance: {
                duration: `${duration}초`,
                source: dataSource
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
        
        // 식약처 API에서 건강기능식품 데이터 조회 (영구 저장소 → 캐시 → API 순서)
        const apiResponse = await foodSafetyAPI.getAllHealthFunctionalFoods();
        
        if (!apiResponse || !apiResponse.C003) {
            console.log('❌ 데이터 조회 실패: 응답 없음 또는 형식 오류');
            return res.json({ 
                products: [], 
                matchCount: 0,
                totalCount: 0,
                message: '현재 정부승인 제품 정보를 불러올 수 없습니다.'
            });
        }

        const allProducts = apiResponse.C003.row || [];
        const dataSource = apiResponse.C003.source || 'unknown';
        console.log(`📊 [영양제 검색] 데이터 소스: ${dataSource}, 전체 제품 수: ${allProducts.length}`);
        
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
        console.log(`✅ "${supplementName}" 검색 완료: ${formattedProducts.length}개 매칭 (전체 ${allProducts.length}개 중) - ${duration}초 소요`);

        res.json({
            products: formattedProducts,
            matchCount: formattedProducts.length,
            totalCount: allProducts.length,
            supplementName: supplementName,
            dataSource: dataSource, // 데이터 소스 정보 추가
            performance: {
                duration: `${duration}초`,
                source: dataSource
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
