/**
 * 영양정보 카테고리 업데이트 스크립트
 * 기존 카테고리를 새로운 건강 중심 카테고리로 변경
 */

const fs = require('fs');
const path = require('path');

// 카테고리 매핑 정의
const categoryMapping = {
    'diet': 'gut_health',           // 식단 -> 장 건강
    'supplements': 'immunity',       // 영양제 -> 면역력
    'research': 'brain_health',      // 연구 -> 뇌 건강
    'trends': 'anti_aging'          // 트렌드 -> 항노화
};

// 새로운 카테고리 목록
const newCategories = [
    'brain_health', 'cancer', 'cardiovascular', 'blood_sugar', 'ent', 'energy_fatigue',
    'eye_health', 'fat_loss', 'gut_health', 'anti_aging', 'immunity', 'bone_joint',
    'kidney_urinary', 'liver_health', 'lung_respiratory', 'mens_health', 'womens_health',
    'mental_health', 'muscle_exercise', 'oral_health', 'pain', 'pregnancy_parenting',
    'skin_hair', 'sleep'
];

async function updateNutritionCategories() {
    console.log('🔄 영양정보 카테고리 업데이트를 시작합니다...');
    
    try {
        // 1. 로컬 JSON 파일 업데이트
        await updateLocalJsonFiles();
        
        // 2. 설정 파일 업데이트
        await updateConfigFiles();
        
        // 3. 사용자 선호도 파일 업데이트
        await updateUserPreferences();
        
        console.log('✅ 영양정보 카테고리 업데이트가 완료되었습니다!');
        console.log('\n📝 업데이트된 카테고리:');
        newCategories.forEach(category => {
            console.log(`   - ${category}`);
        });
        
        console.log('\n⚠️  다음 단계를 수행하세요:');
        console.log('   1. 데이터베이스 마이그레이션 실행: node scripts/apply-migration.js 013_update_nutrition_categories.sql');
        console.log('   2. 서버 재시작');
        console.log('   3. 프론트엔드에서 카테고리 필터 테스트');
        
    } catch (error) {
        console.error('❌ 카테고리 업데이트 중 오류 발생:', error);
        process.exit(1);
    }
}

async function updateLocalJsonFiles() {
    const dataDir = path.join(__dirname, '..', 'data');
    const nutritionInfoFile = path.join(dataDir, 'nutrition-info.json');
    
    if (fs.existsSync(nutritionInfoFile)) {
        console.log('📄 nutrition-info.json 파일 업데이트 중...');
        
        const data = JSON.parse(fs.readFileSync(nutritionInfoFile, 'utf8'));
        let updatedCount = 0;
        
        if (Array.isArray(data)) {
            data.forEach(item => {
                if (item.category && categoryMapping[item.category]) {
                    console.log(`   카테고리 변경: ${item.category} -> ${categoryMapping[item.category]} (${item.title})`);
                    item.category = categoryMapping[item.category];
                    updatedCount++;
                }
            });
        }
        
        // 백업 생성
        const backupFile = `${nutritionInfoFile}.backup.${new Date().toISOString().replace(/[:.]/g, '-')}`;
        fs.copyFileSync(nutritionInfoFile, backupFile);
        console.log(`   백업 생성: ${backupFile}`);
        
        // 업데이트된 파일 저장
        fs.writeFileSync(nutritionInfoFile, JSON.stringify(data, null, 2));
        console.log(`   ✅ ${updatedCount}개 항목 업데이트 완료`);
    }
}

async function updateConfigFiles() {
    const configFile = path.join(__dirname, '..', 'data', 'nutrition-config.json');
    
    if (fs.existsSync(configFile)) {
        console.log('⚙️  nutrition-config.json 파일 업데이트 중...');
        
        const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        config.categories = newCategories;
        
        // 백업 생성
        const backupFile = `${configFile}.backup.${new Date().toISOString().replace(/[:.]/g, '-')}`;
        fs.copyFileSync(configFile, backupFile);
        
        // 업데이트된 설정 저장
        fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
        console.log('   ✅ 설정 파일 업데이트 완료');
    }
}

async function updateUserPreferences() {
    const preferencesFile = path.join(__dirname, '..', 'data', 'user-preferences.json');
    
    if (fs.existsSync(preferencesFile)) {
        console.log('👤 user-preferences.json 파일 업데이트 중...');
        
        const preferences = JSON.parse(fs.readFileSync(preferencesFile, 'utf8'));
        
        // 사용자별 선호 카테고리 업데이트
        Object.keys(preferences).forEach(userId => {
            const userPref = preferences[userId];
            if (userPref.categories && Array.isArray(userPref.categories)) {
                userPref.categories = userPref.categories.map(category => 
                    categoryMapping[category] || category
                ).filter(category => newCategories.includes(category));
            }
        });
        
        // 백업 생성
        const backupFile = `${preferencesFile}.backup.${new Date().toISOString().replace(/[:.]/g, '-')}`;
        fs.copyFileSync(preferencesFile, backupFile);
        
        // 업데이트된 선호도 저장
        fs.writeFileSync(preferencesFile, JSON.stringify(preferences, null, 2));
        console.log('   ✅ 사용자 선호도 업데이트 완료');
    }
}

// 스크립트 실행
if (require.main === module) {
    updateNutritionCategories();
}

module.exports = {
    updateNutritionCategories,
    categoryMapping,
    newCategories
};
