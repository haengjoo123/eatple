/**
 * 건강고민과 식약처 건강기능식품 매칭을 위한 키워드 및 필터링 시스템
 */

// 건강고민별 키워드 매핑
const HEALTH_KEYWORDS = {
    // 기존 키워드
    '뼈_건강': ['뼈', '치아', '골다공증', '칼슘', '골밀도', '골격', '치아형성'],
    '면역력': ['면역', '감기', '바이러스', '항산화', '면역력증진', '면역기능'],
    '피로회복': ['피로', '에너지', '활력', '체력', '피로개선', '에너지대사', '탄수화물대사'],
    '혈액순환': ['혈액', '혈관', '순환', '혈압', '혈액흐름', '혈소판', '혈액응고'],
    '장건강': ['유산균', '프로바이오틱스', '장건강', '배변활동', '장기능', '소화'],
    '눈건강': ['눈', '시력', '망막', '루테인', '시각', '눈건강'],
    '심혈관': ['심장', '혈관', '콜레스테롤', '혈압', '심혈관', '순환기'],
    '간건강': ['간', '간기능', '해독', '간보호', '간건강'],
    '두뇌': ['기억력', '인지', '두뇌', '집중력', '기억력개선', '뇌기능'],
    '항산화': ['항산화', '활성산소', '산화방지', '노화방지', '유해산소'],
    '여성건강': ['여성', '생리', '갱년기', '호르몬', '여성건강'],
    '남성건강': ['남성', '전립선', '남성건강', '정력'],
    '관절': ['관절', '연골', '무릎', '관절건강', '관절염'],
    '피부': ['피부', '콜라겐', '피부건강', '미용', '피부미용'],
    
    // 프론트엔드에서 사용하는 키워드 추가 매핑
    'cognitive_memory': ['기억력', '인지', '두뇌', '집중력', '기억력개선', '뇌기능', '뇌', '정신'],
    'tension_stress': ['긴장', '스트레스', '안정', '신경', '진정'],
    'sleep_quality': ['수면', '숙면', '불면', '잠', '수면의 질'],
    'fatigue': ['피로', '에너지', '활력', '체력', '피로개선', '에너지대사', '탄수화물대사', '체내 에너지 생성', '에너지 생성'],
    'dental': ['치아', '뼈', '칼슘', '치아형성', '뼈와', '치아와', '뼈와 치아', '치아 형성', '뼈와 치아 형성'],
    'eye': ['눈', '시력', '망막', '루테인', '시각', '눈건강', '어두운 곳에서 시각'],
    'skin': ['피부', '콜라겐', '피부건강', '미용', '피부미용', '피부와 점막'],
    'liver': ['간', '간기능', '해독', '간보호', '간건강'],
    'stomach': ['위', '위건강', '소화', '위장', '소화불량'],
    'intestine': ['장', '장건강', '유산균', '프로바이오틱스', '배변활동', '장기능', '변비'],
    'body_fat': ['체지방', '지방', '체중', '다이어트', '비만', '체지방 감소', '탄수화물이 지방으로 합성'],
    'blood_glucose': ['혈당', '당뇨', '혈당조절', '당뇨병', '혈당 수치', '혈당 관리', '포도당', '인슐린', '당화혈색소'],
    'menopause_women': ['갱년기', '여성', '여성 갱년기', '호르몬', '여성건강'],
    'menopause_men': ['남성 갱년기', '남성건강', '남성', '갱년기 남성'],
    'premenstrual': ['월경', '생리', 'PMS', '월경전증후군', '생리전'],
    'triglycerides': ['중성지방', '혈중 중성지방', '혈중 중성지질', '중성지질'],
    'cholesterol': ['콜레스테롤', '혈중 콜레스테롤', 'LDL', 'HDL', '총콜레스테롤', '콜레스테롤 개선', '콜레스테롤 관리'],
    'blood_pressure': ['혈압', '고혈압', '혈압조절', '혈압 관리', '수축기', '이완기', '혈압 개선'],
    'blood_circulation': ['혈행', '혈액순환', '혈액', '혈관', '순환', '혈액흐름', '혈행개선'],
    'immunity': ['면역', '감기', '바이러스', '항산화', '면역력증진', '면역기능', '면역력', '면역체계', '유해산소', '세포보호', '정상적인 면역기능'],
    'antioxidant': ['항산화', '활성산소', '산화방지', '노화방지', '유해산소', '유해산소로부터 세포를 보호'],
    'joint': ['관절', '연골', '무릎', '관절건강', '관절염', '관절 및 연골'],
    'bone': ['뼈', '치아', '골다공증', '칼슘', '골밀도', '골격', '치아형성', '뼈와', '치아와', '뼈와 치아', '골격건강', '뼈 형성', '뼈의 형성'],
    'muscle_strength': ['근력', '근육', '운동능력', '체력', '근육강화', '근육량', '근육발달', '운동수행능력', '에너지 생성', '체내 에너지', '에너지 대사', '단백질', '아미노산', '신경과 근육 기능'],
    'exercise_performance': ['운동', '운동능력', '운동수행능력', '체력', '근력', '근육', '에너지'],
    'prostate': ['전립선', '남성건강', '남성', '전립선 건강'],
    'urination': ['배뇨', '소변', '요', '배뇨기능'],
    'urinary_tract': ['요로', '요로건강', '비뇨기', '요로감염']
};

