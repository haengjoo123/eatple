// AI 식재료 분석 페이지 JavaScript

// 전역 변수
let currentSearch = '';

// 한영 변환 매핑 테이블
const koreanToEnglishMap = {
    'ㅁ': 'a', 'ㅠ': 'b', 'ㅊ': 'c', 'ㅇ': 'd', 'ㄷ': 'e', 'ㄹ': 'f', 'ㅎ': 'g', 'ㅗ': 'h', 'ㅑ': 'i', 'ㅓ': 'j',
    'ㅏ': 'k', 'ㅣ': 'l', 'ㅡ': 'm', 'ㅜ': 'n', 'ㅐ': 'o', 'ㅔ': 'p', 'ㅂ': 'q', 'ㄱ': 'r', 'ㄴ': 's', 'ㅅ': 't',
    'ㅕ': 'u', 'ㅍ': 'v', 'ㅈ': 'w', 'ㅌ': 'x', 'ㅛ': 'y', 'ㅋ': 'z',
    'ㅒ': 'O', 'ㅖ': 'P', 'ㅃ': 'Q', 'ㄲ': 'R', 'ㄸ': 'E', 'ㅆ': 'T', 'ㅉ': 'W', 'ㅚ': 'o', 'ㅟ': 'p', 'ㅢ': 'ml'
};

const englishToKoreanMap = {
    'a': 'ㅁ', 'b': 'ㅠ', 'c': 'ㅊ', 'd': 'ㅇ', 'e': 'ㄷ', 'f': 'ㄹ', 'g': 'ㅎ', 'h': 'ㅗ', 'i': 'ㅑ', 'j': 'ㅓ',
    'k': 'ㅏ', 'l': 'ㅣ', 'm': 'ㅡ', 'n': 'ㅜ', 'o': 'ㅐ', 'p': 'ㅔ', 'q': 'ㅂ', 'r': 'ㄱ', 's': 'ㄴ', 't': 'ㅅ',
    'u': 'ㅕ', 'v': 'ㅍ', 'w': 'ㅈ', 'x': 'ㅌ', 'y': 'ㅛ', 'z': 'ㅋ',
    'O': 'ㅒ', 'P': 'ㅖ', 'Q': 'ㅃ', 'R': 'ㄲ', 'E': 'ㄸ', 'T': 'ㅆ', 'W': 'ㅉ'
};

// 일반적인 식재료 한영 변환 사전
const ingredientTranslationMap = {
    // 한글 -> 영어
    '마늘': 'garlic',
    '양파': 'onion',
    '브로콜리': 'broccoli',
    '시금치': 'spinach',
    '당근': 'carrot',
    '토마토': 'tomato',
    '오이': 'cucumber',
    '상추': 'lettuce',
    '양배추': 'cabbage',
    '배추': 'napa cabbage',
    '고추': 'pepper',
    '파프리카': 'paprika',
    '가지': 'eggplant',
    '버섯': 'mushroom',
    '감자': 'potato',
    '고구마': 'sweet potato',
    '무': 'radish',
    '사과': 'apple',
    '바나나': 'banana',
    '오렌지': 'orange',
    '블루베리': 'blueberry',
    '딸기': 'strawberry',
    '포도': 'grape',
    '키위': 'kiwi',
    '망고': 'mango',
    '파인애플': 'pineapple',
    '레몬': 'lemon',
    '연어': 'salmon',
    '고등어': 'mackerel',
    '참치': 'tuna',
    '닭가슴살': 'chicken breast',
    '소고기': 'beef',
    '돼지고기': 'pork',
    '계란': 'egg',
    '우유': 'milk',
    '치즈': 'cheese',
    '요거트': 'yogurt',
    '현미': 'brown rice',
    '백미': 'white rice',
    '퀴노아': 'quinoa',
    '오트밀': 'oatmeal',
    '아몬드': 'almond',
    '호두': 'walnut',
    '땅콩': 'peanut',
    '올리브오일': 'olive oil',
    '코코넛오일': 'coconut oil',
    '생강': 'ginger',
    '꿀': 'honey',
    '미역': 'seaweed',
    '김': 'laver',

    // 영어 -> 한글
    'garlic': '마늘',
    'onion': '양파',
    'broccoli': '브로콜리',
    'spinach': '시금치',
    'carrot': '당근',
    'tomato': '토마토',
    'cucumber': '오이',
    'lettuce': '상추',
    'cabbage': '양배추',
    'pepper': '고추',
    'paprika': '파프리카',
    'eggplant': '가지',
    'mushroom': '버섯',
    'potato': '감자',
    'radish': '무',
    'apple': '사과',
    'banana': '바나나',
    'orange': '오렌지',
    'blueberry': '블루베리',
    'strawberry': '딸기',
    'grape': '포도',
    'kiwi': '키위',
    'mango': '망고',
    'pineapple': '파인애플',
    'lemon': '레몬',
    'salmon': '연어',
    'mackerel': '고등어',
    'tuna': '참치',
    'beef': '소고기',
    'pork': '돼지고기',
    'egg': '계란',
    'milk': '우유',
    'cheese': '치즈',
    'yogurt': '요거트',
    'rice': '쌀',
    'quinoa': '퀴노아',
    'oatmeal': '오트밀',
    'almond': '아몬드',
    'walnut': '호두',
    'peanut': '땅콩',
    'ginger': '생강',
    'honey': '꿀',
    'seaweed': '미역'
};

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function () {
    initializeIngredientAnalyzer();
    initializeTabs();
});

