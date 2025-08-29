/**
 * PointsManager - 클라이언트 사이드 포인트 관리 클래스
 * 포인트 적립, 사용, 잔액 조회 및 네트워크 오류 처리를 담당
 */
class PointsManager {
    constructor() {
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1초
        this.baseUrl = '/api/points';
    }

    /**
     * 현재 포인트 잔액 조회
     * @returns {Promise<Object>} 포인트 잔액 정보
     */
    async getCurrentBalance() {
        return this._makeRequestWithRetry('GET', `${this.baseUrl}/balance`);
    }

    /**
     * 포인트 적립 요청
     * @param {number} gameScore - 게임에서 획득한 점수
     * @param {string} gameType - 게임 타입 (snake-game, memory-game, puzzle-game)
     * @returns {Promise<Object>} 적립 결과
     */
    async earnPoints(gameScore, gameType) {
        const requestData = {
            score: gameScore,
            gameType: gameType,
            timestamp: new Date().toISOString()
        };

        return this._makeRequestWithRetry('POST', `${this.baseUrl}/earn`, requestData);
    }

    /**
     * 포인트 사용 처리
     * @param {number} amount - 사용할 포인트 양
     * @param {string} purpose - 사용 목적 (예: 'purchase', 'discount')
     * @returns {Promise<Object>} 사용 결과
     */
    async usePoints(amount, purpose = 'purchase') {
        const requestData = {
            amount: amount,
            purpose: purpose,
            timestamp: new Date().toISOString()
        };

        return this._makeRequestWithRetry('POST', `${this.baseUrl}/use`, requestData);
    }

    /**
     * 포인트 사용 내역 조회
     * @param {number} limit - 조회할 내역 수 (기본값: 10)
     * @returns {Promise<Object>} 포인트 내역
     */
    async getPointsHistory(limit = 10) {
        return this._makeRequestWithRetry('GET', `${this.baseUrl}/history?limit=${limit}`);
    }

    /**
     * 일일 포인트 한도 정보 조회
     * @returns {Promise<Object>} 일일 한도 정보
     */
    async getDailyLimitInfo() {
        return this._makeRequestWithRetry('GET', `${this.baseUrl}/daily-limit`);
    }

    /**
     * 게임 플레이 가능 여부 확인
     * @returns {Promise<Object>} 플레이 가능 여부 정보
     */
    async canPlayGame() {
        return this._makeRequestWithRetry('GET', `${this.baseUrl}/can-play`);
    }

