/**
 * HTML5 Canvas 기반 게임 엔진
 * 게임 상태 관리, 렌더링, 입력 처리 등의 기본 기능을 제공
 */

class GameEngine {
    constructor(canvasId, options = {}) {
        try {
            this.canvas = document.getElementById(canvasId);
            if (!this.canvas) {
                throw new Error(`Canvas element with id '${canvasId}' not found`);
            }
            
            this.ctx = this.canvas.getContext('2d');
            if (!this.ctx) {
                throw new Error('Canvas 2D context를 가져올 수 없습니다.');
            }
            
            this.width = options.width || 800;
            this.height = options.height || 600;
        } catch (error) {
            console.error('GameEngine 초기화 오류:', error);
            window.errorHandler?.handleGlobalError(error, 'game');
            throw error;
        }
        
        // Canvas 크기 설정
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        // 게임 상태
        this.gameState = 'MENU'; // MENU, PLAYING, PAUSED, GAME_OVER
        this.score = 0;
        this.startTime = null;
        this.endTime = null;
        this.playTime = 0;
        
        // 게임 루프
        this.lastFrameTime = 0;
        this.animationId = null;
        this.targetFPS = options.fps || 60;
        this.frameInterval = 1000 / this.targetFPS;
        
        // 입력 처리
        this.keys = {};
        this.mouse = { x: 0, y: 0, clicked: false };
        this.touches = [];
        
        // 게임 객체들
        this.gameObjects = [];
        
        // 이벤트 콜백
        this.callbacks = {
            onStart: null,
            onUpdate: null,
            onRender: null,
            onGameOver: null,
            onPause: null,
            onResume: null
        };

        // BGM 관련 속성 추가
        // BGM 파일 경로 배열 (두 곡)
        this.bgmTracks = ['/bgm/game_bgm_1.mp3', '/bgm/game_bgm_2.mp3'];
        this.bgmIndex = 0; // 현재 재생 중인 곡 인덱스
        this.bgmAudio = null; // 현재 재생 중인 Audio 객체
        this.isBgmOn = true; // BGM on/off 상태 (기본값: ON)
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupCanvas();
        this.createBgmToggleButton(); // BGM 토글 버튼 생성
        this.render(); // 초기 렌더링
    }
    
    setupCanvas() {
        // 반응형 캔버스 설정
        const container = this.canvas.parentElement;
        if (container) {
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            
            // 비율 유지하면서 컨테이너에 맞춤
            const scale = Math.min(
                containerWidth / this.width,
                containerHeight / this.height
            );
            
            this.canvas.style.width = (this.width * scale) + 'px';
            this.canvas.style.height = (this.height * scale) + 'px';
        }
        
        // 고해상도 디스플레이 지원
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.scale(dpr, dpr);
        
        // 이미지 렌더링 품질 설정
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
    }
    
    setupEventListeners() {
        // 이벤트 핸들러를 바인딩하여 참조 저장
        this.boundHandleKeyDown = (e) => {
            this.keys[e.code] = true;
            this.handleKeyDown(e);
        };
        
        this.boundHandleKeyUp = (e) => {
            this.keys[e.code] = false;
            this.handleKeyUp(e);
        };
        
        this.boundHandleResize = () => {
            this.setupCanvas();
        };
        
        this.boundHandleVisibilityChange = () => {
            if (document.hidden && this.gameState === 'PLAYING') {
                this.pause();
            }
        };
        
        // 키보드 이벤트
        document.addEventListener('keydown', this.boundHandleKeyDown);
        document.addEventListener('keyup', this.boundHandleKeyUp);
        
        // 마우스 이벤트 핸들러 바인딩
        this.boundHandleMouseDown = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = (e.clientX - rect.left) * (this.width / rect.width);
            this.mouse.y = (e.clientY - rect.top) * (this.height / rect.height);
            this.mouse.clicked = true;
            this.handleMouseDown(e);
        };
        
        this.boundHandleMouseUp = (e) => {
            this.mouse.clicked = false;
            this.handleMouseUp(e);
        };
        