// 초기화 함수
function initializeIngredientAnalyzer() {
    const searchInput = document.getElementById('ingredientSearch');
    const searchSuggestions = document.getElementById('searchSuggestions');
    const searchIcon = document.querySelector('.search-icon');

    // 엔터키 이벤트만 남김
    searchInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });

    // 돋보기 아이콘 클릭 이벤트
    searchIcon.addEventListener('click', function () {
        handleSearch();
    });

    // 검색 입력 이벤트 (자동완성)
    searchInput.addEventListener('input', function () {
        const query = this.value.trim();
        if (query.length > 0) {
            showSearchSuggestions(query);
        } else {
            hideSearchSuggestions();
        }
    });

    // 검색창 외부 클릭 시 제안 숨기기
    document.addEventListener('click', function (e) {
        if (!searchInput.contains(e.target) && !searchSuggestions.contains(e.target)) {
            hideSearchSuggestions();
        }
    });

    // 구매하기 버튼 이벤트 리스너
    document.addEventListener('click', function (e) {
        if (e.target.id === 'purchaseButton' || e.target.closest('#purchaseButton')) {
            const ingredientName = document.getElementById('ingredientName').textContent;
            if (ingredientName) {
                const searchQuery = encodeURIComponent(ingredientName);
                const coupangUrl = `https://www.coupang.com/np/search?q=${searchQuery}`;
                window.open(coupangUrl, '_blank');
            }
        }
    });
}

// 탭 기능 초기화
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.ingredient-tab-btn');
    const tabContents = document.querySelectorAll('.ingredient-tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', function () {
            const targetTab = this.dataset.tab;

            // 모든 탭 버튼과 콘텐츠에서 active 클래스 제거
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // 클릭된 탭 버튼과 해당 콘텐츠에 active 클래스 추가
            this.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
}



// 한영 자동 변환 함수
function convertKoreanEnglish(text) {
    // 먼저 식재료 사전에서 직접 변환 시도
    if (ingredientTranslationMap[text.toLowerCase()]) {
        return ingredientTranslationMap[text.toLowerCase()];
    }

    // 자모 단위 변환 시도
    let converted = '';
    let hasKorean = false;
    let hasEnglish = false;

    for (let char of text) {
        if (koreanToEnglishMap[char]) {
            converted += koreanToEnglishMap[char];
            hasKorean = true;
        } else if (englishToKoreanMap[char]) {
            converted += englishToKoreanMap[char];
            hasEnglish = true;
        } else {
            converted += char;
        }
    }

    // 변환된 텍스트가 식재료 사전에 있는지 확인
    if (converted && ingredientTranslationMap[converted.toLowerCase()]) {
        return ingredientTranslationMap[converted.toLowerCase()];
    }

    // 변환이 일어났다면 변환된 텍스트 반환, 아니면 원본 반환
    return (hasKorean || hasEnglish) ? converted : text;
}

// 검색어 스마트 변환 함수
function getSmartSearchTerm(query) {
    const originalQuery = query.trim();

    // 1. 원본 검색어가 식재료 사전에 있는지 확인
    if (ingredientTranslationMap[originalQuery.toLowerCase()]) {
        return originalQuery;
    }

    // 2. 한영 변환 시도
    const converted = convertKoreanEnglish(originalQuery);
    if (converted !== originalQuery && ingredientTranslationMap[converted.toLowerCase()]) {
        return ingredientTranslationMap[converted.toLowerCase()];
    }

    // 3. 부분 매칭 시도 (한글 -> 영어)
    for (const [korean, english] of Object.entries(ingredientTranslationMap)) {
        if (korean.includes(originalQuery) || originalQuery.includes(korean)) {
            return korean;
        }
        if (typeof english === 'string' && (english.includes(originalQuery.toLowerCase()) || originalQuery.toLowerCase().includes(english))) {
            return korean;
        }
    }

    // 4. 변환된 텍스트 반환
    return converted !== originalQuery ? converted : originalQuery;
}

// 검색 처리 함수
async function handleSearch() {
    console.log('handleSearch 함수 호출됨');
    const searchInput = document.getElementById('ingredientSearch');
    const originalQuery = searchInput.value.trim();
    console.log('검색어:', originalQuery);

    if (!originalQuery) {
        showToast('분석할 식재료를 입력해주세요.', 'error');
        return;
    }

    // 이전 결과 초기화
    const resultSection = document.getElementById('resultSection');
    const mainContent = document.querySelector('.main-content');

    if (resultSection) {
        resultSection.style.display = 'none';
        resultSection.classList.remove('show');
    }
    
    if (mainContent) {
        mainContent.classList.remove('has-results');
    }
    
    if (document.body) {
        document.body.classList.remove('showing-detail');
    }

    currentSearch = originalQuery;
    showLoading();
    hideSearchSuggestions();

    try {
        const result = await analyzeIngredient(originalQuery);
        displayResult(result);
    } catch (error) {
        console.error('분석 오류:', error);
        showToast('분석 중 오류가 발생했습니다. 다시 시도해주세요.', 'error');
    } finally {
        hideLoading();
    }
}

// AI 분석 요청 함수
async function analyzeIngredient(ingredient) {
    const prompt = generateIngredientAnalysisPrompt(ingredient);

    try {
        const response = await fetch('/api/analyze-ingredient', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ingredient: ingredient,
                prompt: prompt
            })
        });

        if (!response.ok) {
            throw new Error('서버 오류가 발생했습니다.');
        }

        const data = await response.json();
        return data.result;
    } catch (error) {
        // 서버 오류 시 모의 데이터 반환 (개발용)
        console.warn('서버 연결 실패, 모의 데이터 사용:', error);
        return generateMockData(ingredient);
    }
}