// 복용 형태 매핑 (확장된 버전)
const DOSAGE_FORM_MAPPING = {
    'capsule': ['캡슐', '경질캅셀', '연질캅셀', '경질캡슐', '연질캡슐', '캡슐제'],
    'tablet': ['정제', '타블렛', '츄어블', '트로키', '정', '알약', '환', '태블릿'],
    'powder': ['분말', '가루', '과립', '분말제', '산제'],
    'liquid': ['액상', '시럽', '음료', '드링크', '액제', '음료제'],
    'gummy': ['젤리', '구미', '츄어블', '젤리제'],
    'stick': ['스틱', '포', '스틱제'],
    'oil': ['오일', '기름', '유제'],
    'cream': ['크림', '겔', '크림제', '겔제'],
    'any': [] // 'any'(무관)일 때는 빈 배열로 처리하여 모든 형태 허용
};

// 영양제 명칭과 원재료 매칭을 위한 키워드 매핑
const SUPPLEMENT_NAME_KEYWORDS = {
    // 오메가-3 관련
    '오메가-3': ['오메가3', '오메가-3', 'omega-3', 'omega3', 'DHA', 'EPA', '도코사헥사엔산', '에이코사펜타엔산', '생선기름', '어유'],
    '오메가3': ['오메가3', '오메가-3', 'omega-3', 'omega3', 'DHA', 'EPA', '도코사헥사엔산', '에이코사펜타엔산', '생선기름', '어유'],
    
    // 비타민 D 관련
    '비타민 D': ['비타민D', '비타민D3', '비타민 D3', 'vitamin D', 'vitamin D3', 'cholecalciferol', '콜레칼시페롤'],
    '비타민 D3': ['비타민D', '비타민D3', '비타민 D3', 'vitamin D', 'vitamin D3', 'cholecalciferol', '콜레칼시페롤'],
    '비타민D': ['비타민D', '비타민D3', '비타민 D3', 'vitamin D', 'vitamin D3', 'cholecalciferol', '콜레칼시페롤'],
    '비타민D3': ['비타민D', '비타민D3', '비타민 D3', 'vitamin D', 'vitamin D3', 'cholecalciferol', '콜레칼시페롤'],
    '비타민 D-3': ['비타민D', '비타민D3', '비타민 D3', 'vitamin D', 'vitamin D3', 'cholecalciferol', '콜레칼시페롤'],
    
    // 비타민 C 관련
    '비타민 C': ['비타민C', '비타민 C', 'vitamin C', 'ascorbic acid', '아스코르브산'],
    '비타민C': ['비타민C', '비타민 C', 'vitamin C', 'ascorbic acid', '아스코르브산'],
    
    // 비타민 B 관련
    '비타민 B': ['비타민B', '비타민 B', 'vitamin B', 'B복합', 'B군'],
    '비타민B': ['비타민B', '비타민 B', 'vitamin B', 'B복합', 'B군'],
    '비타민 B12': ['비타민B12', '비타민 B12', 'vitamin B12', 'cobalamin', '코발라민'],
    '비타민B12': ['비타민B12', '비타민 B12', 'vitamin B12', 'cobalamin', '코발라민'],
    
    // 철분 관련
    '철분': ['철', '철분', 'iron', '헤모글로빈', '철(II)', '철(III)'],
    '철': ['철', '철분', 'iron', '헤모글로빈', '철(II)', '철(III)'],
    
    // 칼슘 관련
    '칼슘': ['칼슘', 'calcium', '탄산칼슘', '구연산칼슘', '칼슘카보네이트'],
    
    // 마그네슘 관련
    '마그네슘': ['마그네슘', 'magnesium', '산화마그네슘', '구연산마그네슘'],
    
    // 아연 관련
    '아연': ['아연', 'zinc', '황산아연', '구연산아연'],
    
    // 프로바이오틱스 관련
    '프로바이오틱스': ['프로바이오틱스', '유산균', 'probiotics', '락토바실러스', 'lactobacillus', '비피도박테리움', 'bifidobacterium'],
    '유산균': ['프로바이오틱스', '유산균', 'probiotics', '락토바실러스', 'lactobacillus', '비피도박테리움', 'bifidobacterium'],
    
    // 코엔자임 Q10 관련
    '코엔자임 Q10': ['코엔자임Q10', '코엔자임 Q10', 'coenzyme Q10', 'CoQ10', '유비퀴논'],
    '코엔자임Q10': ['코엔자임Q10', '코엔자임 Q10', 'coenzyme Q10', 'CoQ10', '유비퀴논'],
    
    // 루테인 관련
    '루테인': ['루테인', 'lutein', '지아잔틴', 'zeaxanthin'],
    
    // 콜라겐 관련
    '콜라겐': ['콜라겐', 'collagen', '히알루론산', 'hyaluronic acid'],
    
    // 글루코사민 관련
    '글루코사민': ['글루코사민', 'glucosamine', '콘드로이틴', 'chondroitin', 'MSM'],
    
    // 밀크씨슬 관련
    '밀크씨슬': ['밀크씨슬', 'milk thistle', '실리마린', 'silymarin'],
    
    // 홍삼 관련
    '홍삼': ['홍삼', '인삼', 'ginseng', '진세노사이드', 'ginsenoside'],
    '인삼': ['홍삼', '인삼', 'ginseng', '진세노사이드', 'ginsenoside'],
    
    // 크릴오일 관련
    '크릴오일': ['크릴오일', 'krill oil', '크릴', '아스타잔틴', 'astaxanthin'],
    
    // 엽산 관련
    '엽산': ['엽산', 'folic acid', 'folate', '폴레이트'],
    
    // 비오틴 관련
    '비오틴': ['비오틴', 'biotin', '비타민H', 'vitamin H'],
    
    // 복잡한 영양제 명칭들 (동의어 및 별명 처리)
    '크롬 피콜리네이트': ['크롬', 'chromium', '피콜리네이트', 'picolinate', '크롬피콜리네이트', 'chromium picolinate'],
    '크롬피콜리네이트': ['크롬', 'chromium', '피콜리네이트', 'picolinate', '크롬피콜리네이트', 'chromium picolinate'],
    
    // 아슈와간다 관련
    '아슈와간다': ['아슈와간다', 'ashwagandha', 'withania', 'withania somnifera', '위타니아', '인도인삼'],
    'ashwagandha': ['아슈와간다', 'ashwagandha', 'withania', 'withania somnifera', '위타니아', '인도인삼'],
    
    // KSM-66 (아슈와간다 특허 추출물)
    'KSM-66': ['KSM-66', 'KSM66', 'ksm-66', 'ksm66', '아슈와간다', 'ashwagandha'],
    'ksm-66': ['KSM-66', 'KSM66', 'ksm-66', 'ksm66', '아슈와간다', 'ashwagandha'],
    
    // 코큐텐 관련 (다양한 표기법)
    'CoQ10': ['코큐텐', 'coq10', 'CoQ10', 'coenzyme q10', '코엔자임큐10', '코엔자임Q10', '코엔자임 Q10', '유비퀴논'],
    'coq10': ['코큐텐', 'coq10', 'CoQ10', 'coenzyme q10', '코엔자임큐10', '코엔자임Q10', '코엔자임 Q10', '유비퀴논'],
    '코큐텐': ['코큐텐', 'coq10', 'CoQ10', 'coenzyme q10', '코엔자임큐10', '코엔자임Q10', '코엔자임 Q10', '유비퀴논'],
    '코엔자임Q10': ['코큐텐', 'coq10', 'CoQ10', 'coenzyme q10', '코엔자임큐10', '코엔자임Q10', '코엔자임 Q10', '유비퀴논'],
    '코엔자임 Q10': ['코큐텐', 'coq10', 'CoQ10', 'coenzyme q10', '코엔자임큐10', '코엔자임Q10', '코엔자임 Q10', '유비퀴논'],
    
    // 베르베린
    '베르베린': ['베르베린', 'berberine', '황련', '황련추출물'],
    'berberine': ['베르베린', 'berberine', '황련', '황련추출물'],
    
    // 커큐민 (강황)
    '커큐민': ['커큐민', 'curcumin', '강황', 'turmeric', '울금', '터메릭'],
    'curcumin': ['커큐민', 'curcumin', '강황', 'turmeric', '울금', '터메릭'],
    '강황': ['커큐민', 'curcumin', '강황', 'turmeric', '울금', '터메릭'],
    '터메릭': ['커큐민', 'curcumin', '강황', 'turmeric', '울금', '터메릭'],
    
    // 레스베라트롤
    '레스베라트롤': ['레스베라트롤', 'resveratrol', '적포도추출물', '포도껍질추출물'],
    'resveratrol': ['레스베라트롤', 'resveratrol', '적포도추출물', '포도껍질추출물'],
    
    // 알파리포산
    '알파리포산': ['알파리포산', 'alpha lipoic acid', 'ALA', 'α-lipoic acid', '리포산'],
    'alpha lipoic acid': ['알파리포산', 'alpha lipoic acid', 'ALA', 'α-lipoic acid', '리포산'],
    'ALA': ['알파리포산', 'alpha lipoic acid', 'ALA', 'α-lipoic acid', '리포산'],
    
    // 아세틸-L-카르니틴
    '아세틸-L-카르니틴': ['아세틸카르니틴', 'acetyl-l-carnitine', 'ALCAR', '카르니틴'],
    '아세틸카르니틴': ['아세틸카르니틴', 'acetyl-l-carnitine', 'ALCAR', '카르니틴'],
    'acetyl-l-carnitine': ['아세틸카르니틴', 'acetyl-l-carnitine', 'ALCAR', '카르니틴'],
    
    // 포스파티딜세린
    '포스파티딜세린': ['포스파티딜세린', 'phosphatidylserine', 'PS', '레시틴'],
    'phosphatidylserine': ['포스파티딜세린', 'phosphatidylserine', 'PS', '레시틴'],
    
    // 바나듐
    '바나듐': ['바나듐', 'vanadium', '바나딜', 'vanadyl'],
    'vanadium': ['바나듐', 'vanadium', '바나딜', 'vanadyl'],
    
    // 보스웰리아
    '보스웰리아': ['보스웰리아', 'boswellia', '유향', '프랑킨센스'],
    'boswellia': ['보스웰리아', 'boswellia', '유향', '프랑킨센스'],
    
    // 피크노제놀
    '피크노제놀': ['피크노제놀', 'pycnogenol', '소나무껍질추출물', '프랑스소나무껍질'],
    'pycnogenol': ['피크노제놀', 'pycnogenol', '소나무껍질추출물', '프랑스소나무껍질'],
    
    // 퀘르세틴
    '퀘르세틴': ['퀘르세틴', 'quercetin', '양파추출물', '플라보노이드'],
    'quercetin': ['퀘르세틴', 'quercetin', '양파추출물', '플라보노이드'],
    
    // 나이아신아마이드 (비타민 B3)
    '나이아신아마이드': ['나이아신아마이드', 'niacinamide', '니코틴아마이드', 'nicotinamide', '비타민B3'],
    'niacinamide': ['나이아신아마이드', 'niacinamide', '니코틴아마이드', 'nicotinamide', '비타민B3'],
    
    // 바코파 모니에리
    '바코파': ['바코파', 'bacopa', 'bacopa monnieri', '바코파모니에리', '브라미'],
    'bacopa': ['바코파', 'bacopa', 'bacopa monnieri', '바코파모니에리', '브라미'],
    
    // 로디올라 로제아
    '로디올라': ['로디올라', 'rhodiola', 'rhodiola rosea', '로디올라로제아', '홍경천'],
    'rhodiola': ['로디올라', 'rhodiola', 'rhodiola rosea', '로디올라로제아', '홍경천']
};

