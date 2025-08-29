const fs = require('fs');
const path = require('path');
const PointsService = require('./pointsService');

/**
 * 프로필 완성도 관리 서비스
 * 프로필 완성도 체크 및 완성 보상 지급 로직을 담당
 */
class ProfileCompletionService {
    /**
     * 사용자 데이터 파일 경로
     */
    static get USERS_FILE_PATH() {
        return path.join(__dirname, '../data/users.json');
    }

    /**
     * 프로필 완성도 체크 기준
     * 각 필드별 가중치와 필수 여부 정의 (총 100점)
     */
    static get PROFILE_CRITERIA() {
        return {
            // 기본 정보 (50점)
            age: { weight: 10, required: true, label: '나이' },
            height: { weight: 10, required: true, label: '키' },
            weight: { weight: 10, required: true, label: '몸무게' },
            gender: { weight: 10, required: true, label: '성별' },
            activity_level: { weight: 10, required: true, label: '활동 수준' },
            
            // 생활 패턴 (30점)
            eating_patterns: { weight: 8, required: false, label: '식사 패턴' },
            sleep_patterns: { weight: 8, required: false, label: '수면 패턴' },
            meals_per_day: { weight: 6, required: false, label: '하루 식사 횟수' },
            alcohol_consumption: { weight: 4, required: false, label: '음주 여부' },
            smoking_status: { weight: 4, required: false, label: '흡연 여부' },
            
            // 건강 정보 (20점)
            allergies: { weight: 5, required: false, label: '알레르기 정보' },
            illnesses: { weight: 5, required: false, label: '질병 정보' },
            biomarkers: { weight: 5, required: false, label: '건강검진 수치' },
            supplements: { weight: 5, required: false, label: '건강기능식품' }
        };
    }

    /**
     * 프로필 완성 보상 포인트
     */
    static get COMPLETION_REWARD_POINTS() {
        return 500;
    }

    /**
     * 사용자 데이터 읽기
     */
    static readUsersData() {
        try {
            const data = fs.readFileSync(this.USERS_FILE_PATH, 'utf8');
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error('사용자 데이터 읽기 오류:', error);
            return [];
        }
    }

    /**
     * 사용자 데이터 저장
     */
    static saveUsersData(usersData) {
        try {
            fs.writeFileSync(this.USERS_FILE_PATH, JSON.stringify(usersData, null, 2));
        } catch (error) {
            console.error('사용자 데이터 저장 오류:', error);
            throw new Error('사용자 데이터를 저장할 수 없습니다.');
        }
    }

    /**
     * 프로필 완성도 계산
     * @param {Object} profile - 사용자 프로필 객체
     * @returns {Object} 완성도 정보
     */
    static calculateCompletionPercentage(profile) {
        console.log('프로필 완성도 계산 시작:', profile);
        
        if (!profile || typeof profile !== 'object') {
            console.log('프로필이 없거나 유효하지 않음');
            return {
                percentage: 0,
                completedFields: [],
                missingFields: Object.keys(this.PROFILE_CRITERIA),
                isComplete: false,
                totalWeight: 100,
                earnedWeight: 0
            };
        }

        const criteria = this.PROFILE_CRITERIA;
        const completedFields = [];
        const missingFields = [];
        let earnedWeight = 0;
        const totalWeight = 100;

        // 각 필드별 완성도 체크
        Object.keys(criteria).forEach(field => {
            const fieldCriteria = criteria[field];
            const fieldValue = profile[field];
            
            // 필드 값이 존재하고 유효한지 체크
            const isCompleted = this.isFieldCompleted(field, fieldValue);
            
            console.log(`필드 ${field}: 값=${JSON.stringify(fieldValue)}, 완성=${isCompleted}`);
            
            if (isCompleted) {
                completedFields.push({
                    field,
                    label: fieldCriteria.label,
                    weight: fieldCriteria.weight,
                    value: fieldValue
                });
                earnedWeight += fieldCriteria.weight;
            } else {
                missingFields.push({
                    field,
                    label: fieldCriteria.label,
                    weight: fieldCriteria.weight,
                    required: fieldCriteria.required
                });
            }
        });

        const percentage = Math.round((earnedWeight / totalWeight) * 100);
        const isComplete = percentage === 100;

        console.log(`완성도 계산 결과: ${percentage}% (${earnedWeight}/${totalWeight})`);
        console.log('완성된 필드:', completedFields.map(f => f.field));
        console.log('미완성 필드:', missingFields.map(f => f.field));

        return {
            percentage,
            completedFields,
            missingFields,
            isComplete,
            totalWeight,
            earnedWeight
        };
    }