// 분석 프롬프트 생성
function generateIngredientAnalysisPrompt(ingredient) {
    return `
다음 식재료에 대한 상세한 분석을 JSON 형태로 제공해주세요: ${ingredient}

다음 구조로 응답해주세요:
{
    "basic_info": {
        "name": "식재료명",
        "description": "간단한 설명"
    },
    "nutrition": {
        "calories": "칼로리",
        "protein": "단백질",
        "fat": "지방",
        "carbohydrates": "탄수화물",
        "sugar": "당류",
        "fiber": "식이섬유",
        "calcium": "칼슘",
        "iron": "철",
        "phosphorus": "인",
        "potassium": "칼륨",
        "sodium": "나트륨",
        "cholesterol": "콜레스테롤",
        "saturated_fat": "포화지방",
        "trans_fat": "트랜스지방"
    },
    "active_components": ["활성성분1", "활성성분2"],
    "benefits": ["효능1", "효능2"],
    "side_effects": ["부작용1", "부작용2"],
    "recipes": ["요리법1", "요리법2"],
    "usage_tips": ["영양소 흡수를 높이는 조리법", "신선도 유지 보관법", "조합 추천", "섭취 시 주의점", "계절별 활용법"],
    "storage": "보관방법",
    "additional_info": {
        "gi": "혈당지수",
        "season": "제철",
        "origin": "주요 산지",
        "compatibility": "궁합 식품",
        "incompatibility": "상극 식품",
        "pet_safety": "반려동물 섭취 가능여부"
    },
    "traditional_medicine": "한의학적 관점",
    "allergy_info": "알레르기 유발 가능성"
}
`;
}