        this.boundHandleMouseMove = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = (e.clientX - rect.left) * (this.width / rect.width);
            this.mouse.y = (e.clientY - rect.top) * (this.height / rect.height);
            this.handleMouseMove(e);
        };
        
        // 터치 이벤트 핸들러 바인딩
        this.boundHandleTouchStart = (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            this.touches = Array.from(e.touches).map(touch => ({
                x: (touch.clientX - rect.left) * (this.width / rect.width),
                y: (touch.clientY - rect.top) * (this.height / rect.height),
                id: touch.identifier
            }));
            this.handleTouchStart(e);
        };
        
        this.boundHandleTouchEnd = (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            this.touches = Array.from(e.touches).map(touch => ({
                x: (touch.clientX - rect.left) * (this.width / rect.width),
                y: (touch.clientY - rect.top) * (this.height / rect.height),
                id: touch.identifier
            }));
            this.handleTouchEnd(e);
        };
        
        this.boundHandleTouchMove = (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            this.touches = Array.from(e.touches).map(touch => ({
                x: (touch.clientX - rect.left) * (this.width / rect.width),
                y: (touch.clientY - rect.top) * (this.height / rect.height),
                id: touch.identifier
            }));
            this.handleTouchMove(e);
        };
        
        // 마우스 이벤트
        this.canvas.addEventListener('mousedown', this.boundHandleMouseDown);
        this.canvas.addEventListener('mouseup', this.boundHandleMouseUp);
        this.canvas.addEventListener('mousemove', this.boundHandleMouseMove);
        
        // 터치 이벤트 (모바일 지원)
        this.canvas.addEventListener('touchstart', this.boundHandleTouchStart);
        this.canvas.addEventListener('touchend', this.boundHandleTouchEnd);
        this.canvas.addEventListener('touchmove', this.boundHandleTouchMove);
        
        // 창 크기 변경 시 캔버스 재조정
        window.addEventListener('resize', this.boundHandleResize);
        
        // 페이지 이탈 시 게임 일시정지
        document.addEventListener('visibilitychange', this.boundHandleVisibilityChange);
    }
    
    // ===== BGM(배경음악) 관련 메서드 =====
    /**
     * BGM 재생 (두 곡을 순차적으로 반복)
     */
    async playBgm() {
        if (!this.isBgmOn || this.bgmTracks.length === 0) return;
        
        // 기존 오디오 정지 및 해제
        if (this.bgmAudio) {
            this.bgmAudio.pause();
            this.bgmAudio = null;
        }
        
        try {
            // 새로운 Audio 객체 생성 및 재생
            this.bgmAudio = new Audio(this.bgmTracks[this.bgmIndex]);
            this.bgmAudio.volume = 0.5; // 볼륨 조절 (필요시 변경)
            this.bgmAudio.onended = () => this.handleBgmEnded();
            
            // play() Promise를 적절히 처리
            await this.bgmAudio.play();
        } catch (error) {
            // 오디오 재생 실패 시 조용히 처리 (사용자 상호작용 필요 등)
            console.log('BGM 재생 실패 (정상적인 브라우저 정책):', error.message);
            
            // AbortError나 기타 재생 관련 오류는 조용히 무시
            if (error.name === 'AbortError' || error.name === 'NotAllowedError') {
                // 사용자가 아직 페이지와 상호작용하지 않았거나 오디오가 중단됨
                return;
            }
        }
    }

    /**
     * BGM 정지 및 해제
     */
    stopBgm() {
        if (this.bgmAudio) {
            this.bgmAudio.pause();
            this.bgmAudio.currentTime = 0;
            this.bgmAudio = null;
        }
    }

    /**
     * BGM on/off 토글 (외부 UI에서 호출 가능)
     */
    async toggleBgm() {
        this.isBgmOn = !this.isBgmOn;
        if (this.isBgmOn) {
            await this.playBgm();
        } else {
            this.stopBgm();
        }
    }

    /**
     * 곡이 끝나면 다음 곡으로 넘어가며 반복 재생
     */
    async handleBgmEnded() {
        this.bgmIndex = (this.bgmIndex + 1) % this.bgmTracks.length;
        await this.playBgm();
    }
    
    /**
     * BGM 토글 버튼을 캔버스 상단 우측에 동적으로 생성하고 상태를 동기화
     */
    createBgmToggleButton() {
        // 이미 버튼이 있으면 중복 생성 방지
        if (document.getElementById('bgm-toggle-btn-gameengine')) return;
        // 버튼 생성
        const btn = document.createElement('button');
        btn.id = 'bgm-toggle-btn-gameengine';
        btn.className = 'bgm-toggle-btn-gameengine';
        btn.type = 'button';
        btn.title = '배경음악 ON/OFF';
        // 버튼 스타일 (class 충돌 방지, 인라인 스타일 적용)
        btn.style.position = 'absolute';
        btn.style.top = '16px';
        btn.style.right = '100px';
        btn.style.zIndex = '1000';
        btn.style.fontSize = '28px';
        btn.style.background = 'rgba(255,255,255,0.7)';
        btn.style.border = 'none';
        btn.style.borderRadius = '50%';
        btn.style.width = '48px';
        btn.style.height = '48px';
        btn.style.cursor = 'pointer';
        btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
        btn.style.transition = 'background 0.2s';
        // 아이콘 동기화 함수
        const syncIcon = () => {
            // 이모지가 깨지지 않도록 직접 유니코드로 입력
            btn.innerHTML = `<span class="bgm-icon">${this.isBgmOn ? '\uD83D\uDD0A' : '\uD83D\uDD07'}</span>`;
        };
        syncIcon();
        // 클릭 시 BGM 토글 및 아이콘 동기화
        btn.addEventListener('click', async () => {
            await this.toggleBgm();
            syncIcon();
        });
        // BGM 상태가 외부에서 바뀌어도 아이콘 동기화 (setInterval로 주기적 체크)
        this._bgmIconSyncInterval = setInterval(() => {
            syncIcon();
        }, 500);
        // 캔버스 부모 컨테이너에 버튼 추가 (없으면 body에 추가)
        const container = this.canvas.parentElement || document.body;
        container.appendChild(btn);
    }
    
    // 게임 상태 관리
    start() {
        if (this.gameState !== 'MENU' && this.gameState !== 'GAME_OVER') {
            return;
        }
        
        this.gameState = 'PLAYING';
        this.score = 0;
        this.startTime = Date.now();
        this.endTime = null;
        this.gameObjects = [];
        
        if (this.callbacks.onStart) {
            this.callbacks.onStart();
        }
        // 게임 시작 시 BGM 재생
        if (this.isBgmOn) {
            this.playBgm().catch(() => {
                // BGM 재생 실패는 조용히 무시
            });
        }
        this.gameLoop();
    }
    
    pause() {
        if (this.gameState !== 'PLAYING') {
            return;
        }
        
        this.gameState = 'PAUSED';
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        // 일시정지 시 BGM 정지
        this.stopBgm();
        if (this.callbacks.onPause) {
            this.callbacks.onPause();
        }
    }
    
    resume() {
        if (this.gameState !== 'PAUSED') {
            return;
        }
        
        this.gameState = 'PLAYING';
        this.gameLoop();
        // 재개 시 BGM 재생
        if (this.isBgmOn) {
            this.playBgm().catch(() => {
                // BGM 재생 실패는 조용히 무시
            });
        }
        if (this.callbacks.onResume) {
            this.callbacks.onResume();
        }
    }
    
    gameOver() {
        if (this.gameState !== 'PLAYING') {
            return;
        }
        
        this.gameState = 'GAME_OVER';
        this.endTime = Date.now();
        this.playTime = Math.floor((this.endTime - this.startTime) / 1000);
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        // 게임 오버 시 BGM 정지
        this.stopBgm();
        if (this.callbacks.onGameOver) {
            this.callbacks.onGameOver({
                score: this.score,
                playTime: this.playTime
            });
        }
    }
    
    reset() {
        this.gameState = 'MENU';
        this.score = 0;
        this.startTime = null;
        this.endTime = null;
        this.playTime = 0;
        this.gameObjects = [];
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        // 리셋 시 BGM 정지
        this.stopBgm();
    }
    
    // 게임 루프
    gameLoop(currentTime = 0) {
        if (this.gameState !== 'PLAYING') {
            return;
        }
        
        const deltaTime = currentTime - this.lastFrameTime;
        
        if (deltaTime >= this.frameInterval) {
            this.update(deltaTime);
            this.render();
            this.lastFrameTime = currentTime;
        }
        
        this.animationId = requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    update(deltaTime) {
        // 게임 객체 업데이트
        this.gameObjects.forEach(obj => {
            if (obj.update) {
                obj.update(deltaTime);
            }
        });
        
        // 사용자 정의 업데이트 콜백
        if (this.callbacks.onUpdate) {
            this.callbacks.onUpdate(deltaTime);
        }
        
        // 충돌 검사
        this.checkCollisions();
        
        // 죽은 객체 제거
        this.gameObjects = this.gameObjects.filter(obj => !obj.isDead);
    }
    
    render() {
        // 화면 클리어
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // 배경 그리기
        this.drawBackground();
        
        // 게임 객체 렌더링
        this.gameObjects.forEach(obj => {
            if (obj.render) {
                obj.render(this.ctx);
            }
        });
        
        // UI 렌더링
        this.drawUI();
        
        // 사용자 정의 렌더링 콜백
        if (this.callbacks.onRender) {
            this.callbacks.onRender(this.ctx);
        }
        
        // 게임 상태별 오버레이
        this.drawOverlay();
    }
    
    drawBackground() {
        // 기본 배경 (그라데이션)
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#98FB98');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }
    
    drawUI() {
        // 점수 표시
        this.ctx.fillStyle = '#7f8c8d';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`점수: ${this.score}`, 20, 40);
        
        // 시간 표시
        if (this.startTime) {
            const currentTime = this.gameState === 'PLAYING' ? Date.now() : this.endTime;
            const elapsed = Math.floor((currentTime - this.startTime) / 1000);
            this.ctx.fillText(`시간: ${elapsed}초`, 20, 70);
        }
    }
    
    drawOverlay() {
        switch (this.gameState) {
            case 'MENU':
                this.drawMenuOverlay();
                break;
            case 'PAUSED':
                this.drawPausedOverlay();
                break;
            case 'GAME_OVER':
                this.drawGameOverOverlay();
                break;
        }
    }
    
    drawMenuOverlay() {
        // 반투명 배경
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // 제목
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('게임 시작', this.width / 2, this.height / 2 - 50);
        
        // 안내 메시지
        this.ctx.font = '24px Arial';
        this.ctx.fillText('클릭하거나 스페이스바를 눌러 시작하세요', this.width / 2, this.height / 2 + 20);
    }
    
    drawPausedOverlay() {
        // 반투명 배경
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // 일시정지 메시지
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('일시정지', this.width / 2, this.height / 2);
        
        this.ctx.font = '24px Arial';
        this.ctx.fillText('스페이스바를 눌러 계속하세요', this.width / 2, this.height / 2 + 50);
    }
    
    drawGameOverOverlay() {
        // 반투명 배경
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // 게임 오버 메시지
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 32px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('게임 종료', this.width / 2, this.height / 2 - 60);
        
        // 최종 점수
        this.ctx.font = '24px Arial';
        this.ctx.fillText(`최종 점수: ${this.score}`, this.width / 2, this.height / 2 - 20);
        this.ctx.fillText(`플레이 시간: ${this.playTime}초`, this.width / 2, this.height / 2 + 10);
        
        // 재시작 안내 (두 줄로 나누어 표시)
        this.ctx.font = '18px Arial';
        this.ctx.fillText('클릭하거나 스페이스바를 눌러', this.width / 2, this.height / 2 + 50);
        this.ctx.fillText('다시 시작하세요', this.width / 2, this.height / 2 + 75);
    }
    
    // 충돌 검사
    checkCollisions() {
        for (let i = 0; i < this.gameObjects.length; i++) {
            for (let j = i + 1; j < this.gameObjects.length; j++) {
                const obj1 = this.gameObjects[i];
                const obj2 = this.gameObjects[j];
                
                if (this.isColliding(obj1, obj2)) {
                    if (obj1.onCollision) obj1.onCollision(obj2);
                    if (obj2.onCollision) obj2.onCollision(obj1);
                }
            }
        }
    }
    
    isColliding(obj1, obj2) {
        if (!obj1.x || !obj1.y || !obj1.width || !obj1.height ||
            !obj2.x || !obj2.y || !obj2.width || !obj2.height) {
            return false;
        }
        
        return obj1.x < obj2.x + obj2.width &&
               obj1.x + obj1.width > obj2.x &&
               obj1.y < obj2.y + obj2.height &&
               obj1.y + obj1.height > obj2.y;
    }
    
    // 게임 객체 관리
    addGameObject(obj) {
        this.gameObjects.push(obj);
    }
    
    removeGameObject(obj) {
        const index = this.gameObjects.indexOf(obj);
        if (index > -1) {
            this.gameObjects.splice(index, 1);
        }
    }
    
    // 입력 처리 (오버라이드 가능)
    handleKeyDown(e) {
        // 모달이 열려있는지 확인
        const modal = document.getElementById('gameResultModal');
        const isModalVisible = modal && modal.style.display !== 'none' && 
                              window.getComputedStyle(modal).display !== 'none';
        
        // 모달이 열려있을 때는 키 입력 무시
        if (isModalVisible) {
            return;
        }
        
        switch (e.code) {
            case 'Space':
                e.preventDefault();
                if (this.gameState === 'MENU' || this.gameState === 'GAME_OVER') {
                    this.start();
                } else if (this.gameState === 'PLAYING') {
                    this.pause();
                } else if (this.gameState === 'PAUSED') {
                    this.resume();
                }
                break;
            case 'Escape':
                if (this.gameState === 'PLAYING') {
                    this.pause();
                }
                break;
        }
    }
    
    handleKeyUp(e) {
        // 오버라이드 가능
    }
    
    handleMouseDown(e) {
        if (this.gameState === 'MENU' || this.gameState === 'GAME_OVER') {
            this.start();
        }
    }
    
    handleMouseUp(e) {
        // 오버라이드 가능
    }
    
    handleMouseMove(e) {
        // 오버라이드 가능
    }
    
    handleTouchStart(e) {
        if (this.gameState === 'MENU' || this.gameState === 'GAME_OVER') {
            this.start();
        }
    }
    
    handleTouchEnd(e) {
        // 오버라이드 가능
    }
    
    handleTouchMove(e) {
        // 오버라이드 가능
    }
    
    // 콜백 설정
    onStart(callback) {
        this.callbacks.onStart = callback;
    }
    
    onUpdate(callback) {
        this.callbacks.onUpdate = callback;
    }
    
    onRender(callback) {
        this.callbacks.onRender = callback;
    }
    
    onGameOver(callback) {
        this.callbacks.onGameOver = callback;
    }
    
    onPause(callback) {
        this.callbacks.onPause = callback;
    }
    
    onResume(callback) {
        this.callbacks.onResume = callback;
    }
    
    // 유틸리티 메서드
    addScore(points) {
        this.score += points;
    }
    
    getPlayTime() {
        if (!this.startTime) return 0;
        const endTime = this.endTime || Date.now();
        return Math.floor((endTime - this.startTime) / 1000);
    }
    
    // 정리
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        // BGM 정리
        this.stopBgm();
        // BGM 토글 버튼 및 동기화 타이머 정리
        const btn = document.getElementById('bgm-toggle-btn-gameengine');
        if (btn) btn.remove();
        if (this._bgmIconSyncInterval) clearInterval(this._bgmIconSyncInterval);
        // 이벤트 리스너 제거
        if (this.canvas) {
            this.canvas.removeEventListener('mousedown', this.boundHandleMouseDown);
            this.canvas.removeEventListener('mouseup', this.boundHandleMouseUp);
            this.canvas.removeEventListener('mousemove', this.boundHandleMouseMove);
            this.canvas.removeEventListener('touchstart', this.boundHandleTouchStart);
            this.canvas.removeEventListener('touchend', this.boundHandleTouchEnd);
            this.canvas.removeEventListener('touchmove', this.boundHandleTouchMove);
        }
        // 전역 이벤트 리스너 제거
        document.removeEventListener('keydown', this.boundHandleKeyDown);
        document.removeEventListener('keyup', this.boundHandleKeyUp);
        window.removeEventListener('resize', this.boundHandleResize);
        document.removeEventListener('visibilitychange', this.boundHandleVisibilityChange);
        this.gameObjects = [];
        this.callbacks = {};
        console.log('GameEngine 인스턴스 정리 완료');
    }
}

// 기본 게임 객체 클래스
class GameObject {
    constructor(x, y, width, height) {
        this.x = x || 0;
        this.y = y || 0;
        this.width = width || 0;
        this.height = height || 0;
        this.vx = 0; // x 속도
        this.vy = 0; // y 속도
        this.isDead = false;
        this.color = '#000';
    }
    
    update(deltaTime) {
        this.x += this.vx * deltaTime / 16; // 60fps 기준 정규화
        this.y += this.vy * deltaTime / 16;
    }
    
    render(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
    
    onCollision(other) {
        // 오버라이드 가능
    }
    
    destroy() {
        this.isDead = true;
    }
}

// 전역으로 내보내기
window.GameEngine = GameEngine;
window.GameObject = GameObject;