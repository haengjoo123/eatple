/**
 * ErrorHandler - 통합 오류 처리 및 사용자 경험 개선 유틸리티
 * 네트워크 오류, 게임 크래시, 인증 오류 등을 처리하고 사용자에게 적절한 피드백 제공
 */
class ErrorHandler {
    constructor() {
        this.retryAttempts = new Map(); // 재시도 횟수 추적
        this.maxRetries = 3;
        this.retryDelay = 1000;
        this.loadingTimeouts = new Map(); // 로딩 타임아웃 추적
        this.maxLoadingTime = 60000; // 60초 최대 로딩 시간
        
        this.init();
    }

    init() {
        this.setupGlobalErrorHandlers();
        this.setupNetworkMonitoring();
        this.setupPerformanceMonitoring();
    }

    /**
     * 전역 오류 핸들러 설정
     */
    setupGlobalErrorHandlers() {
        // JavaScript 런타임 오류 처리
        window.addEventListener('error', (event) => {
            console.error('전역 오류 발생:', event.error);
            this.handleGlobalError(event.error, 'runtime');
        });

        // Promise rejection 오류 처리
        window.addEventListener('unhandledrejection', (event) => {
            console.error('처리되지 않은 Promise 거부:', event.reason);
            this.handleGlobalError(event.reason, 'promise');
            event.preventDefault(); // 브라우저 기본 오류 표시 방지
        });

        // 페이지 이탈 시 안전한 상태 초기화
        window.addEventListener('beforeunload', (event) => {
            this.handlePageUnload(event);
        });

        // 페이지 가시성 변경 시 처리
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });
    }

    /**
     * 네트워크 상태 모니터링 설정
     */
    setupNetworkMonitoring() {
        // 온라인/오프라인 상태 감지
        window.addEventListener('online', () => {
            this.handleNetworkStatusChange(true);
        });

        window.addEventListener('offline', () => {
            this.handleNetworkStatusChange(false);
        });
    }

    /**
     * 성능 모니터링 설정
     */
    setupPerformanceMonitoring() {
        // 페이지 로드 성능 측정
        window.addEventListener('load', () => {
            this.measurePageLoadPerformance();
        });
    }

    /**
     * 전역 오류 처리
     * @param {Error} error - 발생한 오류
     * @param {string} type - 오류 타입 ('runtime', 'promise', 'network', 'game')
     */
    handleGlobalError(error, type = 'unknown') {
        const errorInfo = {
            message: error.message || '알 수 없는 오류가 발생했습니다.',
            stack: error.stack,
            type: type,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        // 오류 로깅
        this.logError(errorInfo);

        // 오류 타입별 처리
        switch (type) {
            case 'network':
                this.handleNetworkError(error);
                break;
            case 'authentication':
                this.handleAuthError(error);
                break;
            case 'game':
                this.handleGameError(error);
                break;
            default:
                this.handleGenericError(error);
        }
    }

    /**
     * 네트워크 오류 처리
     * @param {Error} error - 네트워크 오류
     */
    async handleNetworkError(error) {
        const isOnline = navigator.onLine;
        
        if (!isOnline) {
            this.showErrorModal({
                title: '인터넷 연결 오류',
                message: '인터넷 연결을 확인해 주세요.',
                type: 'network',
                actions: [
                    {
                        text: '다시 시도',
                        action: () => window.location.reload(),
                        primary: true
                    }
                ]
            });
            return;
        }

        // 재시도 로직
        const retryKey = error.endpoint || 'unknown';
        const attempts = this.retryAttempts.get(retryKey) || 0;

        if (attempts < this.maxRetries) {
            this.retryAttempts.set(retryKey, attempts + 1);
            
            this.showRetryNotification(
                `네트워크 오류 발생. ${this.maxRetries - attempts}번 더 재시도합니다...`,
                'warning'
            );

            // 지수 백오프로 재시도
            await this.delay(this.retryDelay * Math.pow(2, attempts));
            
            if (error.retryCallback) {
                try {
                    await error.retryCallback();
                    this.retryAttempts.delete(retryKey);
                    this.hideNotification();
                } catch (retryError) {
                    this.handleNetworkError(retryError);
                }
            }
        } else {
            // 최대 재시도 횟수 초과
            this.retryAttempts.delete(retryKey);
            this.showErrorModal({
                title: '네트워크 오류',
                message: '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
                type: 'network',
                actions: [
                    {
                        text: '새로고침',
                        action: () => window.location.reload(),
                        primary: true
                    },
                    {
                        text: '메인으로',
                        action: () => window.location.href = 'index.html'
                    }
                ]
            });
        }
    }

    /**
     * 인증 오류 처리
     * @param {Error} error - 인증 오류
     */
    handleAuthError(error) {
        // 세션 정리
        this.clearGameSession();
        
        this.showErrorModal({
            title: '로그인 필요',
            message: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
            type: 'authentication',
            actions: [
                {
                    text: '로그인 페이지로',
                    action: () => window.location.href = 'login.html',
                    primary: true
                }
            ]
        });
    }

    /**
     * 게임 오류 처리
     * @param {Error} error - 게임 오류
     */
    handleGameError(error) {
        // 게임 상태 안전하게 초기화
        this.safeGameCleanup();
        
        this.showErrorModal({
            title: '게임 오류',
            message: '게임 중 오류가 발생했습니다. 게임을 다시 시작하거나 다른 게임을 선택해 주세요.',
            type: 'game',
            actions: [
                {
                    text: '게임 다시 시작',
                    action: () => window.location.reload(),
                    primary: true
                },
                {
                    text: '게임 목록으로',
                    action: () => window.location.href = 'mini-games.html'
                }
            ]
        });
    }

    /**
     * 일반 오류 처리
     * @param {Error} error - 일반 오류
     */
    handleGenericError(error) {
        this.showErrorModal({
            title: '오류 발생',
            message: '예상치 못한 오류가 발생했습니다. 페이지를 새로고침하거나 잠시 후 다시 시도해 주세요.',
            type: 'generic',
            actions: [
                {
                    text: '새로고침',
                    action: () => window.location.reload(),
                    primary: true
                },
                {
                    text: '메인으로',
                    action: () => window.location.href = 'index.html'
                }
            ]
        });
    }

    /**
     * 로딩 상태 관리
     * @param {string} key - 로딩 식별자
     * @param {HTMLElement} element - 로딩을 표시할 요소
     * @param {string} message - 로딩 메시지
     */
    showLoading(key, element, message = '로딩 중...') {
        if (!element) return;

        // 기존 로딩 타임아웃 정리
        if (this.loadingTimeouts.has(key)) {
            clearTimeout(this.loadingTimeouts.get(key));
        }

        // 로딩 UI 표시
        element.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <div class="loading-message">${message}</div>
            </div>
        `;
        element.classList.add('loading');

        // 최대 로딩 시간 설정
        const timeout = setTimeout(() => {
            this.handleLoadingTimeout(key, element);
        }, this.maxLoadingTime);

        this.loadingTimeouts.set(key, timeout);
    }

    /**
     * 로딩 상태 해제
     * @param {string} key - 로딩 식별자
     */
    hideLoading(key) {
        if (this.loadingTimeouts.has(key)) {
            clearTimeout(this.loadingTimeouts.get(key));
            this.loadingTimeouts.delete(key);
        }
    }

    /**
     * 로딩 타임아웃 처리
     * @param {string} key - 로딩 식별자
     * @param {HTMLElement} element - 로딩 요소
     */
    handleLoadingTimeout(key, element) {
        if (element) {
            element.innerHTML = `
                <div class="loading-timeout">
                    <div class="timeout-icon">⏰</div>
                    <div class="timeout-message">로딩이 지연되고 있습니다.</div>
                    <button class="retry-btn" onclick="window.location.reload()">새로고침</button>
                </div>
            `;
            element.classList.remove('loading');
            element.classList.add('timeout');
        }
        
        this.loadingTimeouts.delete(key);
    }

    /**
     * 페이지 이탈 처리
     * @param {BeforeUnloadEvent} event - 이탈 이벤트
     */
    handlePageUnload(event) {
        // 게임이 진행 중인지 확인
        const isGameInProgress = this.isGameInProgress();
        
        if (isGameInProgress) {
            event.preventDefault();
            event.returnValue = '게임이 진행 중입니다. 정말 나가시겠습니까?';
            
            // 게임 상태 임시 저장 (가능한 경우)
            this.saveGameState();
        }
        
        // 리소스 정리
        this.cleanup();
    }

    /**
     * 페이지 가시성 변경 처리
     */
    handleVisibilityChange() {
        if (document.hidden) {
            // 페이지가 숨겨졌을 때 - 게임 일시정지
            this.pauseActiveGame();
        } else {
            // 페이지가 다시 보일 때 - 상태 복원
            this.resumeActiveGame();
        }
    }

    /**
     * 네트워크 상태 변경 처리
     * @param {boolean} isOnline - 온라인 상태
     */
    handleNetworkStatusChange(isOnline) {
        if (isOnline) {
            this.showNotification('인터넷 연결이 복구되었습니다.', 'success', 3000);
            // 대기 중인 요청 재시도
            this.retryPendingRequests();
        } else {
            this.showNotification('인터넷 연결이 끊어졌습니다.', 'error');
        }
    }

    /**
     * 게임 진행 상태 확인
     * @returns {boolean} 게임 진행 중 여부
     */
    isGameInProgress() {
        // 전역 게임 인스턴스들 확인
        const gameInstances = [
            window.snakeGame,
            window.memoryGame,
            window.puzzleGame
        ];

        return gameInstances.some(game => 
            game && game.gameState === 'PLAYING'
        );
    }

    /**
     * 활성 게임 일시정지
     */
    pauseActiveGame() {
        const gameInstances = [
            window.snakeGame,
            window.memoryGame,
            window.puzzleGame
        ];

        gameInstances.forEach(game => {
            if (game && game.gameState === 'PLAYING' && typeof game.pause === 'function') {
                game.pause();
            }
        });
    }

    /**
     * 활성 게임 재개
     */
    resumeActiveGame() {
        // 사용자 확인 후 게임 재개
        const gameInstances = [
            window.snakeGame,
            window.memoryGame,
            window.puzzleGame
        ];

        gameInstances.forEach(game => {
            if (game && game.gameState === 'PAUSED' && typeof game.resume === 'function') {
                // 자동 재개하지 않고 사용자가 직접 재개하도록 안내
                this.showNotification('게임이 일시정지되었습니다. 계속하려면 재개 버튼을 클릭하세요.', 'info', 5000);
            }
        });
    }

    /**
     * 게임 상태 임시 저장
     */
    saveGameState() {
        try {
            const gameState = {
                timestamp: Date.now(),
                url: window.location.href,
                sessionId: localStorage.getItem('gameSessionId'),
                gameId: localStorage.getItem('gameId')
            };
            
            sessionStorage.setItem('tempGameState', JSON.stringify(gameState));
        } catch (error) {
            console.warn('게임 상태 저장 실패:', error);
        }
    }

    /**
     * 안전한 게임 정리
     */
    safeGameCleanup() {
        try {
            // 게임 인스턴스 정리
            const gameInstances = [
                window.snakeGame,
                window.memoryGame,
                window.puzzleGame
            ];

            gameInstances.forEach(game => {
                if (game && typeof game.destroy === 'function') {
                    game.destroy();
                } else if (game && typeof game.reset === 'function') {
                    game.reset();
                }
            });

            // 게임 세션 정리
            this.clearGameSession();
            
        } catch (error) {
            console.warn('게임 정리 중 오류:', error);
        }
    }

    /**
     * 게임 세션 정리
     */
    clearGameSession() {
        try {
            localStorage.removeItem('gameSessionId');
            localStorage.removeItem('gameId');
            localStorage.removeItem('gameStartTime');
            sessionStorage.removeItem('tempGameState');
        } catch (error) {
            console.warn('세션 정리 실패:', error);
        }
    }

    /**
     * 오류 모달 표시
     * @param {Object} options - 모달 옵션
     */
    showErrorModal(options) {
        const modal = this.createErrorModal(options);
        document.body.appendChild(modal);
        
        // 애니메이션을 위한 지연
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
    }

    /**
     * 오류 모달 생성
     * @param {Object} options - 모달 옵션
     * @returns {HTMLElement} 생성된 모달 요소
     */
    createErrorModal(options) {
        const modal = document.createElement('div');
        modal.className = 'error-modal';
        modal.id = 'errorModal';
        
        const actionsHtml = options.actions.map(action => `
            <button class="error-btn ${action.primary ? 'primary' : 'secondary'}" 
                    onclick="this.closest('.error-modal').remove(); (${action.action.toString()})()">
                ${action.text}
            </button>
        `).join('');

        modal.innerHTML = `
            <div class="error-content">
                <div class="error-icon ${options.type}">
                    ${this.getErrorIcon(options.type)}
                </div>
                <h2 class="error-title">${options.title}</h2>
                <p class="error-message">${options.message}</p>
                <div class="error-actions">
                    ${actionsHtml}
                </div>
            </div>
        `;

        return modal;
    }

    /**
     * 오류 타입별 아이콘 반환
     * @param {string} type - 오류 타입
     * @returns {string} 아이콘 HTML
     */
    getErrorIcon(type) {
        const icons = {
            network: '🌐',
            authentication: '🔒',
            game: '🎮',
            generic: '⚠️'
        };
        return icons[type] || icons.generic;
    }

    /**
     * 알림 표시
     * @param {string} message - 알림 메시지
     * @param {string} type - 알림 타입 ('success', 'error', 'warning', 'info')
     * @param {number} duration - 표시 시간 (밀리초, 0이면 수동 닫기)
     */
    showNotification(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        // 알림 컨테이너 확인/생성
        let container = document.getElementById('notificationContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notificationContainer';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }

        container.appendChild(notification);

        // 자동 제거
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, duration);
        }
    }

    /**
     * 재시도 알림 표시
     * @param {string} message - 알림 메시지
     * @param {string} type - 알림 타입
     */
    showRetryNotification(message, type = 'info') {
        this.hideNotification(); // 기존 알림 숨김
        this.showNotification(message, type, 0); // 수동 닫기 알림
    }

    /**
     * 알림 숨김
     */
    hideNotification() {
        const container = document.getElementById('notificationContainer');
        if (container) {
            container.innerHTML = '';
        }
    }

    /**
     * 페이지 로드 성능 측정
     */
    measurePageLoadPerformance() {
        try {
            const navigation = performance.getEntriesByType('navigation')[0];
            const loadTime = navigation.loadEventEnd - navigation.loadEventStart;
            
            if (loadTime > 3000) {
                console.warn(`페이지 로드 시간이 느립니다: ${loadTime}ms`);
                this.showNotification('페이지 로딩이 느립니다. 네트워크 상태를 확인해 주세요.', 'warning', 5000);
            }
        } catch (error) {
            console.warn('성능 측정 실패:', error);
        }
    }

    /**
     * 대기 중인 요청 재시도
     */
    async retryPendingRequests() {
        // 구현 필요 시 추가
        console.log('네트워크 복구됨 - 대기 중인 요청 재시도');
    }

    /**
     * 오류 로깅
     * @param {Object} errorInfo - 오류 정보
     */
    logError(errorInfo) {
        // 콘솔 로깅
        console.error('오류 발생:', errorInfo);
        
        // 필요시 서버로 오류 전송
        // this.sendErrorToServer(errorInfo);
    }

    /**
     * 지연 함수
     * @param {number} ms - 지연 시간 (밀리초)
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 리소스 정리
     */
    cleanup() {
        // 타임아웃 정리
        this.loadingTimeouts.forEach(timeout => clearTimeout(timeout));
        this.loadingTimeouts.clear();
        
        // 재시도 카운터 정리
        this.retryAttempts.clear();
    }
}

// 전역 인스턴스 생성
window.errorHandler = new ErrorHandler();