// 모의 데이터 생성 (개발용)
function generateMockData(ingredient) {
    const mockData = {
        "basic_info": {
            "name": ingredient,
            "description": `${ingredient}은(는) 다양한 영양소를 함유한 건강한 식재료입니다.`
        },
        "nutrition": {
            "calories": "150 kcal",
            "protein": "8g",
            "fat": "5g",
            "carbohydrates": "20g",
            "sugar": "3g",
            "fiber": "4g",
            "calcium": "50mg",
            "iron": "2mg",
            "phosphorus": "100mg",
            "potassium": "300mg",
            "sodium": "10mg",
            "cholesterol": "0mg",
            "saturated_fat": "1g",
            "trans_fat": "0g"
        },
        "active_components": ["비타민C", "항산화물질", "식이섬유"],
        "benefits": [
            "면역력 증진",
            "항산화 효과",
            "소화 촉진",
            "혈당 조절"
        ],
        "side_effects": [
            "과다 섭취 시 복통",
            "알레르기 반응 가능성"
        ],
        "recipes": [
            "샐러드로 섭취",
            "스무디에 활용",
            "구이 요리",
            "스프 재료로 활용"
        ],
        "usage_tips": [
            "올리브오일과 함께 섭취하면 지용성 비타민 흡수율이 높아집니다",
            "냉장 보관 시 키친타월로 감싸면 수분 조절에 도움이 됩니다",
            "토마토와 함께 조리하면 항산화 효과가 배가됩니다",
            "공복보다는 식후에 섭취하는 것이 소화에 좋습니다",
            "겨울철에는 따뜻하게 조리해서 섭취하면 몸을 따뜻하게 해줍니다"
        ],
        "storage": "냉장고에서 보관하되, 신선도를 위해 1주일 이내 섭취 권장",
        "additional_info": {
            "gi": "낮음 (30-40)",
            "season": "연중 구입 가능",
            "origin": "국내산, 수입산",
            "compatibility": "올리브오일, 견과류",
            "incompatibility": "특별한 상극 식품 없음",
            "pet_safety": "소량 섭취 가능, 과다 섭취 주의"
        },
        "traditional_medicine": "한의학적으로는 성질이 차갑고, 해독 작용이 있어 체내 독소 제거에 도움이 됩니다.",
        "allergy_info": "드물지만 알레르기 반응이 나타날 수 있으므로 처음 섭취 시 소량부터 시작하는 것이 좋습니다."
    };

    return mockData;
}

// 결과 표시 함수 (새로운 탭 기반 레이아웃)
function displayResult(data) {
    const resultSection = document.getElementById('resultSection');
    const body = document.body;

    // 기본 정보 표시
    const ingredientName = document.getElementById('ingredientName');
    const ingredientDescription = document.getElementById('ingredientDescription');
    
    if (ingredientName) {
        ingredientName.textContent = data.basic_info.name;
    }
    if (ingredientDescription) {
        ingredientDescription.textContent = data.basic_info.description;
    }

    // 영양 정보 표시
    displayNutritionInfo(data.nutrition);

    // 활성성분 표시
    displayActiveComponents(data.active_components);

    // 효능과 부작용 표시
    displayEffects(data.benefits, data.side_effects);

    // 요리법 표시
    displayRecipes(data.recipes);

    // 활용 팁 표시
    displayUsageTips(data.usage_tips);

    // 보관방법 표시
    const storageInfo = document.getElementById('storageInfo');
    if (storageInfo) {
        storageInfo.textContent = data.storage;
    }

    // 추가 정보 표시
    displayAdditionalInfo(data.additional_info);

    // 한의학적 관점
    const traditionalInfo = document.getElementById('traditionalInfo');
    if (traditionalInfo) {
        traditionalInfo.textContent = data.traditional_medicine;
    }

    // 알레르기 정보
    const allergyInfo = document.getElementById('allergyInfo');
    if (allergyInfo) {
        allergyInfo.textContent = data.allergy_info;
    }

    // 레이아웃 상태 변경
    if (body) {
        body.classList.add('has-results');
        body.classList.add('showing-detail');
    }

    // 결과 섹션 표시
    if (resultSection) {
        resultSection.style.display = 'block';

        // 애니메이션을 위해 약간의 지연 후 show 클래스 추가
        setTimeout(() => {
            resultSection.classList.add('show');

        // 레이아웃 변경 후 최상단으로 스크롤
        setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            // 브라우저 호환성을 위한 대안
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
        }, 200);
        }, 100);
    }
}

// 영양 정보 표시 (모던 그리드 레이아웃)
function displayNutritionInfo(nutrition) {
    const nutritionGrid = document.getElementById('nutritionGrid');
    if (!nutritionGrid) return;
    
    nutritionGrid.innerHTML = '';

    const nutritionItems = [
        { key: 'calories', label: '칼로리', unit: 'kcal' },
        { key: 'protein', label: '단백질', unit: 'g' },
        { key: 'fat', label: '지방', unit: 'g' },
        { key: 'carbohydrates', label: '탄수화물', unit: 'g' },
        { key: 'sugar', label: '당류', unit: 'g' },
        { key: 'fiber', label: '식이섬유', unit: 'g' },
        { key: 'calcium', label: '칼슘', unit: 'mg' },
        { key: 'iron', label: '철', unit: 'mg' },
        { key: 'phosphorus', label: '인', unit: 'mg' },
        { key: 'potassium', label: '칼륨', unit: 'mg' },
        { key: 'sodium', label: '나트륨', unit: 'mg' },
        { key: 'cholesterol', label: '콜레스테롤', unit: 'mg' },
        { key: 'saturated_fat', label: '포화지방', unit: 'g' },
        { key: 'trans_fat', label: '트랜스지방', unit: 'g' }
    ];

    nutritionItems.forEach(item => {
        if (nutrition[item.key]) {
            const nutritionItem = document.createElement('div');
            nutritionItem.className = 'nutrition-item';
            
            // "(100g 기준)" 및 "100g당" 텍스트 제거
            let cleanValue = nutrition[item.key];
            if (cleanValue.includes('(100g 기준)')) {
                cleanValue = cleanValue.replace('(100g 기준)', '').trim();
            }
            if (cleanValue.includes('(100g당)')) {
                cleanValue = cleanValue.replace('(100g당)', '').trim();
            }
            
            nutritionItem.innerHTML = `
                <div class="nutrition-label">${item.label}</div>
                <div class="nutrition-value">${cleanValue}</div>
            `;
            nutritionGrid.appendChild(nutritionItem);
        }
    });
}

