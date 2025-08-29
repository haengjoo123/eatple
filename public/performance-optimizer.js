/**
 * Performance Optimizer - 게임 성능 최적화 유틸리티
 * 메모리 관리, 렌더링 최적화, 리소스 관리 등을 담당
 */
class PerformanceOptimizer {
    constructor() {
        this.frameRateMonitor = {
            frames: 0,
            lastTime: 0,
            fps: 0,
            targetFPS: 60
        };
        
        this.memoryMonitor = {
            lastCheck: 0,
            checkInterval: 5000, // 5초마다 체크
            threshold: 50 * 1024 * 1024 // 50MB 임계값
        };
        
        this.resourceCache = new Map();
        this.observers = [];
        
        this.init();
    }

    init() {
        this.setupPerformanceMonitoring();
        this.setupResourceOptimization();
        this.setupAccessibilityFeatures();
    }

    /**
     * 성능 모니터링 설정
     */
    setupPerformanceMonitoring() {
        // FPS 모니터링
        this.startFPSMonitoring();
        
        // 메모리 사용량 모니터링
        this.startMemoryMonitoring();
        
        // 네트워크 성능 모니터링
        this.monitorNetworkPerformance();
    }

    /**
     * FPS 모니터링 시작
     */
    startFPSMonitoring() {
        const monitor = () => {
            const now = performance.now();
            this.frameRateMonitor.frames++;
            
            if (now - this.frameRateMonitor.lastTime >= 1000) {
                this.frameRateMonitor.fps = this.frameRateMonitor.frames;
                this.frameRateMonitor.frames = 0;
                this.frameRateMonitor.lastTime = now;
                
                // FPS가 너무 낮으면 최적화 제안
                if (this.frameRateMonitor.fps < 30) {
                    this.suggestPerformanceOptimization();
                }
            }
            
            requestAnimationFrame(monitor);
        };
        
        requestAnimationFrame(monitor);
    }

    /**
     * 메모리 모니터링 시작
     */
    startMemoryMonitoring() {
        if (!performance.memory) return;
        
        setInterval(() => {
            const memoryInfo = performance.memory;
            const usedMemory = memoryInfo.usedJSHeapSize;
            
            if (usedMemory > this.memoryMonitor.threshold) {
                this.optimizeMemoryUsage();
            }
            
            // 메모리 누수 감지
            this.detectMemoryLeaks();
            
        }, this.memoryMonitor.checkInterval);
    }

    /**
     * 네트워크 성능 모니터링
     */
    monitorNetworkPerformance() {
        if ('connection' in navigator) {
            const connection = navigator.connection;
            
            // 연결 상태 변경 감지
            connection.addEventListener('change', () => {
                this.adaptToNetworkConditions(connection);
            });
            
            // 초기 네트워크 상태에 따른 최적화
            this.adaptToNetworkConditions(connection);
        }
    }

    /**
     * 네트워크 상태에 따른 적응
     * @param {NetworkInformation} connection - 네트워크 정보
     */
    adaptToNetworkConditions(connection) {
        const effectiveType = connection.effectiveType;
        
        switch (effectiveType) {
            case 'slow-2g':
            case '2g':
                this.enableLowBandwidthMode();
                break;
            case '3g':
                this.enableMediumBandwidthMode();
                break;
            case '4g':
            default:
                this.enableHighBandwidthMode();
                break;
        }
    }

    /**
     * 저대역폭 모드 활성화
     */
    enableLowBandwidthMode() {
        // 이미지 품질 낮춤
        this.reduceImageQuality();
        
        // 애니메이션 단순화
        this.simplifyAnimations();
        
        // 실시간 업데이트 간격 증가
        this.increaseUpdateInterval();
        
        window.errorHandler?.showNotification(
            '네트워크 상태가 좋지 않아 성능 최적화 모드로 전환됩니다.',
            'info',
            5000
        );
    }

    /**
     * 중간 대역폭 모드 활성화
     */
    enableMediumBandwidthMode() {
        this.setMediumQualitySettings();
    }

    /**
     * 고대역폭 모드 활성화
     */
    enableHighBandwidthMode() {
        this.setHighQualitySettings();
    }

    /**
     * 리소스 최적화 설정
     */
    setupResourceOptimization() {
        // 이미지 지연 로딩
        this.setupLazyLoading();
        
        // 리소스 프리로딩
        this.setupResourcePreloading();
        
        // 캐시 관리
        this.setupCacheManagement();
    }