/**
 * 건강고민 기반으로 제품 필터링
 * @param {Array} selectedGoals - 사용자가 선택한 건강고민 배열
 * @param {Array} apiProducts - 식약처 API에서 가져온 제품 배열
 * @returns {Array} 필터링된 제품 배열
 */
function matchHealthConcerns(selectedGoals, apiProducts) {
    if (!selectedGoals || selectedGoals.length === 0) {
        return apiProducts;
    }

    // 디버깅: 건강고민 매칭 과정 확인 (성능 최적화)
    if (apiProducts.length < 1000) { // 소량 데이터일 때만 상세 로그
        console.log('=== 건강고민 필터링 디버깅 ===');
        console.log(`선택된 건강고민: [${selectedGoals.join(', ')}]`);
        
        selectedGoals.forEach(goal => {
            const keywords = HEALTH_KEYWORDS[goal] || [];
            console.log(`${goal} → 키워드: [${keywords.join(', ')}]`);
        });
    }

    let matchCount = 0;
    const filteredProducts = apiProducts.filter(product => {
        const primaryFunction = (product.PRIMARY_FNCLTY || '').toLowerCase();
        
        const isMatch = selectedGoals.some(goal => {
            const keywords = HEALTH_KEYWORDS[goal] || [];
            const hasKeywordMatch = keywords.some(keyword => 
                primaryFunction.includes(keyword.toLowerCase())
            );
            
            if (hasKeywordMatch) {
                if (apiProducts.length < 1000) { // 소량 데이터일 때만 상세 로그
                    console.log(`✅ 건강고민 매칭: "${product.PRDT_NM}" - 기능: "${primaryFunction}" ← 목표: ${goal}`);
                }
                matchCount++;
            }
            
            return hasKeywordMatch;
        });
        
        return isMatch;
    });
    
    console.log(`건강고민 매칭 결과: ${matchCount}개 제품이 매칭됨`);
    return filteredProducts;
}