// 활성성분 표시 (모던 스타일)
function displayActiveComponents(components) {
    const componentsList = document.getElementById('componentsList');
    if (!componentsList) return;
    
    componentsList.innerHTML = '';

    components.forEach(component => {
        const componentItem = document.createElement('div');
        componentItem.className = 'component-item';
        componentItem.textContent = component;
        componentsList.appendChild(componentItem);
    });
}

// 효능과 부작용 표시 (새로운 레이아웃)
function displayEffects(benefits, sideEffects) {
    const benefitsList = document.getElementById('benefitsList');
    const sideEffectsList = document.getElementById('sideEffectsList');

    if (!benefitsList || !sideEffectsList) return;

    benefitsList.innerHTML = '';
    sideEffectsList.innerHTML = '';

    benefits.forEach(benefit => {
        const benefitItem = document.createElement('div');
        benefitItem.className = 'effect-item benefit';
        benefitItem.innerHTML = `<span class="effect-icon">✅</span>${benefit}`;
        benefitsList.appendChild(benefitItem);
    });

    sideEffects.forEach(sideEffect => {
        const sideEffectItem = document.createElement('div');
        sideEffectItem.className = 'effect-item side-effect';
        sideEffectItem.innerHTML = `<span class="effect-icon">⚠️</span>${sideEffect}`;
        sideEffectsList.appendChild(sideEffectItem);
    });
}

// 요리법 표시 (간단한 목록 스타일)
function displayRecipes(recipes) {
    const recipesList = document.getElementById('recipesList');
    if (!recipesList) return;
    
    recipesList.innerHTML = '';

    recipes.forEach((recipe, index) => {
        const recipeItem = document.createElement('div');
        recipeItem.className = 'recipe-item';
        recipeItem.innerHTML = `
            <div class="recipe-number">${index + 1}</div>
            <div class="recipe-content">${recipe}</div>
        `;
        
        recipesList.appendChild(recipeItem);
    });
}

// 추가 정보 표시 (개요 탭)
function displayAdditionalInfo(info) {
    const giValue = document.getElementById('giValue');
    const seasonValue = document.getElementById('seasonValue');
    const originValue = document.getElementById('originValue');
    const compatibilityValue = document.getElementById('compatibilityValue');
    const incompatibilityValue = document.getElementById('incompatibilityValue');
    const petSafetyValue = document.getElementById('petSafetyValue');

    if (giValue) giValue.textContent = info.gi || '정보 없음';
    if (seasonValue) seasonValue.textContent = info.season || '정보 없음';
    if (originValue) originValue.textContent = info.origin || '정보 없음';
    if (compatibilityValue) compatibilityValue.textContent = info.compatibility || '정보 없음';
    if (incompatibilityValue) incompatibilityValue.textContent = info.incompatibility || '정보 없음';
    if (petSafetyValue) petSafetyValue.textContent = info.pet_safety || '정보 없음';
}

// 검색 제안 표시
function showSearchSuggestions(query) {
    const suggestions = getSearchSuggestions(query);
    const searchSuggestions = document.getElementById('searchSuggestions');

    if (!searchSuggestions) return;

    if (suggestions.length > 0) {
        searchSuggestions.innerHTML = '';
        suggestions.forEach(suggestion => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';
            suggestionItem.textContent = suggestion;
            suggestionItem.addEventListener('click', () => {
                const searchInput = document.getElementById('ingredientSearch');
                if (searchInput) {
                    searchInput.value = suggestion;
                }
                hideSearchSuggestions();
                handleSearch();
            });
            searchSuggestions.appendChild(suggestionItem);
        });
        searchSuggestions.style.display = 'block';
    } else {
        hideSearchSuggestions();
    }
}

// 검색 제안 숨기기
function hideSearchSuggestions() {
    const searchSuggestions = document.getElementById('searchSuggestions');
    if (searchSuggestions) {
        searchSuggestions.style.display = 'none';
    }
}

