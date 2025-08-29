/**
 * 카테고리 업데이트 스크립트
 * 새로운 카테고리 구조로 업데이트
 */

const CategoryManager = require('../utils/categoryManager');

async function updateCategories() {
    console.log('🔄 카테고리 업데이트를 시작합니다...');
    
    const categoryManager = new CategoryManager();
    
    try {
        // 새로운 카테고리 구조
        const newCategories = [
            // 건강식품
            {
                name: 'health_functional_food',
                display_name: '건강기능식품',
                description: '건강 기능성이 인정된 식품'
            },
            {
                name: 'protein_food',
                display_name: '단백질 식품',
                description: '근육 건강을 위한 단백질 식품'
            },
            {
                name: 'healthy_snack',
                display_name: '건강 간식',
                description: '건강한 간식거리'
            },
            {
                name: 'healthy_juice',
                display_name: '건강 주스',
                description: '영양이 풍부한 건강 주스'
            },
            // 간편식 / 반찬
            {
                name: 'home_meal_replacement',
                display_name: '가정간편식',
                description: '간편하게 즐기는 가정식'
            },
            {
                name: 'side_dish',
                display_name: '반찬',
                description: '맛있는 밑반찬'
            },
            {
                name: 'salad',
                display_name: '샐러드',
                description: '신선한 샐러드'
            },
            // 신선식품
            {
                name: 'fruit',
                display_name: '과일',
                description: '신선한 제철 과일'
            },
            {
                name: 'meat',
                display_name: '정육/계란',
                description: '신선한 정육/계란'
            },
            {
                name: 'seafood',
                display_name: '수산/해산',
                description: '신선한 수산/해산'
            }
        ];

        const results = [];
        
        for (const category of newCategories) {
            try {
                // 이미 존재하는지 확인
                const existing = await categoryManager.getCategoryByName(category.name);
                if (existing.success && existing.data) {
                    console.log(`✅ 카테고리 "${category.display_name}" 이미 존재함`);
                    results.push({
                        category: category.display_name,
                        status: 'exists',
                        message: '이미 존재함'
                    });
                    continue;
                }

                // 생성
                const result = await categoryManager.createCategory(category);
                console.log(`✅ 카테고리 "${category.display_name}" 생성 완료`);
                results.push({
                    category: category.display_name,
                    status: 'created',
                    data: result
                });

            } catch (error) {
                console.error(`❌ 카테고리 "${category.display_name}" 생성 실패:`, error.message);
                results.push({
                    category: category.display_name,
                    status: 'failed',
                    error: error.message
                });
            }
        }

        console.log('\n📊 카테고리 업데이트 결과:');
        results.forEach(result => {
            const status = result.status === 'created' ? '✅ 생성됨' : 
                          result.status === 'exists' ? '⚪ 이미 존재' : 
                          '❌ 실패';
            console.log(`  ${status}: ${result.category}`);
            if (result.error) {
                console.log(`    오류: ${result.error}`);
            }
        });

        const created = results.filter(r => r.status === 'created').length;
        const existing = results.filter(r => r.status === 'exists').length;
        const failed = results.filter(r => r.status === 'failed').length;

        console.log(`\n🎉 카테고리 업데이트 완료!`);
        console.log(`  - 새로 생성: ${created}개`);
        console.log(`  - 이미 존재: ${existing}개`);
        console.log(`  - 실패: ${failed}개`);

        if (failed > 0) {
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ 카테고리 업데이트 중 오류 발생:', error);
        process.exit(1);
    }
}

// 스크립트 실행
if (require.main === module) {
    updateCategories()
        .then(() => {
            console.log('✅ 스크립트 실행 완료');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ 스크립트 실행 실패:', error);
            process.exit(1);
        });
}

module.exports = updateCategories;