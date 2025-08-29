const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, '../data/users.json');

// 사용자 데이터 읽기
function readUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        return [];
    }

    const data = fs.readFileSync(USERS_FILE, 'utf-8');

    // 파일이 비어있는 경우 빈 배열 반환
    if (!data.trim()) {
        return [];
    }

    try {
        return JSON.parse(data);
    } catch (error) {
        console.error('Failed to parse users.json:', error);
        console.error('Raw data:', data);
        return []; // 파싱 실패 시 빈 배열을 반환하여 서버 다운 방지
    }
}

// 사용자 데이터 쓰기
function writeUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

// 서비스 이용 횟수 증가
function incrementServiceUsage(userId, serviceType) {
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
        users[userIndex].serviceUsage['mini-game']++;
        users[userIndex].serviceUsage.lastUpdated = new Date().toISOString();
        
        writeUsers(users);
        console.log(`사용자 ${userId}의 ${serviceType} 이용 횟수 증가: ${users[userIndex].serviceUsage['mini-game']}`);
        return true;
    } else if (users[userIndex].serviceUsage[serviceType] !== undefined) {
        users[userIndex].serviceUsage[serviceType]++;
        users[userIndex].serviceUsage.lastUpdated = new Date().toISOString();
        
        writeUsers(users);
        console.log(`사용자 ${userId}의 ${serviceType} 이용 횟수 증가: ${users[userIndex].serviceUsage[serviceType]}`);
        return true;
    } else {
        console.error(`알 수 없는 서비스 타입: ${serviceType}`);
        return false;
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
function getAllUsersServiceUsage() {
    const users = readUsers();
    const stats = {
        totalUsers: users.length,
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
        stats.serviceUsage.mealPlan += usage.mealPlan;
        stats.serviceUsage.restaurantRecommendation += usage.restaurantRecommendation;
        stats.serviceUsage.supplementRecommendation += usage.supplementRecommendation;
        stats.serviceUsage.ingredientAnalysis += usage.ingredientAnalysis;
        stats.serviceUsage['mini-game'] += usage['mini-game'];
        
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