// 검색 제안 목록 생성 (한영 변환 지원)
function getSearchSuggestions(query) {
    const commonIngredients = [
        // 채소류
        '마늘', '양파', '브로콜리', '시금치', '당근', '토마토', '오이', '상추', '양배추', '배추',
        '고추', '파프리카', '가지', '버섯', '감자', '고구마', '무', '순무', '우엉', '연근',
        '파', '대파', '쪽파', '부추', '미나리', '쑥갓', '깻잎', '상추', '치커리', '아스파라거스',
        '콜리플라워', '브뤼셀스프라우트', '케일', '스위스차드', '비트', '셀러리', '파슬리', '로즈마리',

        // 과일류
        '사과', '바나나', '오렌지', '블루베리', '딸기', '포도', '키위', '망고', '파인애플', '레몬',
        '라임', '자몽', '감', '배', '복숭아', '자두', '체리', '살구', '무화과', '석류',
        '아보카도', '코코넛', '망고스틴', '두리안', '리치', '롱안', '구아바', '패션후르츠',

        // 정육/계란
        '닭가슴살', '닭다리', '닭날개', '소고기', '돼지고기', '양고기', '오리고기', '칠면조',
        '토끼고기', '사슴고기', '말고기', '염소고기', '캥거루고기', '타조고기',

        // 생선류
        '연어', '고등어', '삼치', '참치', '광어', '우럭', '도미', '붕어', '잉어', '메기',
        '가자미', '넙치', '홍어', '문어', '오징어', '낙지', '새우', '게', '조개', '홍합',
        '굴', '전복', '소라', '바지락', '꼬막', '재첩', '다슬기', '우렁이', '갈치', '명태',

        // 계란 및 유제품
        '계란', '메추리알', '오리알', '거위알', '타조알', '우유', '요거트', '치즈', '버터',
        '크림', '사워크림', '리코타치즈', '모짜렐라', '체다치즈', '파마산치즈', '고르곤졸라',
        '블루치즈', '브리치즈', '까망베르치즈', '할루미치즈', '페타치즈', '코티지치즈',

        // 곡물류
        '현미', '백미', '흑미', '찰현미', '퀴노아', '오트밀', '귀리', '보리', '밀', '호밀',
        '옥수수', '수수', '조', '기장', '피', '티프', '아마란스', '테프', '스펠트', '카무트',

        // 견과류 및 씨앗
        '아몬드', '호두', '땅콩', '피스타치오', '캐슈넛', '마카다미아', '브라질넛', '피칸',
        '헤이즐넛', '잣', '은행', '밤', '개암', '피칸', '브라질넛', '마카다미아',
        '아마씨', '치아씨드', '해바라기씨', '호박씨', '참깨', '들깨', '대마씨', '포피씨',

        // 기름류
        '올리브오일', '코코넛오일', '아보카도오일', '아마씨오일', '들기름', '참기름', '콩기름',
        '옥수수기름', '해바라기씨오일', '포도씨오일', '호두오일', '아몬드오일', '마카다미아오일',
        '팜오일', '팜커넬오일', '면실유', '쌀겨유', '밀배아유', '호박씨오일', '대마씨오일',

        // 조미료 및 향신료
        '소금', '설탕', '꿀', '메이플시럽', '아가베시럽', '스테비아', '에리스리톨', '자일리톨',
        '후추', '고춧가루', '파프리카', '커리', '카레', '심황', '생강', '마늘가루', '양파가루',
        '바질', '오레가노', '타임', '세이지', '로즈마리', '라벤더', '민트', '레몬그라스',
        '시나몬', '육두구', '정향', '카다몬', '아니스', '회향', '커민', '고수', '딜',

        // 해조류
        '미역', '다시마', '김', '톳', '청각', '모자반', '우뭇가사리', '해파리',

        // 버섯류
        '표고버섯', '느타리버섯', '팽이버섯', '새송이버섯', '양송이버섯', '목이버섯', '영지버섯',
        '차가버섯', '상황버섯', '동충하초', '송이버섯', '능이버섯',

        // 특수 식재료
        '마카', '스피루리나', '클로렐라', '모링가', '아사이베리', '고지베리', '크랜베리',
        '라즈베리', '블랙베리', '로즈힙', '히비스커스', '카모마일', '페퍼민트', '레몬밤',
        '레몬버베나',
    ];

    const lowerQuery = query.toLowerCase();
    const convertedQuery = convertKoreanEnglish(query).toLowerCase();

    // 원본 쿼리와 변환된 쿼리 모두로 검색
    const suggestions = commonIngredients.filter(ingredient => {
        const lowerIngredient = ingredient.toLowerCase();
        const convertedIngredient = convertKoreanEnglish(ingredient).toLowerCase();

        return lowerIngredient.includes(lowerQuery) ||
            lowerIngredient.includes(convertedQuery) ||
            convertedIngredient.includes(lowerQuery) ||
            convertedIngredient.includes(convertedQuery) ||
            // 식재료 사전에서도 검색
            (ingredientTranslationMap[ingredient] &&
                ingredientTranslationMap[ingredient].toLowerCase().includes(lowerQuery)) ||
            (ingredientTranslationMap[lowerQuery] === ingredient);
    });

    // 중복 제거 후 최대 5개 반환
    return [...new Set(suggestions)].slice(0, 5);
}