    /**
     * 지연 로딩 설정
     */
    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                            imageObserver.unobserve(img);
                        }
                    }
                });
            });

            // 모든 data-src 속성을 가진 이미지에 적용
            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
            
            this.observers.push(imageObserver);
        }
    }

    /**
     * 리소스 프리로딩 설정
     */
    setupResourcePreloading() {
        // 중요한 게임 리소스 미리 로드
        const criticalResources = [
            'game-engine.js',
            'points-manager.js',
            'error-handler.js'
        ];

        criticalResources.forEach(resource => {
            this.preloadResource(resource);
        });
    }

    /**
     * 리소스 프리로드
     * @param {string} url - 리소스 URL
     */
    preloadResource(url) {
        if (this.resourceCache.has(url)) return;

        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = this.getResourceType(url);
        link.href = url;
        
        link.onload = () => {
            this.resourceCache.set(url, true);
        };
        
        document.head.appendChild(link);
    }

    /**
     * 리소스 타입 결정
     * @param {string} url - 리소스 URL
     * @returns {string} 리소스 타입
     */
    getResourceType(url) {
        const extension = url.split('.').pop().toLowerCase();
        
        switch (extension) {
            case 'js': return 'script';
            case 'css': return 'style';
            case 'png':
            case 'jpg':
            case 'jpeg':
            case 'webp': return 'image';
            case 'woff':
            case 'woff2': return 'font';
            default: return 'fetch';
        }
    }

    /**
     * 캐시 관리 설정
     */
    setupCacheManagement() {
        // 서비스 워커가 있다면 캐시 전략 설정
        if ('serviceWorker' in navigator) {
            this.setupServiceWorkerCache();
        }
        
        // 로컬 스토리지 정리
        this.cleanupLocalStorage();
    }

    /**
     * 서비스 워커 캐시 설정
     */
    setupServiceWorkerCache() {
        // 서비스 워커 등록 (실제 구현 시 별도 파일 필요)
        navigator.serviceWorker.register('/sw.js').catch(error => {
            console.warn('서비스 워커 등록 실패:', error);
        });
    }

    /**
     * 로컬 스토리지 정리
     */
    cleanupLocalStorage() {
        try {
            const now = Date.now();
            const oneWeek = 7 * 24 * 60 * 60 * 1000;
            
            // 오래된 임시 데이터 제거
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('temp_')) {
                    const item = localStorage.getItem(key);
                    try {
                        const data = JSON.parse(item);
                        if (data.timestamp && now - data.timestamp > oneWeek) {
                            localStorage.removeItem(key);
                        }
                    } catch (e) {
                        // 파싱 실패 시 제거
                        localStorage.removeItem(key);
                    }
                }
            });
        } catch (error) {
            console.warn('로컬 스토리지 정리 실패:', error);
        }
    }

    /**
     * 접근성 기능 설정
     */
    setupAccessibilityFeatures() {
        // 키보드 네비게이션 개선
        this.enhanceKeyboardNavigation();
        
        // 스크린 리더 지원
        this.setupScreenReaderSupport();
        
        // 색상 대비 개선
        this.setupColorContrastEnhancement();
        
        // 모션 감소 설정 감지
        this.setupReducedMotionSupport();
    }

    /**
     * 키보드 네비게이션 개선
     */
    enhanceKeyboardNavigation() {
        // 포커스 표시 개선
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                document.body.classList.add('keyboard-navigation');
            }
        });

        document.addEventListener('mousedown', () => {
            document.body.classList.remove('keyboard-navigation');
        });

        // 게임 내 키보드 단축키 안내
        this.addKeyboardShortcutHelp();
    }

    /**
     * 키보드 단축키 도움말 추가
     */
    addKeyboardShortcutHelp() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F1' || (e.ctrlKey && e.key === '/')) {
                e.preventDefault();
                this.showKeyboardShortcuts();
            }
        });
    }

    /**
     * 키보드 단축키 표시
     */
    showKeyboardShortcuts() {
        const shortcuts = [
            { key: 'Space', description: '게임 시작/일시정지' },
            { key: 'Escape', description: '게임 일시정지' },
            { key: 'R', description: '게임 재시작 (Ctrl+R)' },
            { key: 'F1', description: '도움말 표시' },
            { key: 'Tab', description: '요소 간 이동' }
        ];

        const helpModal = document.createElement('div');
        helpModal.className = 'keyboard-help-modal';
        helpModal.innerHTML = `
            <div class="help-content">
                <h3>키보드 단축키</h3>
                <ul class="shortcuts-list">
                    ${shortcuts.map(shortcut => `
                        <li>
                            <kbd>${shortcut.key}</kbd>
                            <span>${shortcut.description}</span>
                        </li>
                    `).join('')}
                </ul>
                <button class="close-help" onclick="this.closest('.keyboard-help-modal').remove()">
                    닫기 (Escape)
                </button>
            </div>
        `;

        document.body.appendChild(helpModal);

        // Escape 키로 닫기
        const closeHandler = (e) => {
            if (e.key === 'Escape') {
                helpModal.remove();
                document.removeEventListener('keydown', closeHandler);
            }
        };
        document.addEventListener('keydown', closeHandler);
    }

    /**
     * 스크린 리더 지원 설정
     */
    setupScreenReaderSupport() {
        // ARIA 레이블 동적 업데이트
        this.updateAriaLabels();
        
        // 게임 상태 알림
        this.setupGameStateAnnouncements();
    }

    /**
     * ARIA 레이블 업데이트
     */
    updateAriaLabels() {
        // 게임 버튼들에 적절한 ARIA 레이블 추가
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            if (!button.getAttribute('aria-label') && button.textContent) {
                button.setAttribute('aria-label', button.textContent);
            }
        });
    }

    /**
     * 게임 상태 알림 설정
     */
    setupGameStateAnnouncements() {
        // 스크린 리더용 알림 영역 생성
        const announcer = document.createElement('div');
        announcer.id = 'game-announcer';
        announcer.setAttribute('aria-live', 'polite');
        announcer.setAttribute('aria-atomic', 'true');
        announcer.style.position = 'absolute';
        announcer.style.left = '-10000px';
        announcer.style.width = '1px';
        announcer.style.height = '1px';
        announcer.style.overflow = 'hidden';
        
        document.body.appendChild(announcer);
    }

    /**
     * 게임 상태 알림
     * @param {string} message - 알림 메시지
     */
    announceToScreenReader(message) {
        const announcer = document.getElementById('game-announcer');
        if (announcer) {
            announcer.textContent = message;
        }
    }

    /**
     * 색상 대비 개선 설정
     */
    setupColorContrastEnhancement() {
        // 고대비 모드 감지
        if (window.matchMedia('(prefers-contrast: high)').matches) {
            document.body.classList.add('high-contrast');
        }

        // 색상 대비 토글 버튼 추가 (접근성 메뉴에)
        this.addContrastToggle();
    }

    /**
     * 대비 토글 추가
     */
    addContrastToggle() {
        const toggle = document.createElement('button');
        toggle.textContent = '고대비 모드';
        toggle.className = 'contrast-toggle';
        toggle.setAttribute('aria-label', '고대비 모드 토글');
        
        toggle.addEventListener('click', () => {
            document.body.classList.toggle('high-contrast');
            const isEnabled = document.body.classList.contains('high-contrast');
            toggle.textContent = isEnabled ? '일반 모드' : '고대비 모드';
            
            // 설정 저장
            localStorage.setItem('highContrast', isEnabled);
        });

        // 저장된 설정 복원
        if (localStorage.getItem('highContrast') === 'true') {
            document.body.classList.add('high-contrast');
            toggle.textContent = '일반 모드';
        }
    }

    /**
     * 모션 감소 지원 설정
     */
    setupReducedMotionSupport() {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            document.body.classList.add('reduced-motion');
            this.disableAnimations();
        }
    }

    /**
     * 애니메이션 비활성화
     */
    disableAnimations() {
        const style = document.createElement('style');
        style.textContent = `
            .reduced-motion * {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 성능 최적화 제안
     */
    suggestPerformanceOptimization() {
        if (this.lastOptimizationSuggestion && 
            Date.now() - this.lastOptimizationSuggestion < 30000) {
            return; // 30초 내 중복 제안 방지
        }

        this.lastOptimizationSuggestion = Date.now();

        window.errorHandler?.showNotification(
            '게임 성능이 저하되고 있습니다. 다른 탭을 닫거나 브라우저를 재시작해보세요.',
            'warning',
            8000
        );
    }

    /**
     * 메모리 사용량 최적화
     */
    optimizeMemoryUsage() {
        // 캐시 정리
        this.resourceCache.clear();
        
        // 가비지 컬렉션 강제 실행 (가능한 경우)
        if (window.gc) {
            window.gc();
        }
        
        // 이벤트 리스너 정리
        this.cleanupEventListeners();
        
        console.log('메모리 최적화 실행됨');
    }

    /**
     * 메모리 누수 감지
     */
    detectMemoryLeaks() {
        if (!performance.memory) return;

        const memoryInfo = performance.memory;
        const usedMemory = memoryInfo.usedJSHeapSize;
        
        // 메모리 사용량이 계속 증가하는지 확인
        if (!this.memoryHistory) {
            this.memoryHistory = [];
        }
        
        this.memoryHistory.push(usedMemory);
        
        // 최근 10개 측정값만 유지
        if (this.memoryHistory.length > 10) {
            this.memoryHistory.shift();
        }
        
        // 메모리 누수 패턴 감지
        if (this.memoryHistory.length >= 5) {
            const trend = this.calculateMemoryTrend();
            if (trend > 0.8) { // 지속적인 증가 패턴
                this.handleMemoryLeak();
            }
        }
    }

    /**
     * 메모리 사용량 추세 계산
     * @returns {number} 추세 값 (0-1)
     */
    calculateMemoryTrend() {
        const history = this.memoryHistory;
        let increases = 0;
        
        for (let i = 1; i < history.length; i++) {
            if (history[i] > history[i-1]) {
                increases++;
            }
        }
        
        return increases / (history.length - 1);
    }

    /**
     * 메모리 누수 처리
     */
    handleMemoryLeak() {
        console.warn('메모리 누수 감지됨');
        
        window.errorHandler?.showNotification(
            '메모리 사용량이 높습니다. 페이지를 새로고침하는 것을 권장합니다.',
            'warning',
            10000
        );
        
        // 자동 최적화 실행
        this.optimizeMemoryUsage();
    }

    /**
     * 이벤트 리스너 정리
     */
    cleanupEventListeners() {
        // 등록된 옵저버들 정리
        this.observers.forEach(observer => {
            if (observer.disconnect) {
                observer.disconnect();
            }
        });
        this.observers = [];
    }

    /**
     * 이미지 품질 감소
     */
    reduceImageQuality() {
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            if (img.src && !img.dataset.originalSrc) {
                img.dataset.originalSrc = img.src;
                // 저품질 버전으로 교체 (실제 구현 시 서버 지원 필요)
            }
        });
    }

    /**
     * 애니메이션 단순화
     */
    simplifyAnimations() {
        document.body.classList.add('simplified-animations');
    }

    /**
     * 업데이트 간격 증가
     */
    increaseUpdateInterval() {
        // 실시간 업데이트 간격을 늘림
        if (window.miniGamesManager) {
            window.miniGamesManager.stopRealTimeUpdates();
            // 더 긴 간격으로 재시작
            window.miniGamesManager.startRealTimeUpdates(60000); // 1분
        }
    }

    /**
     * 중간 품질 설정
     */
    setMediumQualitySettings() {
        document.body.classList.remove('low-quality', 'high-quality');
        document.body.classList.add('medium-quality');
    }

    /**
     * 고품질 설정
     */
    setHighQualitySettings() {
        document.body.classList.remove('low-quality', 'medium-quality');
        document.body.classList.add('high-quality');
    }

    /**
     * 현재 FPS 반환
     * @returns {number} 현재 FPS
     */
    getCurrentFPS() {
        return this.frameRateMonitor.fps;
    }

    /**
     * 메모리 사용량 정보 반환
     * @returns {Object} 메모리 정보
     */
    getMemoryInfo() {
        if (!performance.memory) return null;
        
        return {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit
        };
    }

    /**
     * 정리 작업
     */
    destroy() {
        this.cleanupEventListeners();
        this.resourceCache.clear();
        
        if (this.memoryMonitorInterval) {
            clearInterval(this.memoryMonitorInterval);
        }
    }
}

// 전역 인스턴스 생성
window.performanceOptimizer = new PerformanceOptimizer();