const { readUsers, writeUsers } = require('./userStore');

// 서비스 이용 횟수 증가
function incrementServiceUsage(userId, serviceType) {
    if (!Object.values(SERVICE_TYPES).includes(serviceType)) return false;
    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
        console.error(`사용자를 찾을 수 없습니다: ${userId}`);
        return false;
    }
    
    // serviceUsage 객체가 없으면 생성
    if (!users[userIndex].serviceUsage) {
        users[userIndex].serviceUsage = {
            mealPlan: 0,
            restaurantRecommendation: 0,
            supplementRecommendation: 0,
            ingredientAnalysis: 0,
            'mini-game': 0, // 하이픈이 포함된 키는 문자열로 처리
            lastUpdated: new Date().toISOString()
        };
    }
    
    // 해당 서비스 이용 횟수 증가
    if (serviceType === 'mini-game') {
        // mini-game은 특별 처리
        users[userIndex].serviceUsage['mini-game'] = (users[userIndex].serviceUsage['mini-game'] || 0) + 1;
        users[userIndex].serviceUsage.lastUpdated = new Date().toISOString();
        
        writeUsers(users);
        return true;
    } else {
        users[userIndex].serviceUsage[serviceType] = (users[userIndex].serviceUsage[serviceType] || 0) + 1;
        users[userIndex].serviceUsage.lastUpdated = new Date().toISOString();
        
        writeUsers(users);
        return true;
    }
}

// 사용자의 서비스 이용 횟수 조회
function getUserServiceUsage(userId) {
    const users = readUsers();
    const user = users.find(u => u.id === userId);
    
    if (!user) {
        return null;
    }
    
    return user.serviceUsage || {
        mealPlan: 0,
        restaurantRecommendation: 0,
        supplementRecommendation: 0,
        ingredientAnalysis: 0,
        'mini-game': 0,
        lastUpdated: null
    };
}

// 모든 사용자의 서비스 이용 통계 조회
async function getAllUsersServiceUsage() {
    const users = readUsers();
    
    // Supabase에서 실제 사용자 수 가져오기
    let totalUsersFromSupabase = users.length; // 기본값은 로컬 파일 기준
    
    try {
        const { createClient } = require('@supabase/supabase-js');
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_KEY;
        
        if (supabaseUrl && supabaseKey) {
            const supabase = createClient(supabaseUrl, supabaseKey);
            const { count, error } = await supabase
                .from('users')
                .select('*', { count: 'exact', head: true });
            
            if (!error && count !== null) {
                totalUsersFromSupabase = count;
            } else {
                console.warn('Supabase 사용자 수 조회 실패, 로컬 파일 사용:', error);
            }
        }
    } catch (error) {
        console.warn('Supabase 연동 오류, 로컬 파일 사용:', error.message);
    }
    
    const stats = {
        totalUsers: totalUsersFromSupabase,
        serviceUsage: {
            mealPlan: 0,
            restaurantRecommendation: 0,
            supplementRecommendation: 0,
            ingredientAnalysis: 0,
            'mini-game': 0
        },
        userDetails: []
    };
    
    users.forEach(user => {
        const usage = user.serviceUsage || {
            mealPlan: 0,
            restaurantRecommendation: 0,
            supplementRecommendation: 0,
            ingredientAnalysis: 0,
            'mini-game': 0
        };
        
        // 전체 통계에 추가
        for (const type of Object.values(SERVICE_TYPES)) {
            stats.serviceUsage[type] += usage[type] || 0;
        }
        
        // 개별 사용자 정보 추가
        stats.userDetails.push({
            id: user.id,
            username: user.username || user.email || user.name || 'Unknown',
            serviceUsage: usage
        });
    });
    
    return stats;
}

// 서비스 타입 상수
const SERVICE_TYPES = {
    MEAL_PLAN: 'mealPlan',
    RESTAURANT_RECOMMENDATION: 'restaurantRecommendation',
    SUPPLEMENT_RECOMMENDATION: 'supplementRecommendation',
    INGREDIENT_ANALYSIS: 'ingredientAnalysis',
    MINI_GAMES: 'mini-game'
};

module.exports = {
    incrementServiceUsage,
    getUserServiceUsage,
    getAllUsersServiceUsage,
    SERVICE_TYPES
};