// 로딩 표시
function showLoading() {
    const loadingSection = document.getElementById('loadingSection');
    const resultSection = document.getElementById('resultSection');
    
    if (loadingSection) {
        loadingSection.style.display = 'block';
    }
    if (resultSection) {
        resultSection.style.display = 'none';
    }
}

// 로딩 숨기기
function hideLoading() {
    const loadingSection = document.getElementById('loadingSection');
    if (loadingSection) {
        loadingSection.style.display = 'none';
    }
}

// 토스트 메시지 표시
function showToast(message, type = 'success') {
    // 토스트 컨테이너 찾기 또는 생성
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// 활용 팁 표시 함수
function displayUsageTips(tips) {
    const tipsContainer = document.getElementById('usageTips');
    if (!tipsContainer) return;
    
    tipsContainer.innerHTML = '';

    if (!tips || tips.length === 0) {
        tipsContainer.innerHTML = '<p>활용 팁 정보가 없습니다.</p>';
        return;
    }

    tips.forEach((tip, index) => {
        const tipItem = document.createElement('div');
        tipItem.className = 'tip-item';
        
        // **를 <strong> 태그로 변환
        let formattedTip = tip.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // 이미 마크다운 볼드 처리가 있는지 확인
        const hasMarkdownBold = tip.includes('**');
        
        // 마크다운 볼드 처리가 없는 경우에만 자동 볼드 처리 적용
        if (!hasMarkdownBold) {
            // 번호가 포함된 팁인 경우 (예: "1. 영양소 흡수를 높이는 조리법")
            if (formattedTip.match(/^\d+\.\s/)) {
                // 번호와 제목을 분리
                const match = formattedTip.match(/^(\d+\.\s)(.+)/);
                if (match) {
                    const number = match[1];
                    const content = match[2];
                    
                    // 제목 부분을 찾아서 볼드 처리 (첫 번째 문장 또는 주요 키워드)
                    const titleMatch = content.match(/^([^:：]+)([:：]|$)/);
                    if (titleMatch) {
                        const title = titleMatch[1];
                        const rest = content.substring(titleMatch[0].length);
                        formattedTip = `${number}<strong>${title}</strong>${rest}`;
                    } else {
                        // 제목을 찾을 수 없는 경우 전체 내용을 볼드 처리
                        formattedTip = `${number}<strong>${content}</strong>`;
                    }
                }
            } else {
                // 번호가 없는 팁인 경우 첫 번째 주요 부분을 볼드 처리
                const titleMatch = formattedTip.match(/^([^:：]+)([:：]|$)/);
                if (titleMatch) {
                    const title = titleMatch[1];
                    const rest = formattedTip.substring(titleMatch[0].length);
                    formattedTip = `<strong>${title}</strong>${rest}`;
                } else {
                    // 제목을 찾을 수 없는 경우 전체를 볼드 처리
                    formattedTip = `<strong>${formattedTip}</strong>`;
                }
            }
        }
        
        tipItem.innerHTML = `
            <div class="tip-number">${index + 1}</div>
            <div class="ingredient-tips-content">${formattedTip}</div>
        `;
        tipsContainer.appendChild(tipItem);
    });
}



// =============================
// [공공데이터포털] 가공식품 영양성분 검색 UI/로직 (CSV 전용)
// =============================
(function() {
    // DOM 요소
    const input = document.getElementById('externalSearchInput');
    const btn = document.getElementById('externalSearchBtn');
    const loading = document.getElementById('externalSearchLoading');
    const errorBox = document.getElementById('externalSearchError');
    const resultsBox = document.getElementById('externalSearchResults');
    const detailBox = document.getElementById('externalNutritionDetail');

    if (!input || !btn) return; // 해당 UI가 없는 경우 무시

    // 검색 이벤트
    btn.addEventListener('click', handleExternalSearch);
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') handleExternalSearch();
    });

    // 검색 함수 (CSV 검색만 사용)
    async function handleExternalSearch() {
        const keyword = input.value.trim();
        if (!keyword) {
            showError('제품명을 입력하세요.');
            return;
        }
        showLoading();
        try {
            // CSV 검색 API 사용
            const res = await fetch(`/api/food-nutrition-external/search?productName=${encodeURIComponent(keyword)}&limit=200`);
            const data = await res.json();
            if (!data.success || !Array.isArray(data.data) || data.data.length === 0) {
                showError('검색 결과가 없습니다. 다른 제품명으로 시도해보세요.');
                return;
            }
            renderResults(data.data);
        } catch (err) {
            showError('검색 중 오류가 발생했습니다.');
        }
    }

    // 결과 리스트 렌더링
    function renderResults(items) {
        hideLoading();
        errorBox.style.display = 'none';
        detailBox.style.display = 'none';
        resultsBox.innerHTML = '';
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'nutrition-card external-nutrition-card';
            card.innerHTML = `
                <div class="nutrition-card-title">${item.식품명}</div>
                <div class="nutrition-card-meta">${item.제조사명 || '-'} / ${item.식품중량 || '-'}g</div>
                <button class="nutrition-detail-btn">상세보기</button>
            `;
            card.querySelector('.nutrition-detail-btn').addEventListener('click', function() {
                fetchDetail(item);
            });
            resultsBox.appendChild(card);
        });
    }

    // 상세정보 조회 및 렌더링
    async function fetchDetail(item) {
        showLoading();
        try {
            // CSV 상세정보 API 사용
            const params = new URLSearchParams({
                foodName: item.식품명
            });
            
            if (item.식품코드) {
                params.append('foodCode', item.식품코드);
            }
            
            const res = await fetch(`/api/food-nutrition-external/detail?${params}`);
            const data = await res.json();
            if (!data.success || !data.data) {
                showError('상세 정보를 불러올 수 없습니다.');
                return;
            }
            renderDetail(data.data);
        } catch (err) {
            showError('상세 정보 조회 중 오류가 발생했습니다.');
        }
    }

    // 상세정보 렌더링
    function renderDetail(info) {
        hideLoading();
        errorBox.style.display = 'none';
        detailBox.style.display = 'block';
        detailBox.innerHTML = `
            <h3>${info.식품명} 상세 영양성분</h3>
            <table class="nutrition-detail-table">
                <tr><th>에너지(kcal)</th><td>${info.에너지 || '-'}</td></tr>
                <tr><th>단백질(g)</th><td>${info.단백질 || '-'}</td></tr>
                <tr><th>지방(g)</th><td>${info.지방 || '-'}</td></tr>
                <tr><th>탄수화물(g)</th><td>${info.탄수화물 || '-'}</td></tr>
                <tr><th>당류(g)</th><td>${info.당류 || '-'}</td></tr>
                <tr><th>나트륨(mg)</th><td>${info.나트륨 || '-'}</td></tr>
                <tr><th>콜레스테롤(mg)</th><td>${info.콜레스테롤 || '-'}</td></tr>
                <tr><th>포화지방산(g)</th><td>${info.포화지방산 || '-'}</td></tr>
                <tr><th>트랜스지방산(g)</th><td>${info.트랜스지방산 || '-'}</td></tr>
            </table>
            <div class="product-info">
                <h4>제품 정보</h4>
                ${info.식품코드 ? `<p><strong>식품코드:</strong> ${info.식품코드}</p>` : ''}
                ${info.식품대분류명 ? `<p><strong>식품분류:</strong> ${info.식품대분류명}</p>` : ''}
                <p><strong>식품중량:</strong> ${info.식품중량 || '-'}</p>
                <p><strong>제조사명:</strong> ${info.제조사명 || '-'}</p>
                <p><strong>유통업체명:</strong> ${info.유통업체명 || '-'}</p>
                ${info.일회섭취참고량 ? `<p><strong>1회 섭취참고량:</strong> ${info.일회섭취참고량}</p>` : ''}
                ${info.데이터기준일자 ? `<p><strong>데이터 기준일자:</strong> ${info.데이터기준일자}</p>` : ''}
            </div>
        `;
    }

    // 로딩/에러 표시 함수
    function showLoading() {
        loading.style.display = 'block';
        errorBox.style.display = 'none';
        detailBox.style.display = 'none';
        resultsBox.innerHTML = '';
    }
    function hideLoading() {
        loading.style.display = 'none';
    }
    function showError(msg) {
        hideLoading();
        errorBox.style.display = 'block';
        errorBox.textContent = msg;
        resultsBox.innerHTML = '';
        detailBox.style.display = 'none';
    }

    console.log('[ingredient-analyzer.js] CSV 전용 음식 영양성분 검색 시스템 초기화 완료');
})();