    /**
     * 개별 필드 완성도 체크
     * @param {string} field - 필드명
     * @param {any} value - 필드 값
     * @returns {boolean} 완성 여부
     */
    static isFieldCompleted(field, value) {
        // null, undefined, 빈 문자열 체크
        if (value === null || value === undefined || value === '') {
            return false;
        }

        // 필드별 특별한 검증 로직
        switch (field) {
            case 'age':
                // 문자열도 허용하되 숫자로 변환 가능한지 체크
                const ageNum = typeof value === 'string' ? parseInt(value) : value;
                return !isNaN(ageNum) && ageNum > 0 && ageNum < 150;
            
            case 'height':
                // 문자열도 허용하되 숫자로 변환 가능한지 체크
                const heightNum = typeof value === 'string' ? parseFloat(value) : value;
                return !isNaN(heightNum) && heightNum > 50 && heightNum < 300;
            
            case 'weight':
                // 문자열도 허용하되 숫자로 변환 가능한지 체크
                const weightNum = typeof value === 'string' ? parseFloat(value) : value;
                return !isNaN(weightNum) && weightNum > 20 && weightNum < 500;
            
            case 'gender':
                return typeof value === 'string' && ['male', 'female'].includes(value);
            
            case 'activity_level':
                return typeof value === 'string' && ['sedentary', 'light', 'moderate', 'active', 'very_active'].includes(value);
            
            case 'eating_patterns':
                return typeof value === 'string' && ['regular', 'irregular', 'intermittent_fasting'].includes(value);
            
            case 'sleep_patterns':
                return typeof value === 'string' && ['less_than_6', '6_to_8', 'more_than_8'].includes(value);
            
            case 'meals_per_day':
                return typeof value === 'string' && ['1', '2', '3', '4'].includes(value);
            
            case 'alcohol_consumption':
                return typeof value === 'string' && ['none', 'socially', 'weekly_light', 'weekly_moderate', 'frequent'].includes(value);
            
            case 'smoking_status':
                return typeof value === 'string' && ['smoker', 'non_smoker'].includes(value);
            
            case 'allergies':
                // 배열이거나 "none" 문자열이면 완성된 것으로 처리 ("없음" 선택 포함)
                return Array.isArray(value) || value === 'none';
            
            case 'illnesses':
                // 배열이거나 "none" 문자열이면 완성된 것으로 처리 ("없음" 선택 포함)
                return Array.isArray(value) || value === 'none';
            
            case 'biomarkers':
                // 배열이거나 "none" 문자열이면 완성된 것으로 처리 ("없음" 선택 포함)
                return Array.isArray(value) || value === 'none';
            
            case 'supplements':
                // 배열이거나 "none" 문자열이면 완성된 것으로 처리 ("없음" 선택 포함)
                return Array.isArray(value) || value === 'none';
            
            default:
                // 기본적으로 문자열이고 비어있지 않으면 완성
                return typeof value === 'string' && value.trim().length > 0;
        }
    }