    /**
     * 네트워크 요청을 재시도 로직과 함께 실행
     * @param {string} method - HTTP 메서드
     * @param {string} url - 요청 URL
     * @param {Object} data - 요청 데이터 (POST 요청 시)
     * @returns {Promise<Object>} 응답 데이터
     */
    async _makeRequestWithRetry(method, url, data = null) {
        let lastError = null;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await this._makeRequest(method, url, data);
                return response;
            } catch (error) {
                lastError = error;
                
                // 마지막 시도가 아니면 재시도
                if (attempt < this.maxRetries) {
                    console.warn(`포인트 API 요청 실패 (시도 ${attempt}/${this.maxRetries}):`, error.message);
                    await this._delay(this.retryDelay * attempt); // 지수 백오프
                    continue;
                }
            }
        }

        // 모든 재시도 실패 시 에러 처리
        throw this._handleError(lastError);
    }

    /**
     * 실제 HTTP 요청 실행
     * @param {string} method - HTTP 메서드
     * @param {string} url - 요청 URL
     * @param {Object} data - 요청 데이터
     * @returns {Promise<Object>} 응답 데이터
     */
    async _makeRequest(method, url, data) {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin' // 세션 쿠키 포함
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);

        // 인증 오류 처리
        if (response.status === 401) {
            throw new Error('AUTHENTICATION_REQUIRED');
        }

        // 서버 오류 처리
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * 지연 함수 (재시도 간격 조절용)
     * @param {number} ms - 지연 시간 (밀리초)
     * @returns {Promise<void>}
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 에러 처리 및 사용자 친화적 메시지 생성
     * @param {Error} error - 원본 에러
     * @returns {Error} 처리된 에러
     */
    _handleError(error) {
        if (error.message === 'AUTHENTICATION_REQUIRED') {
            return new Error('로그인이 필요합니다. 다시 로그인해 주세요.');
        }

        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            return new Error('네트워크 연결을 확인해 주세요.');
        }

        if (error.message.includes('daily limit')) {
            return new Error('일일 포인트 획득 한도에 도달했습니다.');
        }

        if (error.message.includes('insufficient points')) {
            return new Error('보유 포인트가 부족합니다.');
        }

        // 기본 에러 메시지
        return new Error(error.message || '포인트 처리 중 오류가 발생했습니다.');
    }

    /**
     * 포인트 적립 결과를 사용자에게 표시
     * @param {Object} result - 적립 결과
     * @param {HTMLElement} container - 결과를 표시할 컨테이너
     */
    displayEarnResult(result, container) {
        if (!container) return;

        const earnedPoints = result.earnedPoints || 0;
        const totalPoints = result.totalPoints || 0;
        const dailyRemaining = result.dailyRemaining || 0;

        container.innerHTML = `
            <div class="points-result">
                <h3>포인트 적립 완료!</h3>
                <div class="points-info">
                    <p><strong>획득 포인트:</strong> ${earnedPoints}P</p>
                    <p><strong>총 보유 포인트:</strong> ${totalPoints}P</p>
                    <p><strong>오늘 획득 가능:</strong> ${dailyRemaining}P</p>
                </div>
            </div>
        `;
    }

    /**
     * 에러를 사용자에게 표시
     * @param {Error} error - 표시할 에러
     * @param {HTMLElement} container - 에러를 표시할 컨테이너
     */
    displayError(error, container) {
        if (!container) return;

        container.innerHTML = `
            <div class="points-error">
                <h3>오류 발생</h3>
                <p>${error.message}</p>
                <button onclick="location.reload()" class="retry-btn">다시 시도</button>
            </div>
        `;
    }

    /**
     * 일일 한도 정보를 UI에 표시
     * @param {Object} limitInfo - 일일 한도 정보
     * @param {HTMLElement} container - 표시할 컨테이너
     */
    displayDailyLimitInfo(limitInfo, container) {
        if (!container) return;

        const resetTime = new Date(limitInfo.resetTime);
        const timeUntilReset = this._formatTimeUntilReset(limitInfo.timeUntilReset);
        const progressPercentage = Math.round((limitInfo.dailyEarned / limitInfo.dailyLimit) * 100);

        container.innerHTML = `
            <div class="daily-limit-info">
                <div class="limit-header">
                    <h3>일일 포인트 한도</h3>
                    <span class="reset-timer">${timeUntilReset} 후 초기화</span>
                </div>
                <div class="limit-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressPercentage}%"></div>
                    </div>
                    <div class="progress-text">
                        ${limitInfo.dailyEarned} / ${limitInfo.dailyLimit} 포인트 (${progressPercentage}%)
                    </div>
                </div>
                <div class="limit-details">
                    <div class="detail-item">
                        <span class="label">남은 획득 가능:</span>
                        <span class="value ${limitInfo.dailyRemaining <= 0 ? 'exhausted' : ''}">${limitInfo.dailyRemaining}P</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 남은 시간을 사용자 친화적 형식으로 변환
     * @param {number} milliseconds - 밀리초 단위 시간
     * @returns {string} 포맷된 시간 문자열
     */
    _formatTimeUntilReset(milliseconds) {
        const hours = Math.floor(milliseconds / (1000 * 60 * 60));
        const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            return `${hours}시간 ${minutes}분`;
        } else {
            return `${minutes}분`;
        }
    }

    /**
     * 실시간으로 포인트 정보를 업데이트하는 인터벌 시작
     * @param {Function} updateCallback - 업데이트 시 호출할 콜백 함수
     * @param {number} intervalMs - 업데이트 간격 (기본값: 30초)
     * @returns {number} 인터벌 ID
     */
    startRealTimeUpdates(updateCallback, intervalMs = 30000) {
        return setInterval(async () => {
            try {
                const balance = await this.getCurrentBalance();
                const limitInfo = await this.getDailyLimitInfo();
                
                if (updateCallback) {
                    updateCallback({
                        balance: balance,
                        limitInfo: limitInfo
                    });
                }
            } catch (error) {
                console.warn('실시간 업데이트 실패:', error.message);
            }
        }, intervalMs);
    }

    /**
     * 실시간 업데이트 중지
     * @param {number} intervalId - 중지할 인터벌 ID
     */
    stopRealTimeUpdates(intervalId) {
        if (intervalId) {
            clearInterval(intervalId);
        }
    }
}

// 전역 인스턴스 생성 (다른 스크립트에서 사용 가능)
window.pointsManager = new PointsManager();