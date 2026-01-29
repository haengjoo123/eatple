/**
 * AI 요청 큐 관리 시스템 (인메모리)
 * 여러 사용자의 동시 AI 요청을 순차적으로 처리하여 병목현상 방지
 */

class AIRequestQueue {
    constructor(options = {}) {
        // 동시 처리 가능한 최대 요청 수
        this.maxConcurrent = options.maxConcurrent || 3;
        
        // 요청 타임아웃 (기본 5분)
        this.requestTimeout = options.requestTimeout || 300000;
        
        // 큐 대기 타임아웃 (기본 10분)
        this.queueTimeout = options.queueTimeout || 600000;
        
        // 현재 처리 중인 요청 수
        this.activeRequests = 0;
        
        // 대기 중인 요청 큐
        this.queue = [];
        
        // 통계 정보
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            timeoutRequests: 0,
            averageWaitTime: 0,
            averageProcessTime: 0,
            currentQueueSize: 0,
            peakQueueSize: 0
        };

        // 로깅 활성화 여부
        this.enableLogging = options.enableLogging !== false;
    }

    /**
     * AI 요청을 큐에 추가하고 처리
     * @param {Function} requestFn - 실행할 비동기 함수
     * @param {Object} metadata - 요청 메타데이터 (로깅용)
     * @returns {Promise} 요청 결과
     */
    async add(requestFn, metadata = {}) {
        const requestId = this.generateRequestId();
        const enqueuedAt = Date.now();

        this.stats.totalRequests++;
        this.stats.currentQueueSize = this.queue.length;
        
        if (this.enableLogging) {
            console.log(`[AI Queue] 요청 추가: ${requestId} (${metadata.type || 'unknown'}) - 대기열: ${this.queue.length}, 처리중: ${this.activeRequests}`);
        }

        return new Promise((resolve, reject) => {
            // 큐 타임아웃 설정
            const queueTimeoutId = setTimeout(() => {
                this.stats.timeoutRequests++;
                this.removeFromQueue(requestId);
                reject(new Error('요청 대기 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'));
            }, this.queueTimeout);

            // 큐에 요청 추가
            const queueItem = {
                id: requestId,
                requestFn,
                metadata,
                enqueuedAt,
                queueTimeoutId,
                resolve,
                reject
            };

            this.queue.push(queueItem);
            
            // 피크 큐 사이즈 업데이트
            if (this.queue.length > this.stats.peakQueueSize) {
                this.stats.peakQueueSize = this.queue.length;
            }

            // 큐 처리 시작
            this.processQueue();
        });
    }

    /**
     * 큐에서 다음 요청 처리
     */
    async processQueue() {
        // 동시 처리 한도 확인
        if (this.activeRequests >= this.maxConcurrent) {
            return;
        }

        // 큐가 비어있는지 확인
        if (this.queue.length === 0) {
            return;
        }

        // 다음 요청 가져오기
        const queueItem = this.queue.shift();
        this.stats.currentQueueSize = this.queue.length;
        
        if (!queueItem) {
            return;
        }

        const { id, requestFn, metadata, enqueuedAt, queueTimeoutId, resolve, reject } = queueItem;

        // 큐 타임아웃 해제
        clearTimeout(queueTimeoutId);

        // 대기 시간 계산
        const waitTime = Date.now() - enqueuedAt;
        this.updateAverageWaitTime(waitTime);

        if (this.enableLogging) {
            console.log(`[AI Queue] 요청 처리 시작: ${id} (${metadata.type || 'unknown'}) - 대기시간: ${waitTime}ms`);
        }

        // 활성 요청 수 증가
        this.activeRequests++;

        const startTime = Date.now();

        // 요청 타임아웃 설정
        const requestTimeoutId = setTimeout(() => {
            this.stats.timeoutRequests++;
            reject(new Error('AI 요청 처리 시간이 초과되었습니다.'));
        }, this.requestTimeout);

        try {
            // 실제 AI 요청 실행
            const result = await requestFn();
            
            // 타임아웃 해제
            clearTimeout(requestTimeoutId);

            // 처리 시간 계산
            const processTime = Date.now() - startTime;
            this.updateAverageProcessTime(processTime);

            this.stats.successfulRequests++;

            if (this.enableLogging) {
                console.log(`[AI Queue] 요청 완료: ${id} - 처리시간: ${processTime}ms`);
            }

            resolve(result);
        } catch (error) {
            // 타임아웃 해제
            clearTimeout(requestTimeoutId);

            this.stats.failedRequests++;

            if (this.enableLogging) {
                console.error(`[AI Queue] 요청 실패: ${id} - ${error.message}`);
            }

            reject(error);
        } finally {
            // 활성 요청 수 감소
            this.activeRequests--;

            // 다음 요청 처리
            this.processQueue();
        }
    }

    /**
     * 큐에서 특정 요청 제거
     * @param {string} requestId - 요청 ID
     */
    removeFromQueue(requestId) {
        const index = this.queue.findIndex(item => item.id === requestId);
        if (index !== -1) {
            const removed = this.queue.splice(index, 1)[0];
            clearTimeout(removed.queueTimeoutId);
            this.stats.currentQueueSize = this.queue.length;
            
            if (this.enableLogging) {
                console.log(`[AI Queue] 요청 제거: ${requestId}`);
            }
        }
    }

    /**
     * 요청 ID 생성
     * @returns {string} 고유 요청 ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 평균 대기 시간 업데이트
     * @param {number} waitTime - 대기 시간 (ms)
     */
    updateAverageWaitTime(waitTime) {
        const totalRequests = this.stats.successfulRequests + this.stats.failedRequests;
        if (totalRequests > 0) {
            this.stats.averageWaitTime = 
                (this.stats.averageWaitTime * (totalRequests - 1) + waitTime) / totalRequests;
        } else {
            this.stats.averageWaitTime = waitTime;
        }
    }

    /**
     * 평균 처리 시간 업데이트
     * @param {number} processTime - 처리 시간 (ms)
     */
    updateAverageProcessTime(processTime) {
        const totalRequests = this.stats.successfulRequests + this.stats.failedRequests;
        if (totalRequests > 0) {
            this.stats.averageProcessTime = 
                (this.stats.averageProcessTime * (totalRequests - 1) + processTime) / totalRequests;
        } else {
            this.stats.averageProcessTime = processTime;
        }
    }

    /**
     * 큐 통계 조회
     * @returns {Object} 통계 정보
     */
    getStats() {
        return {
            ...this.stats,
            activeRequests: this.activeRequests,
            successRate: this.stats.totalRequests > 0 
                ? ((this.stats.successfulRequests / this.stats.totalRequests) * 100).toFixed(2) + '%'
                : '0%',
            averageWaitTime: Math.round(this.stats.averageWaitTime),
            averageProcessTime: Math.round(this.stats.averageProcessTime)
        };
    }

    /**
     * 큐 상태 조회
     * @returns {Object} 현재 상태
     */
    getStatus() {
        return {
            isHealthy: this.activeRequests < this.maxConcurrent && this.queue.length < 50,
            activeRequests: this.activeRequests,
            queuedRequests: this.queue.length,
            maxConcurrent: this.maxConcurrent,
            utilizationRate: ((this.activeRequests / this.maxConcurrent) * 100).toFixed(2) + '%'
        };
    }

    /**
     * 큐 초기화
     */
    clear() {
        // 모든 대기 중인 요청 취소
        this.queue.forEach(item => {
            clearTimeout(item.queueTimeoutId);
            item.reject(new Error('큐가 초기화되었습니다.'));
        });

        this.queue = [];
        this.activeRequests = 0;
        this.stats.currentQueueSize = 0;

        if (this.enableLogging) {
            console.log('[AI Queue] 큐 초기화 완료');
        }
    }

    /**
     * 통계 초기화
     */
    resetStats() {
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            timeoutRequests: 0,
            averageWaitTime: 0,
            averageProcessTime: 0,
            currentQueueSize: this.queue.length,
            peakQueueSize: 0
        };

        if (this.enableLogging) {
            console.log('[AI Queue] 통계 초기화 완료');
        }
    }
}

// 싱글톤 인스턴스 생성 (전역에서 하나만 사용)
const aiRequestQueue = new AIRequestQueue({
    maxConcurrent: 3,           // 동시 처리 3개
    requestTimeout: 300000,     // 요청 타임아웃 5분
    queueTimeout: 600000,       // 큐 대기 타임아웃 10분
    enableLogging: process.env.NODE_ENV !== 'production' // 개발 환경에서만 로깅
});

module.exports = aiRequestQueue;