/**
 * 복용 형태 기반으로 제품 필터링
 * @param {Array} products - 제품 배열
 * @param {string} userPreference - 사용자 선호 복용 형태
 * @returns {Array} 필터링된 제품 배열
 */
function filterByDosagePreference(products, userPreference) {
    if (!userPreference || userPreference === 'any') return products;
    
    const acceptableForms = DOSAGE_FORM_MAPPING[userPreference] || [];
    
    // 디버깅: 실제 제품 형태 확인 (성능 최적화)
    if (products.length > 0 && products.length < 1000) { // 소량 데이터일 때만 상세 로그
        console.log('=== 복용형태 디버깅 ===');
        console.log(`사용자 선호: ${userPreference}`);
        console.log(`매칭 키워드: [${acceptableForms.join(', ')}]`);
        
        const uniqueForms = [...new Set(products.slice(0, 20).map(p => p.PRDT_SHAP_CD_NM).filter(f => f))];
        console.log('실제 제품 형태들 (상위 20개):', uniqueForms);
    }
    
    return products.filter(product => {
        const productForm = (product.PRDT_SHAP_CD_NM || '').toLowerCase();
        const match = acceptableForms.some(form => 
            productForm.includes(form.toLowerCase())
        );
        
        if (match && products.length < 1000) { // 소량 데이터일 때만 상세 로그
            console.log(`✅ 형태 매칭: "${productForm}" ← "${acceptableForms.join(', ')}"`);
        }
        
        return match;
    });
}

/**
 * 모든 조건을 만족하는 제품 필터링 (AND 조건)
 * @param {Array} products - 제품 배열
 * @param {Array} healthGoals - 건강고민 배열
 * @param {string} dosagePreference - 복용 형태 선호도
 * @param {Array} requiredIngredients - 필수 포함 성분 (선택사항)
 * @param {Array} avoidIngredients - 제외할 성분 (선택사항)
 * @returns {Array} 필터링된 제품 배열
 */
function filterProductsByAllCriteria(products, healthGoals, dosagePreference, requiredIngredients = [], avoidIngredients = []) {
    console.log('=== 필터링 시작 ===');
    console.log('전체 제품 수:', products.length);
    console.log('건강고민:', healthGoals);
    console.log('복용형태 선호:', dosagePreference);
    
    // 첫 3개 제품의 PRIMARY_FNCLTY 샘플 출력
    console.log('=== 샘플 제품 기능성 ===');
    products.slice(0, 3).forEach((product, index) => {
        console.log(`제품 ${index + 1}:`, {
            name: product.PRDT_NM,
            function: product.PRIMARY_FNCLTY,
            dosageForm: product.PRDT_SHAP_CD_NM
        });
    });
    
    return products.filter(product => {
        // 조건 1: 건강고민 매칭
        let healthMatch = true;
        if (healthGoals && healthGoals.length > 0) {
            healthMatch = healthGoals.some(goal => {
                const keywords = HEALTH_KEYWORDS[goal] || [];
                const primaryFunction = (product.PRIMARY_FNCLTY || '').toLowerCase();
                
                const match = keywords.some(keyword => 
                    primaryFunction.includes(keyword.toLowerCase())
                );
                
                if (match) {
                    console.log(`✅ 매칭됨 - 목표: ${goal}, 키워드: ${keywords.join(', ')}, 제품기능: ${primaryFunction}`);
                }
                
                return match;
            });
        }
        
        // 조건 2: 복용형태 매칭
        let dosageMatch = true;
        if (dosagePreference && dosagePreference !== 'any') {
            const acceptableForms = DOSAGE_FORM_MAPPING[dosagePreference] || [];
            const productForm = (product.PRDT_SHAP_CD_NM || '').toLowerCase();
            dosageMatch = acceptableForms.some(form => 
                productForm.includes(form.toLowerCase())
            );
        }
        
        // 조건 3: 필수 성분 포함 (선택사항)
        let ingredientMatch = true;
        if (requiredIngredients.length > 0) {
            const rawMaterials = (product.RAWMTRL_NM || '').toLowerCase();
            ingredientMatch = requiredIngredients.every(ingredient => 
                rawMaterials.includes(ingredient.toLowerCase())
            );
        }
        
        // 조건 4: 제외할 성분 확인 (선택사항)
        let avoidMatch = true;
        if (avoidIngredients.length > 0) {
            const rawMaterials = (product.RAWMTRL_NM || '').toLowerCase();
            avoidMatch = !avoidIngredients.some(ingredient => 
                rawMaterials.includes(ingredient.toLowerCase())
            );
        }
        
        // 모든 조건을 만족해야 함 (AND 연산)
        return healthMatch && dosageMatch && ingredientMatch && avoidMatch;
    });
}

