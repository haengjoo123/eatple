const fs = require('fs');
const path = require('path');
const PointsService = require('./pointsService');

/**
 * 주간 리더보드 관리 서비스
 * 매주 월요일 00:00에 리더보드 초기화 및 보상 지급
 */
class WeeklyLeaderboardService {
    static get LEADERBOARD_FILE_PATH() {
        return this._leaderboardFilePath || path.join(__dirname, '../data/weekly-leaderboard.json');
    }

    static set LEADERBOARD_FILE_PATH(filePath) {
        this._leaderboardFilePath = filePath;
    }

    /**
     * 주간 리더보드 데이터 읽기
     */
    static readLeaderboardData() {
        try {
            if (!fs.existsSync(this.LEADERBOARD_FILE_PATH)) {
                // 파일이 없으면 초기 데이터 생성
                const initialData = this.createInitialLeaderboardData();
                this.saveLeaderboardData(initialData);
                return initialData;
            }

            const data = fs.readFileSync(this.LEADERBOARD_FILE_PATH, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('주간 리더보드 데이터 읽기 오류:', error);
            // 오류 시 초기 데이터 반환
            return this.createInitialLeaderboardData();
        }
    }

    /**
     * 주간 리더보드 데이터 저장
     */
    static saveLeaderboardData(data) {
        try {
            // 디렉토리가 없으면 생성
            const dir = path.dirname(this.LEADERBOARD_FILE_PATH);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(this.LEADERBOARD_FILE_PATH, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('주간 리더보드 데이터 저장 오류:', error);
            throw new Error('주간 리더보드 데이터를 저장할 수 없습니다.');
        }
    }

    /**
     * 초기 리더보드 데이터 생성
     */
    static createInitialLeaderboardData() {
        const currentWeek = this.getCurrentWeekInfo();
        
        return {
            currentWeek: currentWeek,
            leaderboards: {
                'snake-game': [],
                'memory-game': [],
                'puzzle-game': []
            },
            history: [],
            lastResetDate: currentWeek.startDate,
            nextResetDate: currentWeek.endDate
        };
    }

    /**
     * 현재 주차 정보 계산 (월요일 시작)
     */
    static getCurrentWeekInfo() {
        const now = new Date();
        const currentDay = now.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
        
        // 이번 주 월요일 계산
        const daysToMonday = currentDay === 0 ? -6 : 1 - currentDay;
        const monday = new Date(now);
        monday.setDate(now.getDate() + daysToMonday);
        monday.setHours(0, 0, 0, 0);
        
        // 다음 주 월요일 계산
        const nextMonday = new Date(monday);
        nextMonday.setDate(monday.getDate() + 7);
        
        return {
            weekNumber: this.getWeekNumber(monday),
            year: monday.getFullYear(),
            startDate: monday.toISOString(),
            endDate: nextMonday.toISOString(),
            displayText: `${monday.getFullYear()}년 ${monday.getMonth() + 1}월 ${monday.getDate()}일 주차`
        };
    }

    /**
     * 주차 번호 계산 (연도 기준)
     */
    static getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    /**
     * 주간 리더보드 업데이트 (게임 점수 제출 시 호출)
     */
    static updateWeeklyLeaderboard(userId, gameId, score, playerName) {
        try {
            const data = this.readLeaderboardData();
            
            // 스케줄러에 의해서만 초기화되므로 별도 체크 불필요
            // 단순히 현재 주차 데이터에 점수 추가
            return this.addScoreToLeaderboard(data, userId, gameId, score, playerName);
            
        } catch (error) {
            console.error('주간 리더보드 업데이트 오류:', error);
            return false;
        }
    }

    /**
     * 리더보드에 점수 추가/업데이트
     */
    static addScoreToLeaderboard(data, userId, gameId, score, playerName) {
        try {
            if (!data.leaderboards[gameId]) {
                data.leaderboards[gameId] = [];
            }

            const leaderboard = data.leaderboards[gameId];
            const existingEntry = leaderboard.find(entry => entry.userId === userId);

            if (existingEntry) {
                // 기존 점수보다 높으면 업데이트
                if (score > existingEntry.score) {
                    existingEntry.score = score;
                    existingEntry.lastUpdated = new Date().toISOString();
                }
            } else {
                // 새 항목 추가
                leaderboard.push({
                    userId: userId,
                    playerName: playerName,
                    score: score,
                    gameId: gameId,
                    firstRecorded: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                });
            }

            // 점수 기준 내림차순 정렬
            leaderboard.sort((a, b) => b.score - a.score);

            // 상위 100명만 유지 (메모리 절약)
            if (leaderboard.length > 100) {
                data.leaderboards[gameId] = leaderboard.slice(0, 100);
            }

            this.saveLeaderboardData(data);
            return true;

        } catch (error) {
            console.error('리더보드 점수 추가 오류:', error);
            return false;
        }
    }

    /**
     * 리더보드 초기화 필요 여부 확인
     */
    static shouldResetLeaderboard(currentWeekData, newWeekData) {
        if (!currentWeekData || !newWeekData) return true;
        
        return currentWeekData.weekNumber !== newWeekData.weekNumber || 
               currentWeekData.year !== newWeekData.year;
    }

    /**
     * 주간 리더보드 초기화 및 보상 지급
     */
    static resetWeeklyLeaderboard() {
        try {
            console.log('🏆 주간 리더보드 초기화 시작...');
            
            const data = this.readLeaderboardData();
            const currentWeek = this.getCurrentWeekInfo();
            
            // 보상 지급
            const rewardResults = this.distributeWeeklyRewards(data);
            
            // 이전 주차 데이터를 히스토리에 저장
            if (data.currentWeek && Object.keys(data.leaderboards).some(gameId => data.leaderboards[gameId].length > 0)) {
                data.history.push({
                    week: data.currentWeek,
                    leaderboards: JSON.parse(JSON.stringify(data.leaderboards)), // 깊은 복사
                    rewards: rewardResults,
                    resetDate: new Date().toISOString()
                });
            }

            // 히스토리는 최근 12주만 유지
            if (data.history.length > 12) {
                data.history = data.history.slice(-12);
            }

            // 새 주차로 초기화
            data.currentWeek = currentWeek;
            data.leaderboards = {
                'snake-game': [],
                'memory-game': [],
                'puzzle-game': []
            };
            data.lastResetDate = new Date().toISOString();
            data.nextResetDate = currentWeek.endDate;

            this.saveLeaderboardData(data);
            
            console.log('✅ 주간 리더보드 초기화 완료');
            console.log(`📊 보상 지급 결과:`, rewardResults);
            
            return rewardResults;

        } catch (error) {
            console.error('❌ 주간 리더보드 초기화 오류:', error);
            return null;
        }
    }

    /**
     * 주간 보상 지급
     */
    static distributeWeeklyRewards(data) {
        const rewardResults = {
            totalRewardsGiven: 0,
            gameRewards: {}
        };

        const rewardAmounts = {
            1: 500, // 1등: 500포인트
            2: 300, // 2등: 300포인트
            3: 200  // 3등: 200포인트
        };

        try {
            Object.keys(data.leaderboards).forEach(gameId => {
                const leaderboard = data.leaderboards[gameId];
                const gameRewards = [];

                if (leaderboard.length > 0) {
                    // 상위 3명에게 보상 지급
                    for (let rank = 1; rank <= Math.min(3, leaderboard.length); rank++) {
                        const player = leaderboard[rank - 1];
                        const rewardPoints = rewardAmounts[rank];

                        try {
                            // 포인트 지급 (일일 한도 무시)
                            const result = PointsService.earnPoints(
                                player.userId,
                                rewardPoints,
                                'weekly-leaderboard',
                                `${this.getGameDisplayName(gameId)} 주간 리더보드 ${rank}등 보상`,
                                true // 일일 한도 무시
                            );

                            gameRewards.push({
                                rank: rank,
                                userId: player.userId,
                                playerName: player.playerName,
                                score: player.score,
                                rewardPoints: rewardPoints,
                                success: true
                            });

                            rewardResults.totalRewardsGiven += rewardPoints;

                            console.log(`🎉 ${this.getGameDisplayName(gameId)} ${rank}등 보상 지급: ${player.playerName} (${rewardPoints}P)`);

                        } catch (error) {
                            console.error(`보상 지급 실패: ${player.playerName} (${gameId} ${rank}등)`, error);
                            
                            gameRewards.push({
                                rank: rank,
                                userId: player.userId,
                                playerName: player.playerName,
                                score: player.score,
                                rewardPoints: rewardPoints,
                                success: false,
                                error: error.message
                            });
                        }
                    }
                }

                rewardResults.gameRewards[gameId] = gameRewards;
            });

        } catch (error) {
            console.error('보상 지급 중 오류:', error);
        }

        return rewardResults;
    }

    /**
     * 게임 표시 이름 반환
     */
    static getGameDisplayName(gameId) {
        const gameNames = {
            'snake-game': '스네이크 게임',
            'memory-game': '기억력 게임',
            'puzzle-game': '퍼즐 게임'
        };
        return gameNames[gameId] || gameId;
    }

    /**
     * 현재 주간 리더보드 조회
     */
    static getCurrentWeeklyLeaderboard(gameId, limit = 10) {
        try {
            const data = this.readLeaderboardData();
            
            return {
                leaderboard: data.leaderboards[gameId]?.slice(0, limit) || [],
                weekInfo: data.currentWeek,
                nextResetDate: data.nextResetDate,
                timeUntilReset: this.getTimeUntilReset()
            };

        } catch (error) {
            console.error('주간 리더보드 조회 오류:', error);
            return {
                leaderboard: [],
                weekInfo: this.getCurrentWeekInfo(),
                nextResetDate: null,
                timeUntilReset: { days: 0, hours: 0, minutes: 0, totalMilliseconds: 0 }
            };
        }
    }

    /**
     * 리더보드 히스토리 조회
     */
    static getLeaderboardHistory(limit = 5) {
        try {
            const data = this.readLeaderboardData();
            return data.history.slice(-limit).reverse(); // 최신순
        } catch (error) {
            console.error('리더보드 히스토리 조회 오류:', error);
            return [];
        }
    }

    /**
     * 다음 초기화까지 남은 시간 계산
     */
    static getTimeUntilReset() {
        try {
            const data = this.readLeaderboardData();
            const now = new Date();
            const resetDate = new Date(data.nextResetDate);
            
            const timeDiff = resetDate.getTime() - now.getTime();
            
            if (timeDiff <= 0) {
                return {
                    days: 0,
                    hours: 0,
                    minutes: 0,
                    totalMilliseconds: 0
                };
            }

            const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

            return {
                days,
                hours,
                minutes,
                totalMilliseconds: timeDiff
            };

        } catch (error) {
            console.error('초기화 시간 계산 오류:', error);
            return {
                days: 0,
                hours: 0,
                minutes: 0,
                totalMilliseconds: 0
            };
        }
    }

    /**
     * 주간 리더보드 스케줄러 시작
     */
    static startWeeklyScheduler() {
        // 다음 월요일 00:00까지의 시간 계산
        const now = new Date();
        let nextMonday = new Date(now);
        
        // 현재 요일 (0=일요일, 1=월요일, ..., 6=토요일)
        const currentDay = now.getDay();
        
        if (currentDay === 1 && now.getHours() === 0 && now.getMinutes() < 5) {
            // 현재가 월요일 00:00-00:05 사이라면 즉시 실행
            console.log('🏆 월요일 00:00 - 즉시 리더보드 초기화 실행');
            this.resetWeeklyLeaderboard();
            
            // 다음 주 월요일로 설정
            nextMonday.setDate(now.getDate() + 7);
        } else {
            // 다음 월요일 계산
            const daysUntilMonday = currentDay === 0 ? 1 : (8 - currentDay);
            nextMonday.setDate(now.getDate() + daysUntilMonday);
        }
        
        nextMonday.setHours(0, 0, 0, 0);
        const msUntilNextMonday = nextMonday.getTime() - now.getTime();
        
        console.log(`📅 다음 주간 리더보드 자동 초기화: ${nextMonday.toLocaleString('ko-KR')}`);
        console.log(`⏰ 남은 시간: ${Math.floor(msUntilNextMonday / (1000 * 60 * 60 * 24))}일 ${Math.floor((msUntilNextMonday % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))}시간 ${Math.floor((msUntilNextMonday % (1000 * 60 * 60)) / (1000 * 60))}분`);
        
        // 첫 번째 초기화 스케줄
        const firstTimeout = setTimeout(() => {
            console.log('🏆 자동 주간 리더보드 초기화 실행 - ' + new Date().toLocaleString('ko-KR'));
            this.resetWeeklyLeaderboard();
            
            // 이후 매주 월요일마다 반복 (7일 = 604800000ms)
            const weeklyInterval = setInterval(() => {
                console.log('🏆 자동 주간 리더보드 초기화 실행 - ' + new Date().toLocaleString('ko-KR'));
                this.resetWeeklyLeaderboard();
            }, 7 * 24 * 60 * 60 * 1000);
            
            // 인터벌 참조 저장 (필요시 정리용)
            this._weeklyInterval = weeklyInterval;
            
        }, msUntilNextMonday);
        
        // 타임아웃 참조 저장 (필요시 정리용)
        this._firstTimeout = firstTimeout;
        
        return {
            nextResetTime: nextMonday,
            msUntilReset: msUntilNextMonday
        };
    }

    /**
     * 사용자의 현재 주간 순위 조회
     */
    static getUserWeeklyRank(userId, gameId) {
        try {
            const data = this.readLeaderboardData();
            const leaderboard = data.leaderboards[gameId] || [];
            
            const userIndex = leaderboard.findIndex(entry => entry.userId === userId);
            
            if (userIndex === -1) {
                return {
                    rank: null,
                    score: 0,
                    totalPlayers: leaderboard.length
                };
            }

            return {
                rank: userIndex + 1,
                score: leaderboard[userIndex].score,
                totalPlayers: leaderboard.length
            };

        } catch (error) {
            console.error('사용자 주간 순위 조회 오류:', error);
            return {
                rank: null,
                score: 0,
                totalPlayers: 0
            };
        }
    }

    /**
     * 주간 리더보드 스케줄러 정리
     */
    static stopWeeklyScheduler() {
        if (this._firstTimeout) {
            clearTimeout(this._firstTimeout);
            this._firstTimeout = null;
            console.log('첫 번째 리더보드 초기화 타임아웃이 정리되었습니다.');
        }
        
        if (this._weeklyInterval) {
            clearInterval(this._weeklyInterval);
            this._weeklyInterval = null;
            console.log('주간 리더보드 초기화 인터벌이 정리되었습니다.');
        }
    }

    /**
     * 수동으로 리더보드 초기화 (관리자용)
     */
    static manualResetLeaderboard() {
        console.log('🔧 관리자에 의한 수동 리더보드 초기화 실행');
        return this.resetWeeklyLeaderboard();
    }
}

module.exports = WeeklyLeaderboardService;