const fs = require('fs');
const path = require('path');

/**
 * 포인트 관리 서비스
 * 포인트 적립, 차감, 일일 한도 검증 등의 로직을 담당
 */

class PointsService {
    /**
     * 사용자 데이터 파일 경로
     */
    static get USERS_FILE_PATH() {
        return this._usersFilePath || path.join(__dirname, '../data/users.json');
    }

    static set USERS_FILE_PATH(filePath) {
        this._usersFilePath = filePath;
    }

    /**
     * 사용자 데이터 읽기
     */
    static readUsersData() {
        try {
            const data = fs.readFileSync(this.USERS_FILE_PATH, 'utf8');
            const parsed = JSON.parse(data);
            // users 필드가 객체면 배열로 변환
            if (parsed.users && typeof parsed.users === 'object') {
                return Object.values(parsed.users);
            }
            // 배열 형태면 그대로 반환
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error('사용자 데이터 읽기 오류:', error);
            throw new Error('사용자 데이터를 읽을 수 없습니다.');
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
     * 특정 사용자 찾기
     */
    static findUser(userId) {
        const usersData = this.readUsersData();
        const user = usersData.find(user => user.id === userId);
        
        if (!user) {
            throw new Error('사용자를 찾을 수 없습니다.');
        }

        // gamePoints 필드가 없으면 초기화
        if (!user.gamePoints) {
            user.gamePoints = {
                totalPoints: 0,
                dailyEarned: 0,
                dailyLimit: 100, // 일일 한도를 100으로 복원
                lastEarnedDate: null,
                history: []
            };
        }

        return { user, usersData };
    }

    /**
     * 오늘 날짜 문자열 반환 (YYYY-MM-DD 형식)
     */
    static getTodayString() {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * 일일 한도 초기화 확인 및 처리
     * 자정 기준으로 일일 한도를 초기화하고 필요시 데이터를 저장
     */
    static checkAndResetDailyLimit(user, usersData = null) {
        const today = this.getTodayString();
        let needsSave = false;
        
        // 날짜가 바뀌었으면 일일 한도 초기화
        if (user.gamePoints.lastEarnedDate !== today) {
            user.gamePoints.dailyEarned = 0;
            user.gamePoints.lastEarnedDate = today;
            needsSave = true;
            
            // 게임 통계도 초기화
            if (user.gameStats) {
                user.gameStats.dailyGamesPlayed = 0;
                user.gameStats.dailyBestScores = {};
            }
        }
        
        // 데이터 저장이 필요하고 usersData가 제공된 경우 저장
        if (needsSave && usersData) {
            this.saveUsersData(usersData);
        }
        
        return needsSave;
    }

    /**
     * 모든 사용자의 일일 한도를 확인하고 필요시 초기화
     * 스케줄러나 서버 시작 시 호출하여 자정 초기화 보장
     */
    static resetAllUsersDailyLimits() {
        try {
            const usersData = this.readUsersData();
            let hasChanges = false;
            
            usersData.forEach(user => {
                if (user.gamePoints) {
                    const wasReset = this.checkAndResetDailyLimit(user);
                    if (wasReset) {
                        hasChanges = true;
                    }
                }
            });
            
            if (hasChanges) {
                this.saveUsersData(usersData);
            }
            
            return hasChanges;
            
            return hasChanges;
        } catch (error) {
            console.error('일일 한도 초기화 오류:', error);
            return false;
        }
    }

    /**
     * 포인트 적립
     * @param {string} userId - 사용자 ID
     * @param {number} points - 적립할 포인트
     * @param {string} source - 포인트 획득 소스 (게임명 등)
     * @param {string} description - 상세 설명
     * @param {boolean} bypassDailyLimit - 일일 한도 무시 여부 (기본값: false)
     * @returns {Object} 적립 결과
     */
    static earnPoints(userId, points, source = 'game', description = '', bypassDailyLimit = false) {
        const { user, usersData } = this.findUser(userId);
        
        // 일일 한도 확인 및 초기화
        this.checkAndResetDailyLimit(user);
        
        // 포인트 유효성 검사
        if (points <= 0) {
            throw new Error('적립할 포인트는 0보다 커야 합니다.');
        }

        let actualPoints = points;
        let dailyEarnedIncrement = 0;

        // 일일 한도 체크 (프로필 완성 등 특별 보상은 제외)
        if (!bypassDailyLimit) {
            const remainingDaily = user.gamePoints.dailyLimit - user.gamePoints.dailyEarned;
            if (remainingDaily <= 0) {
                throw new Error('오늘의 포인트 획득 한도에 도달했습니다. 내일 다시 도전해보세요!');
            }
            // 실제 적립할 포인트 (일일 한도 초과 방지)
            actualPoints = Math.min(points, remainingDaily);
            dailyEarnedIncrement = actualPoints;
            
            // 요청한 포인트보다 적게 적립되는 경우 알림
            if (actualPoints < points) {
                console.warn(`일일 한도로 인해 포인트 적립량 조정: ${points} -> ${actualPoints}`);
            }
        } else {
            // 일일 한도를 무시하는 경우 (프로필 완성 보상 등)
            actualPoints = points;
            dailyEarnedIncrement = 0; // 일일 획득량에 포함하지 않음
        }
        
        // 포인트 적립
        user.gamePoints.totalPoints += actualPoints;
        user.gamePoints.dailyEarned += dailyEarnedIncrement;
        
        // 내역 추가
        const transaction = {
            id: Date.now().toString(),
            type: 'earn',
            amount: actualPoints,
            source: source,
            timestamp: new Date().toISOString(),
            description: description || `${source}에서 ${actualPoints}포인트 획득`,
            bypassedDailyLimit: bypassDailyLimit
        };
        
        user.gamePoints.history.push(transaction);
        
        // 데이터 저장
        this.saveUsersData(usersData);
        
        return {
            success: true,
            earnedPoints: actualPoints,
            totalPoints: user.gamePoints.totalPoints,
            dailyEarned: user.gamePoints.dailyEarned,
            dailyRemaining: user.gamePoints.dailyLimit - user.gamePoints.dailyEarned,
            transaction: transaction,
            bypassedDailyLimit: bypassDailyLimit
        };
    }

    /**
     * 포인트 사용
     * @param {string} userId - 사용자 ID
     * @param {number} points - 사용할 포인트
     * @param {string} purpose - 사용 목적
     * @param {string} description - 상세 설명
     * @returns {Object} 사용 결과
     */
    static usePoints(userId, points, purpose = 'purchase', description = '') {
        const { user, usersData } = this.findUser(userId);
        
        // 포인트 유효성 검사
        if (points <= 0) {
            throw new Error('사용할 포인트는 0보다 커야 합니다.');
        }

        // 보유 포인트 확인
        if (user.gamePoints.totalPoints < points) {
            throw new Error('보유 포인트가 부족합니다.');
        }

        // 포인트 차감
        user.gamePoints.totalPoints -= points;
        
        // 내역 추가
        const transaction = {
            id: Date.now().toString(),
            type: 'use',
            amount: points,
            source: purpose,
            timestamp: new Date().toISOString(),
            description: description || `${purpose}에서 ${points}포인트 사용`
        };
        
        user.gamePoints.history.push(transaction);
        
        // 데이터 저장
        this.saveUsersData(usersData);
        
        return {
            success: true,
            usedPoints: points,
            totalPoints: user.gamePoints.totalPoints,
            transaction: transaction
        };
    }

    /**
     * 현재 포인트 잔액 조회
     * @param {string} userId - 사용자 ID
     * @returns {Object} 포인트 정보
     */
    static getPointsBalance(userId) {
        const { user } = this.findUser(userId);
        
        // 일일 한도 확인 및 초기화
        this.checkAndResetDailyLimit(user);
        
        return {
            totalPoints: user.gamePoints.totalPoints,
            dailyEarned: user.gamePoints.dailyEarned,
            dailyLimit: user.gamePoints.dailyLimit,
            dailyRemaining: user.gamePoints.dailyLimit - user.gamePoints.dailyEarned,
            lastEarnedDate: user.gamePoints.lastEarnedDate
        };
    }

    /**
     * 포인트 사용 내역 조회
     * @param {string} userId - 사용자 ID
     * @param {number} limit - 조회할 내역 수 (기본값: 50)
     * @returns {Array} 포인트 내역
     */
    static getPointsHistory(userId, limit = 50) {
        const { user } = this.findUser(userId);
        
        // 최신 내역부터 반환
        return user.gamePoints.history
            .slice(-limit)
            .reverse();
    }

    /**
     * 게임 점수를 포인트로 변환
     * @param {number} gameScore - 게임 점수
     * @param {string} gameType - 게임 타입
     * @returns {number} 변환된 포인트
     */
    static convertScoreToPoints(gameScore, gameType) {
        // 게임별 설정
        const gameConfigs = {
            'snake-game': {
                maxPoints: 30,
                scoreMultiplier: 0.04
            },
            'memory-game': {
                maxPoints: 40,
                scoreMultiplier: 0.03
            },
                    'puzzle-game': {
            maxPoints: 60,  // 획득 가능 포인트 최대값
            scoreMultiplier: 0.04  // 0.06에서 0.04으로 감소
        }
        };

        const config = gameConfigs[gameType];
        if (!config) {
            throw new Error('지원하지 않는 게임 타입입니다.');
        }

        // 점수를 포인트로 변환 (최대값 제한)
        const convertedPoints = Math.floor(gameScore * config.scoreMultiplier);
        let finalPoints = Math.min(convertedPoints, config.maxPoints);
        
        // 최소 1포인트 보장 (게임을 완료했다면 최소 1포인트는 받아야 함)
        // 단, 점수가 0점이면 포인트도 0이어야 함
        if (finalPoints === 0 && gameScore > 0) {
            finalPoints = 1;
        }
        
        // 0점일 때는 포인트 적립 불가
        if (gameScore === 0) {
            finalPoints = 0;
        }
        
        // 디버깅 로그 추가
        console.log(`포인트 변환 디버깅:`, {
            gameScore,
            gameType,
            scoreMultiplier: config.scoreMultiplier,
            convertedPoints,
            maxPoints: config.maxPoints,
            finalPoints,
            calculation: `${gameScore} * ${config.scoreMultiplier} = ${gameScore * config.scoreMultiplier}`,
            floorResult: `Math.floor(${gameScore * config.scoreMultiplier}) = ${convertedPoints}`,
            minResult: `Math.min(${convertedPoints}, ${config.maxPoints}) = ${Math.min(convertedPoints, config.maxPoints)}`
        });
        
        return finalPoints;
    }

    /**
     * 게임 점수 검증 (보안 강화)
     * @param {number} gameScore - 게임 점수
     * @param {string} gameType - 게임 타입
     * @param {number} playTime - 플레이 시간 (초)
     * @returns {Object} 검증 결과 객체 { valid: boolean, reason?: string }
     */
    static validateGameScore(gameScore, gameType, playTime) {
        // 기본 검증
        if (typeof gameScore !== 'number' || gameScore < 0) {
            console.warn(`점수 검증 실패 - 유효하지 않은 점수: ${gameScore}`);
            return { valid: false, reason: '유효하지 않은 점수입니다.' };
        }

        if (typeof playTime !== 'number' || playTime < 0) {
            console.warn(`점수 검증 실패 - 유효하지 않은 플레이 시간: ${playTime}`);
            return { valid: false, reason: '유효하지 않은 플레이 시간입니다.' };
        }

        // 게임별 최대 점수 검증 (더 관대하게 조정)
        const gameValidation = {
            'snake-game': {
                maxScore: 3000,
                minPlayTime: 3, // 최소 3초로 더 줄임
                maxScorePerSecond: 200, // 초당 최대 200점으로 더 늘림
                reasonableMaxScore: 2500, // 일반적인 최대 점수
                gameName: '스네이크 게임'
            },
            'memory-game': {
                maxScore: 1200,
                minPlayTime: 5, // 최소 5초로 더 줄임
                maxScorePerSecond: 100, // 초당 최대 100점으로 늘림
                reasonableMaxScore: 1000,
                gameName: '기억력 게임'
            },
            'puzzle-game': {
                maxScore: 1800,
                minPlayTime: 3, // 최소 3초로 더 줄임 (빠른 완료 허용)
                maxScorePerSecond: 120, // 초당 최대 120점으로 늘림
                reasonableMaxScore: 1500,
                gameName: '퍼즐 게임'
            }
        };

        const validation = gameValidation[gameType];
        if (!validation) {
            console.warn(`점수 검증 실패 - 지원하지 않는 게임 타입: ${gameType}`);
            return { valid: false, reason: '지원하지 않는 게임입니다.' };
        }

        // 절대 최대 점수 검증
        if (gameScore > validation.maxScore) {
            console.warn(`점수 검증 실패 - 최대 점수 초과: ${gameScore} > ${validation.maxScore} (${gameType})`);
            return { 
                valid: false, 
                reason: `${validation.gameName}의 최대 점수(${validation.maxScore}점)를 초과했습니다.` 
            };
        }

        // 최소 플레이 시간 검증
        if (playTime < validation.minPlayTime) {
            console.warn(`점수 검증 실패 - 최소 플레이 시간 미달: ${playTime} < ${validation.minPlayTime} (${gameType})`);
            return { 
                valid: false, 
                reason: `최소 플레이 시간(${validation.minPlayTime}초)을 만족하지 않습니다. 더 오래 플레이해주세요.` 
            };
        }

        // 초당 점수 비율 검증 (비현실적인 점수 방지) - 더 관대하게 조정
        const scorePerSecond = gameScore / playTime;
        if (scorePerSecond > validation.maxScorePerSecond) {
            console.warn(`점수 검증 실패 - 초당 점수 과다: ${scorePerSecond} > ${validation.maxScorePerSecond} (${gameType})`);
            return { 
                valid: false, 
                reason: `플레이 시간 대비 점수가 비정상적으로 높습니다. 정상적으로 게임을 플레이해주세요.` 
            };
        }

        // 합리적인 점수 범위 검증 (경고만 출력)
        if (gameScore > validation.reasonableMaxScore) {
            console.warn(`높은 점수 감지: ${gameScore} (${gameType}), 플레이 시간: ${playTime}초`);
        }

        // 플레이 시간 대비 점수 패턴 검증
        const patternCheck = this.isUnrealisticScorePattern(gameScore, gameType, playTime);
        if (patternCheck.isUnrealistic) {
            console.warn(`점수 검증 실패 - 비현실적인 점수 패턴: ${gameScore}점, ${playTime}초 (${gameType})`);
            return { 
                valid: false, 
                reason: patternCheck.reason || '비정상적인 게임 플레이 패턴이 감지되었습니다.' 
            };
        }

        return { valid: true };
    }

    /**
     * 비현실적인 점수 패턴 감지
     * @param {number} gameScore - 게임 점수
     * @param {string} gameType - 게임 타입
     * @param {number} playTime - 플레이 시간 (초)
     * @returns {Object} 패턴 검증 결과 { isUnrealistic: boolean, reason?: string }
     */
    static isUnrealisticScorePattern(gameScore, gameType, playTime) {
        // 게임별 특수 패턴 검증 (더 관대하게 조정)
        switch (gameType) {
            case 'snake-game':
                // 뱀 게임: 너무 짧은 시간에 높은 점수는 불가능
                if (playTime < 5 && gameScore > 1500) {
                    return { 
                        isUnrealistic: true, 
                        reason: '스네이크 게임에서 5초 미만으로 1500점 이상을 획득하는 것은 불가능합니다.' 
                    };
                }
                if (playTime < 10 && gameScore > 2000) {
                    return { 
                        isUnrealistic: true, 
                        reason: '스네이크 게임에서 10초 미만으로 2000점 이상을 획득하는 것은 불가능합니다.' 
                    };
                }
                if (playTime < 20 && gameScore > 2500) {
                    return { 
                        isUnrealistic: true, 
                        reason: '스네이크 게임에서 20초 미만으로 2500점 이상을 획득하는 것은 불가능합니다.' 
                    };
                }
                break;
                
            case 'memory-game':
                // 기억력 게임: 카드 수에 따른 최소 시간 필요
                if (playTime < 5 && gameScore > 1000) {
                    return { 
                        isUnrealistic: true, 
                        reason: '기억력 게임에서 5초 미만으로 1000점 이상을 획득하는 것은 불가능합니다.' 
                    };
                }
                if (playTime < 10 && gameScore > 1200) {
                    return { 
                        isUnrealistic: true, 
                        reason: '기억력 게임에서 10초 미만으로 1200점 이상을 획득하는 것은 불가능합니다.' 
                    };
                }
                if (playTime < 20 && gameScore > 1500) {
                    return { 
                        isUnrealistic: true, 
                        reason: '기억력 게임에서 20초 미만으로 1500점 이상을 획득하는 것은 불가능합니다.' 
                    };
                }
                break;
                
            case 'puzzle-game':
                // 퍼즐 게임: 조각 배치에 시간 필요 (더 관대하게)
                if (playTime < 3 && gameScore > 1500) {
                    return { 
                        isUnrealistic: true, 
                        reason: '퍼즐 게임에서 3초 미만으로 1500점 이상을 획득하는 것은 불가능합니다.' 
                    };
                }
                if (playTime < 10 && gameScore > 1800) {
                    return { 
                        isUnrealistic: true, 
                        reason: '퍼즐 게임에서 10초 미만으로 1800점 이상을 획득하는 것은 불가능합니다.' 
                    };
                }
                if (playTime < 20 && gameScore > 2000) {
                    return { 
                        isUnrealistic: true, 
                        reason: '퍼즐 게임에서 20초 미만으로 2000점 이상을 획득하는 것은 불가능합니다.' 
                    };
                }
                break;
        }

        // 일반적인 비현실적 패턴 (더 관대하게 조정)
        // 1. 너무 완벽한 점수 (라운드 넘버) - 더 높은 임계값
        if (gameScore > 1000 && gameScore % 100 === 0 && playTime < 10) {
            return { 
                isUnrealistic: true, 
                reason: '매우 짧은 시간에 정확히 100의 배수 점수를 획득하는 것은 의심스럽습니다.' 
            };
        }

        // 2. 플레이 시간이 너무 일정한 패턴 (봇 의심) - 더 높은 점수 임계값
        if (playTime % 10 === 0 && gameScore > 2000) {
            return { 
                isUnrealistic: true, 
                reason: '정확히 10초 단위로 끝나는 매우 높은 점수는 의심스럽습니다.' 
            };
        }

        return { isUnrealistic: false };
    }

    /**
     * 게임별 최대 점수 제한 확인
     * @param {number} gameScore - 게임 점수
     * @param {string} gameType - 게임 타입
     * @returns {Object} 검증 결과와 제한 정보
     */
    static checkScoreLimit(gameScore, gameType) {
        const limits = {
            'snake-game': { max: 2500, reasonable: 2000 },
            'memory-game': { max: 2500, reasonable: 2000 },
            'puzzle-game': { max: 3000, reasonable: 2500 }
        };

        const limit = limits[gameType];
        if (!limit) {
            return { valid: false, reason: '지원하지 않는 게임 타입' };
        }

        if (gameScore > limit.max) {
            return { 
                valid: false, 
                reason: `최대 점수 초과 (${limit.max}점 초과)`,
                maxScore: limit.max
            };
        }

        if (gameScore > limit.reasonable) {
            return { 
                valid: true, 
                warning: `높은 점수 (일반적 최대: ${limit.reasonable}점)`,
                reasonableMax: limit.reasonable
            };
        }

        return { valid: true };
    }

    /**
     * 게임별 리더보드 조회
     * @param {string} gameId - 게임 ID
     * @param {number} limit - 조회할 상위 순위 수
     * @param {string} currentUserId - 현재 사용자 ID (선택적)
     * @param {number} currentScore - 현재 사용자의 최신 점수 (선택적)
     * @returns {Array} 리더보드 데이터
     */
    static getGameLeaderboard(gameId, limit = 10, currentUserId = null, currentScore = null) {
        try {
            const usersData = this.readUsersData();
            const leaderboard = [];
            
            // 게임별 최고 점수 추출
            usersData.forEach(user => {
                if (user.gamePoints && user.gamePoints.history) {
                    // 해당 게임의 최고 점수 찾기
                    const gameTransactions = user.gamePoints.history.filter(transaction => 
                        transaction.source === 'mini-game' && 
                        transaction.description && 
                        transaction.description.includes(this.getGameName(gameId))
                    );
                    
                    if (gameTransactions.length > 0) {
                        // 점수 추출 (예: "스네이크 게임에서 1250점 획득" -> 1250)
                        const scores = gameTransactions.map(transaction => {
                            const scoreMatch = transaction.description.match(/(\d+)점 획득/);
                            return scoreMatch ? parseInt(scoreMatch[1]) : 0;
                        });
                        
                        const bestScore = Math.max(...scores);
                        
                        if (bestScore > 0) {
                            // 플레이어 이름 결정 로직
                            let playerName = user.name || user.username;
                            if (!playerName && user.email) {
                                // 이메일의 앞 4글자 사용 (@ 앞부분에서)
                                const emailPrefix = user.email.split('@')[0];
                                playerName = emailPrefix.substring(0, 4) + '****';
                            }
                            if (!playerName) {
                                playerName = '익명';
                            }
                            
                            leaderboard.push({
                                userId: user.id,
                                playerName: playerName,
                                score: bestScore,
                                gameId: gameId
                            });
                        }
                    }
                }
            });
            
            // 현재 사용자의 최신 점수가 있고, 아직 리더보드에 없는 경우 추가
            if (currentUserId && currentScore && currentScore > 0) {
                const currentUser = usersData.find(user => user.id === currentUserId);
                if (currentUser) {
                    // 플레이어 이름 결정 로직
                    let playerName = currentUser.name || currentUser.username;
                    if (!playerName && currentUser.email) {
                        // 이메일의 앞 4글자 사용 (@ 앞부분에서)
                        const emailPrefix = currentUser.email.split('@')[0];
                        playerName = emailPrefix.substring(0, 4) + '****';
                    }
                    if (!playerName) {
                        playerName = '익명';
                    }
                    
                    // 현재 사용자가 이미 리더보드에 있는지 확인
                    const existingEntry = leaderboard.find(entry => entry.userId === currentUserId);
                    
                    if (existingEntry) {
                        // 기존 점수보다 높으면 업데이트
                        if (currentScore > existingEntry.score) {
                            existingEntry.score = currentScore;
                        }
                    } else {
                        // 새로운 항목 추가
                        leaderboard.push({
                            userId: currentUserId,
                            playerName: playerName,
                            score: currentScore,
                            gameId: gameId
                        });
                    }
                }
            }
            
            // 점수 기준 내림차순 정렬
            leaderboard.sort((a, b) => b.score - a.score);
            
            // 상위 limit개만 반환
            return leaderboard.slice(0, limit);
            
        } catch (error) {
            console.error('리더보드 조회 오류:', error);
            return [];
        }
    }
    
    /**
     * 게임 ID를 게임 이름으로 변환
     * @param {string} gameId - 게임 ID
     * @returns {string} 게임 이름
     */
    static getGameName(gameId) {
        const gameNames = {
            'snake-game': '스네이크',
            'memory-game': '기억력',
            'puzzle-game': '퍼즐'
        };
        
        return gameNames[gameId] || '게임';
    }

    /**
     * 모든 게임의 전체 최고 점수 조회
     * @returns {Object} 게임별 최고 점수 객체
     */
    static getAllGamesHighScores() {
        try {
            const gameIds = ['snake-game', 'memory-game', 'puzzle-game'];
            const globalHighScores = {};
            
            gameIds.forEach(gameId => {
                const leaderboard = this.getGameLeaderboard(gameId, 1); // 1위만 조회
                globalHighScores[gameId] = leaderboard.length > 0 ? leaderboard[0].score : 0;
            });
            
            return globalHighScores;
        } catch (error) {
            console.error('전체 최고 점수 조회 오류:', error);
            return {
                'snake-game': 0,
                'memory-game': 0,
                'puzzle-game': 0
            };
        }
    }
}

module.exports = PointsService;