/**
 * 문자열 유사도 계산 (Levenshtein Distance 기반)
 * @param {string} str1 - 첫 번째 문자열
 * @param {string} str2 - 두 번째 문자열
 * @returns {number} 0~1 사이의 유사도 (1이 가장 유사)
 */
function calculateSimilarity(str1, str2) {
    if (str1 === str2) return 1;
    if (!str1 || !str2) return 0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein Distance 계산
 */
function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

/**
 * 영양제 명칭을 정규화하여 검색 키워드 생성
 * @param {string} supplementName - 원본 영양제 명칭
 * @returns {Array} 검색에 사용할 키워드 배열
 */
function generateSearchKeywords(supplementName) {
    const normalized = supplementName.trim().toLowerCase();
    const keywords = [supplementName, normalized];
    
    console.log(`🔍 키워드 생성 시작: "${supplementName}"`);
    
    // 특수 문자 제거
    const cleanName = normalized.replace(/[^a-z0-9가-힣\s-]/g, '');
    if (cleanName !== normalized) {
        keywords.push(cleanName);
    }
    
    // 공백과 하이픈 처리
    const spaceless = normalized.replace(/[\s-]/g, '');
    if (spaceless !== normalized) {
        keywords.push(spaceless);
    }
    
    // 숫자와 문자 분리
    const withoutNumbers = normalized.replace(/[0-9]/g, '').trim();
    if (withoutNumbers && withoutNumbers !== normalized) {
        keywords.push(withoutNumbers);
    }
    
    // 단어 분리
    const words = normalized.split(/[\s-]+/).filter(word => word.length > 1);
    keywords.push(...words);
    
    // 중복 제거
    const finalKeywords = [...new Set(keywords)].filter(keyword => keyword.length > 1);
    console.log(`🔍 생성된 키워드: [${finalKeywords.join(', ')}]`);
    return finalKeywords;
}

/**
 * 유사도 기반 영양제 명칭 매칭 (원재료명과 제품명 모두에서 매칭되어야 함 - AND 조건)
 * @param {Array} products - 식약처 API에서 가져온 제품 배열
 * @param {string} supplementName - 영양제 명칭
 * @param {number} similarityThreshold - 유사도 임계값 (기본값: 0.6)
 * @returns {Array} 매칭된 제품과 점수
 */
function findSimilarSupplements(products, supplementName, similarityThreshold = 0.6) {
    const searchKeywords = generateSearchKeywords(supplementName);
    const results = [];
    
    console.log(`검색 키워드: ${searchKeywords.join(', ')}`);
    console.log(`유사도 매칭 대상 제품 수: ${products.length}개`);
    
    products.forEach(product => {
        const rawMaterials = (product.RAWMTRL_NM || '').toLowerCase();
        const productName = (product.PRDT_NM || product.PRDLST_NM || '').toLowerCase();
        
        let maxScore = 0;
        let matchedKeyword = '';
        let matchType = '';
        let matchSource = '';
        
        // 각 검색 키워드에 대해 매칭 시도 (원재료명과 제품명 모두에서 매칭되어야 함)
        searchKeywords.forEach(keyword => {
            let rawMaterialScore = 0;
            let productNameScore = 0;
            let rawMaterialMatchType = '';
            let productNameMatchType = '';
            
            // 1. 원재료명에서 매칭 확인
            // 1-1. 완전 일치 (원재료명)
            if (rawMaterials.includes(keyword)) {
                rawMaterialScore = 1;
                rawMaterialMatchType = '완전일치';
            } else {
                // 1-2. 부분 문자열 매칭 (최소 3글자 이상, 원재료명)
                if (keyword.length >= 3) {
                    for (let i = 0; i <= rawMaterials.length - keyword.length; i++) {
                        const substring = rawMaterials.substring(i, i + keyword.length);
                        const similarity = calculateSimilarity(keyword, substring);
                        
                        if (similarity >= similarityThreshold && similarity > rawMaterialScore) {
                            rawMaterialScore = similarity;
                            rawMaterialMatchType = `부분매칭(${similarity.toFixed(2)})`;
                        }
                    }
                }
                
                // 1-3. 단어별 유사도 검사 (원재료명)
                const rawMaterialWords = rawMaterials.split(/[\s,\(\)]+/).filter(w => w.length > 2);
                rawMaterialWords.forEach(word => {
                    const similarity = calculateSimilarity(keyword, word);
                    if (similarity >= similarityThreshold && similarity > rawMaterialScore) {
                        rawMaterialScore = similarity;
                        rawMaterialMatchType = `단어유사(${similarity.toFixed(2)})`;
                    }
                });
            }
            
            // 2. 제품명에서 매칭 확인
            // 2-1. 완전 일치 (제품명)
            if (productName.includes(keyword)) {
                productNameScore = 1;
                productNameMatchType = '완전일치';
            } else {
                // 2-2. 부분 문자열 매칭 (최소 3글자 이상, 제품명)
                if (keyword.length >= 3) {
                    for (let i = 0; i <= productName.length - keyword.length; i++) {
                        const substring = productName.substring(i, i + keyword.length);
                        const similarity = calculateSimilarity(keyword, substring);
                        
                        if (similarity >= similarityThreshold && similarity > productNameScore) {
                            productNameScore = similarity;
                            productNameMatchType = `부분매칭(${similarity.toFixed(2)})`;
                        }
                    }
                }
                
                // 2-3. 단어별 유사도 검사 (제품명)
                const productNameWords = productName.split(/[\s,\(\)]+/).filter(w => w.length > 2);
                productNameWords.forEach(word => {
                    const similarity = calculateSimilarity(keyword, word);
                    if (similarity >= similarityThreshold && similarity > productNameScore) {
                        productNameScore = similarity;
                        productNameMatchType = `단어유사(${similarity.toFixed(2)})`;
                    }
                });
            }
            
            // 3. 원재료명과 제품명 모두에서 매칭된 경우만 결과에 포함 (AND 조건)
            if (rawMaterialScore >= similarityThreshold && productNameScore >= similarityThreshold) {
                // 두 점수의 평균을 최종 점수로 사용
                const combinedScore = (rawMaterialScore + productNameScore) / 2;
                
                if (combinedScore > maxScore) {
                    maxScore = combinedScore;
                    matchedKeyword = keyword;
                    matchType = `${rawMaterialMatchType}+${productNameMatchType}`;
                    matchSource = '원재료명+제품명';
                }
            }
        });
        
        if (maxScore >= similarityThreshold) {
            results.push({
                product,
                score: maxScore,
                matchedKeyword,
                matchType,
                matchSource
            });
        }
    });
    
    // 점수 순으로 정렬
    results.sort((a, b) => b.score - a.score);
    
    console.log(`유사도 매칭 결과 (총 ${results.length}개):`);
    if (results.length > 0) {
        results.slice(0, 5).forEach((result, index) => {
            console.log(`✅ [${result.matchType}] ${result.product.PRDT_NM} (키워드: ${result.matchedKeyword}, 점수: ${result.score.toFixed(3)}, 출처: ${result.matchSource})`);
        });
    } else {
        console.log('❌ 유사도 매칭 결과가 없습니다.');
    }
    
    return results;
}

/**
 * 영양제 명칭 기반으로 제품 필터링 (개선된 버전)
 * @param {Array} products - 식약처 API에서 가져온 제품 배열
 * @param {string} supplementName - 영양제 명칭 (예: "크롬 피콜리네이트", "아슈와간다")
 * @param {Object} options - 옵션 설정
 * @returns {Array} 필터링된 제품 배열
 */
function filterProductsBySupplementName(products, supplementName, options = {}) {
    if (!supplementName || !products || products.length === 0) {
        return [];
    }

    const {
        similarityThreshold = 0.6,  // 유사도 임계값
        maxResults = 500,           // 최대 결과 수 (기본값 증가)
        useExactMatch = true,       // 정확한 매칭 우선 사용
        useSimilarityMatch = true   // 유사도 매칭 사용
    } = options;

    console.log(`=== 영양제 명칭 "${supplementName}"으로 제품 검색 (개선된 버전) ===`);
    
    let filteredProducts = [];
    let matchingInfo = [];
    
    // 1. 기존 정확한 키워드 매칭 먼저 시도
    if (useExactMatch) {
        const normalizedSupplementName = supplementName.trim().toLowerCase();
        let matchKeywords = [];
        
        // 정확한 매칭 시도
        if (SUPPLEMENT_NAME_KEYWORDS[supplementName]) {
            matchKeywords = SUPPLEMENT_NAME_KEYWORDS[supplementName];
        } else if (SUPPLEMENT_NAME_KEYWORDS[normalizedSupplementName]) {
            matchKeywords = SUPPLEMENT_NAME_KEYWORDS[normalizedSupplementName];
        } else {
            // 부분 매칭 시도
            for (const [key, keywords] of Object.entries(SUPPLEMENT_NAME_KEYWORDS)) {
                if (key.toLowerCase().includes(normalizedSupplementName) || 
                    normalizedSupplementName.includes(key.toLowerCase())) {
                    matchKeywords = keywords;
                    break;
                }
            }
        }
        
        if (matchKeywords.length > 0) {
            console.log(`정확한 매칭 키워드: ${matchKeywords.join(', ')}`);
            
            filteredProducts = products.filter(product => {
                const rawMaterials = (product.RAWMTRL_NM || '').toLowerCase();
                const productName = (product.PRDT_NM || product.PRDLST_NM || '').toLowerCase();
                
                return matchKeywords.some(keyword => {
                    const normalizedKeyword = keyword.toLowerCase();
                    // 원재료명과 제품명 모두에서 매칭 확인 (AND 조건)
                    return rawMaterials.includes(normalizedKeyword) && productName.includes(normalizedKeyword);
                });
            });
            
            matchingInfo = filteredProducts.map(product => ({
                product,
                score: 1,
                matchedKeyword: matchKeywords[0],
                matchType: '정확매칭'
            }));
        }
    }
    
    // 2. 정확한 매칭이 없거나 결과가 적을 때 유사도 매칭 사용
    if (useSimilarityMatch && filteredProducts.length < 5) {
        console.log('유사도 기반 매칭 시작...');
        // 전체 제품에 대해 유사도 계산
        const similarResults = findSimilarSupplements(products, supplementName, similarityThreshold);
        
        // 기존 결과와 병합 (중복 제거)
        const existingIds = new Set(filteredProducts.map(p => p.PRDLST_REPORT_NO));
        const newResults = similarResults.filter(result => 
            !existingIds.has(result.product.PRDLST_REPORT_NO)
        );
        
        matchingInfo.push(...newResults);
        filteredProducts.push(...newResults.map(r => r.product));
    }
    
    // 결과 로깅
    console.log(`매칭 결과 (총 ${matchingInfo.length}개):`);
    matchingInfo.slice(0, 5).forEach(info => {
        const productName = info.product.PRDT_NM || info.product.PRDLST_NM || '제품명 없음';
        console.log(`✅ [${info.matchType}] ${productName} (키워드: ${info.matchedKeyword})`);
    });
    
    console.log(`필터링 결과: ${filteredProducts.slice(0, maxResults).length}개 제품 찾음`);
    return filteredProducts.slice(0, maxResults);
}

/**
 * 제품에 해당하는 건강고민 태그들을 찾기
 * @param {Object} product - 식약처 API 제품 데이터
 * @param {Array} selectedGoals - 사용자가 선택한 건강고민 배열
 * @returns {Array} 매칭된 건강고민 배열
 */
function getMatchingHealthConcerns(product, selectedGoals = []) {
    const primaryFunction = (product.PRIMARY_FNCLTY || '').toLowerCase();
    const matchingConcerns = [];
    
    // 사용자가 선택한 건강고민들을 우선 확인
    if (selectedGoals && selectedGoals.length > 0) {
        selectedGoals.forEach(goal => {
            const keywords = HEALTH_KEYWORDS[goal] || [];
            const isMatch = keywords.some(keyword => 
                primaryFunction.includes(keyword.toLowerCase())
            );
            
            if (isMatch) {
                matchingConcerns.push({
                    key: goal,
                    label: getHealthConcernLabel(goal)
                });
            }
        });
    }
    
    // 선택된 건강고민에서 매칭되지 않은 경우, 전체 건강고민에서 찾기
    if (matchingConcerns.length === 0) {
        Object.keys(HEALTH_KEYWORDS).forEach(goal => {
            const keywords = HEALTH_KEYWORDS[goal] || [];
            const isMatch = keywords.some(keyword => 
                primaryFunction.includes(keyword.toLowerCase())
            );
            
            if (isMatch && matchingConcerns.length < 3) { // 최대 3개까지만
                matchingConcerns.push({
                    key: goal,
                    label: getHealthConcernLabel(goal)
                });
            }
        });
    }
    
    return matchingConcerns;
}

/**
 * 건강고민 키 값을 한국어 라벨로 변환
 * @param {string} key - 건강고민 키
 * @returns {string} 한국어 라벨
 */
function getHealthConcernLabel(key) {
    const labelMap = {
        // 신경계
        'cognitive_memory': '기억력',
        'tension_stress': '스트레스완화',
        'sleep_quality': '수면개선',
        'fatigue': '피로회복',
        
        // 감각계
        'dental': '치아건강',
        'eye': '눈건강',
        'skin': '피부미용',
        
        // 소화 대사계
        'liver': '간건강',
        'stomach': '위건강',
        'intestine': '장건강',
        'body_fat': '체지방감소',
        'calcium_absorption': '칼슘흡수',
        
        // 내분비계
        'blood_glucose': '혈당조절',
        'menopause_women': '여성갱년기',
        'menopause_men': '남성갱년기',
        'premenstrual': '월경전증후군',
        
        // 심혈관계
        'triglycerides': '중성지방',
        'cholesterol': '콜레스테롤',
        'blood_pressure': '혈압조절',
        'blood_circulation': '혈행개선',
        
        // 신체방어 및 면역계
        'immunity': '면역력',
        'antioxidant': '항산화',
        
        // 근육계
        'joint': '관절건강',
        'bone': '뼈건강',
        'muscle_strength': '근력강화',
        'exercise_performance': '운동능력',
        
        // 생식&비뇨계
        'prostate': '전립선건강',
        'urination': '배뇨개선',
        'urinary_tract': '요로건강',
        
        // 기존 한국어 키워드들
        '뼈_건강': '뼈건강',
        '면역력': '면역력',
        '피로회복': '피로회복',
        '혈액순환': '혈행개선',
        '장건강': '장건강',
        '눈건강': '눈건강',
        '심혈관': '심혈관',
        '간건강': '간건강',
        '두뇌': '두뇌건강',
        '항산화': '항산화',
        '여성건강': '여성건강',
        '남성건강': '남성건강',
        '관절': '관절건강',
        '피부': '피부미용'
    };
    
    return labelMap[key] || key;
}

/**
 * 새로운 매칭 순서로 제품 필터링 (건강고민 → 복용선호 → 기피성분 → 유사도 매칭)
 * @param {Array} products - 제품 배열
 * @param {Array} healthGoals - 건강고민 배열
 * @param {string} dosagePreference - 복용 형태 선호도
 * @param {Array} avoidIngredients - 제외할 성분 (선택사항)
 * @param {string} supplementName - 영양제 명칭 (유사도 매칭용, 선택사항)
 * @param {Object} options - 옵션 설정
 * @returns {Array} 필터링된 제품 배열
 */
function filterProductsByNewOrder(products, healthGoals, dosagePreference, avoidIngredients = [], supplementName = null, options = {}) {
    console.log('=== 새로운 매칭 순서로 제품 필터링 시작 ===');
    console.log('전체 제품 수:', products.length);
    console.log('건강고민:', healthGoals);
    console.log('복용형태 선호:', dosagePreference);
    console.log('기피성분:', avoidIngredients);
    console.log('영양제 명칭:', supplementName);
    
    let filteredProducts = [...products];
    let stepCount = 0;
    
    // 1단계: 건강고민 매칭
    if (healthGoals && healthGoals.length > 0) {
        stepCount++;
        const beforeCount = filteredProducts.length;
        filteredProducts = matchHealthConcerns(healthGoals, filteredProducts);
        console.log(`✅ 1단계 - 건강고민 매칭: ${beforeCount}개 → ${filteredProducts.length}개 제품`);
        
        if (filteredProducts.length === 0) {
            console.log('❌ 건강고민 매칭 후 제품이 없어서 필터링을 중단합니다.');
            return [];
        }
    }
    
    // 2단계: 복용형태 선호도 매칭
    if (dosagePreference && dosagePreference !== 'any') {
        stepCount++;
        const beforeCount = filteredProducts.length;
        const filteredByDosage = filterByDosagePreference(filteredProducts, dosagePreference);
        
        // 복용형태 필터링으로 제품이 너무 적어지면 필터링을 건너뜀
        if (filteredByDosage.length === 0 && beforeCount > 0) {
            console.log(`⚠️ 2단계 - 복용형태 필터링으로 제품이 0개가 되어 필터링을 건너뜁니다.`);
            console.log(`복용형태 필터링 후: ${beforeCount}개 제품 (필터링 건너뜀)`);
        } else {
            filteredProducts = filteredByDosage;
            console.log(`✅ 2단계 - 복용형태 매칭: ${beforeCount}개 → ${filteredProducts.length}개 제품`);
        }
    }
    
    // 3단계: 기피성분 필터링
    if (avoidIngredients && avoidIngredients.length > 0) {
        stepCount++;
        const beforeCount = filteredProducts.length;
        filteredProducts = filteredProducts.filter(product => {
            const rawMaterials = (product.RAWMTRL_NM || '').toLowerCase();
            return !avoidIngredients.some(ingredient => 
                rawMaterials.includes(ingredient.toLowerCase())
            );
        });
        console.log(`✅ 3단계 - 기피성분 필터링: ${beforeCount}개 → ${filteredProducts.length}개 제품`);
    }
    
    // 4단계: 영양제 명칭 유사도 매칭 (마지막 단계)
    if (supplementName && supplementName.trim()) {
        stepCount++;
        const beforeCount = filteredProducts.length;
        
        // 유사도 매칭 옵션 설정
        const similarityOptions = {
            similarityThreshold: options.similarityThreshold || 0.6,
            maxResults: options.maxResults || 500, // 기본값을 500으로 증가
            useExactMatch: options.useExactMatch !== false,
            useSimilarityMatch: options.useSimilarityMatch !== false
        };
        
        filteredProducts = filterProductsBySupplementName(filteredProducts, supplementName, similarityOptions);
        console.log(`✅ 4단계 - 영양제 명칭 유사도 매칭: ${beforeCount}개 → ${filteredProducts.length}개 제품`);
    }
    
    console.log(`=== 필터링 완료: 총 ${stepCount}단계, 최종 ${filteredProducts.length}개 제품 ===`);
    return filteredProducts;
}

/**
 * 제품 데이터를 프론트엔드용으로 포맷팅
 * @param {Object} product - 식약처 API 제품 데이터
 * @param {Array} selectedGoals - 사용자가 선택한 건강고민 배열 (선택사항)
 * @returns {Object} 포맷팅된 제품 데이터
 */
function formatProductForFrontend(product, selectedGoals = []) {
    // 건강고민 매칭
    const matchingHealthConcerns = getMatchingHealthConcerns(product, selectedGoals);

    return {
        id: product.PRDLST_REPORT_NO || '',
        name: product.PRDLST_NM || product.PRDT_NM || '제품명 없음',
        company: product.BSSH_NM || '제조사 정보 없음',
        function: product.PRIMARY_FNCLTY || '기능 정보 없음',
        dosageForm: product.PRDT_SHAP_CD_NM || '제형 정보 없음',
        ingredients: product.RAWMTRL_NM || '원료 정보 없음',
        intakeMethod: product.NTK_MTHD || '섭취방법 정보 없음',
        precautions: product.IFTKN_ATNT_MATR_CN || '',
        reportDate: product.PRDLST_REPORT_DE || '',
        expiryDate: product.POG_DAYCNT || '',
        // 추가 정보
        shelfLife: product.POG_DAYCNT || '',
        intakeAmount: product.INTAKE_HINT_MPB || '',
        storageMethod: product.DISPOS || '',
        // 건강고민 매칭 정보
        healthConcerns: matchingHealthConcerns
    };
}

module.exports = {
    HEALTH_KEYWORDS,
    DOSAGE_FORM_MAPPING,
    SUPPLEMENT_NAME_KEYWORDS,
    matchHealthConcerns,
    filterByDosagePreference,
    filterProductsByAllCriteria,
    filterProductsBySupplementName,
    filterProductsByNewOrder,  // 새로운 매칭 순서 함수 추가
    formatProductForFrontend,
    getMatchingHealthConcerns,
    getHealthConcernLabel,
    // 새로 추가된 함수들
    calculateSimilarity,
    generateSearchKeywords,
    findSimilarSupplements
};