    /**
     * 프로필 완성 보상 지급 체크 및 처리
     * @param {string} userId - 사용자 ID
     * @param {Object} profile - 업데이트된 프로필
     * @returns {Object} 보상 지급 결과
     */
    static checkAndRewardCompletion(userId, profile) {
        try {
            const usersData = this.readUsersData();
            const userIndex = usersData.findIndex(user => user.id === userId);
            
            if (userIndex === -1) {
                throw new Error('사용자를 찾을 수 없습니다.');
            }

            const user = usersData[userIndex];
            
            // 프로필 완성도 계산
            const completionInfo = this.calculateCompletionPercentage(profile);
            
            // 이미 완성 보상을 받았는지 체크
            const hasReceivedReward = user.profileCompletionReward === true;
            
            // 프로필이 100% 완성되고 아직 보상을 받지 않은 경우
            if (completionInfo.isComplete && !hasReceivedReward) {
                try {
                    // 포인트 지급 (일일 한도 무시)
                    const rewardResult = PointsService.earnPoints(
                        userId,
                        this.COMPLETION_REWARD_POINTS,
                        'profile-completion',
                        `프로필 완성 보상 ${this.COMPLETION_REWARD_POINTS}포인트 지급`,
                        true // 일일 한도 무시
                    );

                    // 보상 지급 플래그 설정
                    user.profileCompletionReward = true;
                    user.profileCompletionDate = new Date().toISOString();
                    
                    // 사용자 데이터 저장
                    this.saveUsersData(usersData);

                    return {
                        success: true,
                        rewardGiven: true,
                        completionInfo,
                        rewardPoints: this.COMPLETION_REWARD_POINTS,
                        pointsResult: rewardResult,
                        message: `축하합니다! 프로필을 100% 완성하여 ${this.COMPLETION_REWARD_POINTS}포인트를 획득했습니다!`
                    };

                } catch (pointsError) {
                    console.error('프로필 완성 보상 지급 오류:', pointsError);
                    return {
                        success: false,
                        rewardGiven: false,
                        completionInfo,
                        error: '보상 지급 중 오류가 발생했습니다.',
                        details: pointsError.message
                    };
                }
            }

            // 프로필이 완성되지 않았거나 이미 보상을 받은 경우
            return {
                success: true,
                rewardGiven: false,
                completionInfo,
                hasReceivedReward,
                message: completionInfo.isComplete 
                    ? '이미 프로필 완성 보상을 받으셨습니다.'
                    : `프로필 완성도: ${completionInfo.percentage}% (${completionInfo.missingFields.length}개 항목 미완성)`
            };

        } catch (error) {
            console.error('프로필 완성 체크 오류:', error);
            return {
                success: false,
                rewardGiven: false,
                error: '프로필 완성 체크 중 오류가 발생했습니다.',
                details: error.message
            };
        }
    }

    /**
     * 사용자의 프로필 완성 상태 조회
     * @param {string} userId - 사용자 ID
     * @returns {Object} 프로필 완성 상태 정보
     */
    static getProfileCompletionStatus(userId) {
        try {
            const usersData = this.readUsersData();
            const user = usersData.find(user => user.id === userId);
            
            if (!user) {
                throw new Error('사용자를 찾을 수 없습니다.');
            }

            const profile = user.profile || {};
            const completionInfo = this.calculateCompletionPercentage(profile);
            
            return {
                success: true,
                userId,
                completionInfo,
                hasReceivedReward: user.profileCompletionReward === true,
                rewardDate: user.profileCompletionDate || null,
                rewardPoints: this.COMPLETION_REWARD_POINTS
            };

        } catch (error) {
            console.error('프로필 완성 상태 조회 오류:', error);
            return {
                success: false,
                error: '프로필 완성 상태 조회 중 오류가 발생했습니다.',
                details: error.message
            };
        }
    }

    /**
     * 프로필 완성을 위한 가이드 제공
     * @param {Object} profile - 현재 프로필
     * @returns {Object} 완성 가이드 정보
     */
    static getCompletionGuide(profile) {
        const completionInfo = this.calculateCompletionPercentage(profile);
        
        // 필수 필드 중 미완성 항목
        const requiredMissing = completionInfo.missingFields.filter(field => field.required);
        
        // 선택 필드 중 가중치가 높은 미완성 항목
        const optionalHighWeight = completionInfo.missingFields
            .filter(field => !field.required && field.weight >= 10)
            .sort((a, b) => b.weight - a.weight);

        return {
            currentPercentage: completionInfo.percentage,
            isComplete: completionInfo.isComplete,
            requiredMissing,
            recommendedNext: optionalHighWeight.slice(0, 3), // 상위 3개 추천
            totalMissing: completionInfo.missingFields.length,
            rewardPoints: this.COMPLETION_REWARD_POINTS,
            guide: {
                step1: '필수 정보를 먼저 입력하세요 (이름, 나이, 성별, 활동 수준)',
                step2: '건강 목표와 식단 선호도를 설정하면 큰 점수를 얻을 수 있습니다',
                step3: '나머지 선택 항목들을 채워서 100% 완성하세요'
            }
        };
    }
}

module.exports = ProfileCompletionService;