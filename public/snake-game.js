/**
 * 스네이크 게임 구현
 * GameEngine을 상속받아 스네이크 게임 로직을 구현
 */

class SnakeGame extends GameEngine {
    constructor() {
        super('gameCanvas', {
            width: 595,
            height: 525,
            fps: 10 // 스네이크 게임은 느린 프레임레이트
        });
        
        // 게임 설정 - 17x15 그리드
        this.gridSize = 35;
        this.gridWidth = 17;
        this.gridHeight = 15;
        
        // 뱀 초기화 - 새로운 그리드 크기에 맞게 조정
        this.snake = [{ x: 8, y: 7 }];
        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
        
        // 과일 이모지 배열
        this.fruits = ['🍎', '🍓', '🍇', '🍊', '🍌', '🍑', '🍒', '🥝', '🍍', '🥭'];
        this.currentFruit = this.fruits[0]; // 현재 과일
        
        // 먹이 (뱀 초기화 후에 생성)
        this.food = this.generateFood();
        
        // 게임 상태
        this.gameSessionId = localStorage.getItem('gameSessionId');
        this.gameStartTime = Date.now();
        this.scoreSubmitted = false; // 점수 중복 제출 방지 플래그
        

        
        // 먹이 애니메이션 변수
        this.foodAnimation = {
            startTime: Date.now(),
            duration: 2000, // 2초 주기
            scale: 1.0,
            minScale: 0.8,
            maxScale: 1.2
        };

        this.wallCollisionTime = null;
        
        this.setupGameCallbacks();
        this.setupUI();
    }
    
    setupGameCallbacks() {
        this.onStart(() => {
            this.startGameSync();
        });
        
        this.onUpdate(() => {
            this.updateSnake();
            this.checkFoodCollision();
            this.checkWallCollision();
            this.checkSelfCollision();
            this.updateFoodAnimation();
        });
        
        this.onRender((ctx) => {
            // 배경을 먼저 그리기
            this.drawBackground();
            
            // 게임 요소 그리기
            this.drawGame(ctx);
            
            // UI 그리기
            this.drawUI();
        });
        
        this.onGameOver((result) => {
            this.showResult(result);
        });
    }
    
    setupUI() {
        // 버튼 이벤트
        document.getElementById('startBtn').addEventListener('click', () => {
            this.start();
            document.getElementById('startBtn').style.display = 'none';
            document.getElementById('pauseBtn').style.display = 'inline-block';
        });
        
        document.getElementById('pauseBtn').addEventListener('click', () => {
            if (this.gameState === 'PLAYING') {
                this.pause();
                document.getElementById('pauseBtn').textContent = '계속하기';
            } else if (this.gameState === 'PAUSED') {
                this.resume();
                document.getElementById('pauseBtn').textContent = '일시정지';
            }
        });
        
        document.getElementById('backBtn').addEventListener('click', () => {
            window.location.href = 'mini-games.html';
        });
        

        
        // 모바일 방향 버튼
        document.querySelectorAll('.direction-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const direction = btn.dataset.direction;
                this.handleDirectionInput(direction);
            });
            
            // 터치 피드백 추가
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                btn.style.transform = 'scale(0.95)';
            });
            
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                btn.style.transform = '';
                const direction = btn.dataset.direction;
                this.handleDirectionInput(direction);
            });
        });
        
        // 캔버스 스와이프 제스처 추가
        this.setupSwipeControls();
    }
    
    startGameSync() {
        // 게임을 즉시 시작
        this.resetGame();
        this.scoreSubmitted = false; // 새 게임 시작 시 플래그 초기화
        
        // 세션 ID가 없는 경우에만 새로 발급
        if (!this.gameSessionId) {
            this.fetchNewGameSession().catch(error => {
                console.error('게임 세션 발급 실패:', error);
                // 세션 발급 실패해도 게임은 계속 진행
            });
        }
    }
    
    async startGame() {
        // 새로운 게임 세션 발급
        await this.fetchNewGameSession();
        this.resetGame();
        this.scoreSubmitted = false; // 새 게임 시작 시 플래그 초기화
    }
    
    endGame() {
        this.gameRunning = false;
        this.submitScore();
    }
    
    async submitScore() {
        if (this.scoreSubmitted) return; // 중복 제출 방지
        this.scoreSubmitted = true;
        if (!this.gameSessionId) {
            console.error('No game session ID available');
            return;
        }
        
        const gameData = {
            gameId: 'snake-game',
            score: this.score,
            sessionId: this.gameSessionId,
            playTime: this.getPlayTime(),
            length: this.snake.length
        };
        
        try {
            const response = await fetch('/api/games/submit-score', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(gameData)
            });
            
            const result = await response.json();
            if (result.success) {
                console.log('Score submitted successfully:', result);
            } else {
                console.error('Score submission failed:', result.error);
            }
        } catch (error) {
            console.error('Error submitting score:', error);
        }
    }
    
    resetGame() {
        this.snake = [{ x: 8, y: 7 }];
        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
        this.food = this.generateFood();
        this.score = 0;
        this.gameStartTime = Date.now();
        this.scoreSubmitted = false; // 리셋 시 플래그 초기화
        
        // 새로운 세션 ID 업데이트
        this.gameSessionId = localStorage.getItem('gameSessionId');
    }
    
    /**
     * 새로운 게임 세션 발급
     */
    async fetchNewGameSession() {
        try {
            const gameId = 'snake-game';


            const response = await fetch('/api/games/start-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ gameId }),
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('AUTHENTICATION_REQUIRED');
                } else if (response.status === 429) {
                    throw new Error('일일 게임 플레이 한도에 도달했습니다.');
                } else {
                    throw new Error('새로운 게임 세션 발급 실패');
                }
            }

            const data = await response.json();

            // 새로운 세션 ID를 로컬 스토리지에 저장
            localStorage.setItem('gameSessionId', data.sessionId);
            localStorage.setItem('gameId', gameId);
            localStorage.setItem('gameStartTime', Date.now().toString());


            this.gameSessionId = data.sessionId;
        } catch (error) {
            console.error('새로운 게임 세션 발급 오류:', error);

            if (error.message === 'AUTHENTICATION_REQUIRED') {
                window.errorHandler?.handleGlobalError(error, 'authentication');
            } else if (error.message.includes('한도')) {
                window.errorHandler?.showNotification(error.message, 'warning', 5000);
            } else {
                window.errorHandler?.handleGlobalError(error, 'network');
            }
        }
    }
    
    updateSnake() {
        // 방향 업데이트 (즉시 반영으로 변경)
        this.direction = { ...this.nextDirection };
        
        // 머리 위치 계산
        const head = { ...this.snake[0] };
        head.x += this.direction.x;
        head.y += this.direction.y;
        
        // 새 머리 추가
        this.snake.unshift(head);
        
        // 먹이를 먹지 않았다면 꼬리 제거
        if (head.x !== this.food.x || head.y !== this.food.y) {
            this.snake.pop();
        }
    }
    
    checkFoodCollision() {
        const head = this.snake[0];
        if (head.x === this.food.x && head.y === this.food.y) {
            this.addScore(10);
            this.food = this.generateFood();
            // 새로운 먹이 생성 시 애니메이션 리셋
            this.foodAnimation.startTime = Date.now();
        }
    }
    
    checkWallCollision() {
        const head = this.snake[0];
        const isColliding = head.x < 0 || head.x >= this.gridWidth || 
                            head.y < 0 || head.y >= this.gridHeight;

        if (isColliding) {
            if (this.wallCollisionTime === null) {
                // First impact
                this.wallCollisionTime = Date.now();
            } else {
                // Still colliding, check if grace period is over
                if (Date.now() - this.wallCollisionTime > this.wallCollisionGracePeriod) {
                    this.gameOver();
                }
            }
        } else {
            // Not colliding, so reset the grace period timer
            this.wallCollisionTime = null;
        }
    }
    
    checkSelfCollision() {
        const head = this.snake[0];
        for (let i = 1; i < this.snake.length; i++) {
            if (head.x === this.snake[i].x && head.y === this.snake[i].y) {
                this.gameOver();
                break;
            }
        }
    }
    
    generateFood() {
        let food;
        do {
            food = {
                x: Math.floor(Math.random() * this.gridWidth),
                y: Math.floor(Math.random() * this.gridHeight)
            };
        } while (this.snake.some(segment => segment.x === food.x && segment.y === food.y));
        
        // 랜덤한 과일 선택
        this.currentFruit = this.fruits[Math.floor(Math.random() * this.fruits.length)];
        
        return food;
    }
    
    drawGame(ctx) {
        // 뱀 그리기
        this.drawSnake(ctx);
        
        // 먹이 그리기
        this.drawFood(ctx);
    }
    

    
    drawSnake(ctx) {
        this.snake.forEach((segment, index) => {
            const x = segment.x * this.gridSize;
            const y = segment.y * this.gridSize;
            
            if (index === 0) {
                // 머리 - 밝은 파란색
                ctx.fillStyle = '#4285F4';
                ctx.fillRect(x + 1, y + 1, this.gridSize - 2, this.gridSize - 2);
                
                // 눈
                ctx.fillStyle = '#fff';
                const eyeSize = 3;
                const eyeOffset = 5;
                ctx.fillRect(x + eyeOffset, y + eyeOffset, eyeSize, eyeSize);
                ctx.fillRect(x + this.gridSize - eyeOffset - eyeSize, y + eyeOffset, eyeSize, eyeSize);
            } else {
                // 몸통 - 꼬리로 갈수록 진한 파란색
                const progress = index / this.snake.length; // 0~1 사이의 값
                const r = Math.floor(66 + (progress * 30)); // 66 -> 96
                const g = Math.floor(133 + (progress * 20)); // 133 -> 153
                const b = Math.floor(244 - (progress * 40)); // 244 -> 204
                
                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.fillRect(x + 1, y + 1, this.gridSize - 2, this.gridSize - 2);
            }
        });
    }
    
    drawFood(ctx) {
        const x = this.food.x * this.gridSize;
        const y = this.food.y * this.gridSize;
        
        // 애니메이션된 크기로 현재 과일 그리기
        const centerX = x + this.gridSize / 2;
        const centerY = y + this.gridSize / 2;
        const fontSize = (this.gridSize - 4) * this.foodAnimation.scale;
        
        ctx.save();
        ctx.font = `${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.currentFruit, centerX, centerY);
        ctx.restore();
    }
    

    
    updateFoodAnimation() {
        const currentTime = Date.now();
        const elapsed = (currentTime - this.foodAnimation.startTime) % this.foodAnimation.duration;
        const progress = elapsed / this.foodAnimation.duration;
        
        // 사인파를 사용하여 부드러운 호흡 애니메이션
        const sineValue = Math.sin(progress * 2 * Math.PI);
        this.foodAnimation.scale = this.foodAnimation.minScale + 
            (this.foodAnimation.maxScale - this.foodAnimation.minScale) * (sineValue + 1) / 2;
    }
    
    updateUI() {
        // 게임 헤더가 삭제되었으므로 UI 업데이트 불필요
        // 점수와 시간은 게임 엔진 내부에서 관리됨
    }
    
    handleKeyDown(e) {
        // 모달이 열려있는지 확인
        const modal = document.getElementById('gameResultModal');
        const isModalVisible = modal && modal.style.display !== 'none' && 
                              window.getComputedStyle(modal).display !== 'none';
        
        // 모달이 열려있을 때 스페이스바를 누르면 모달을 닫기
        if (isModalVisible && e.code === 'Space') {
            e.preventDefault();
            this.hideResult();
            return;
        }
        
        // 모달이 열려있을 때는 다른 키 입력 무시
        if (isModalVisible) {
            return;
        }
        
        super.handleKeyDown(e);
        
        // 방향키 처리
        switch (e.code) {
            case 'ArrowUp':
            case 'KeyW':
                e.preventDefault();
                this.handleDirectionInput('up');
                break;
            case 'ArrowDown':
            case 'KeyS':
                e.preventDefault();
                this.handleDirectionInput('down');
                break;
            case 'ArrowLeft':
            case 'KeyA':
                e.preventDefault();
                this.handleDirectionInput('left');
                break;
            case 'ArrowRight':
            case 'KeyD':
                e.preventDefault();
                this.handleDirectionInput('right');
                break;
        }
    }
    
    handleDirectionInput(direction) {
        if (this.gameState !== 'PLAYING') return;
        
        switch (direction) {
            case 'up':
                if (this.direction.y !== 1) {
                    this.nextDirection = { x: 0, y: -1 };
                }
                break;
            case 'down':
                if (this.direction.y !== -1) {
                    this.nextDirection = { x: 0, y: 1 };
                }
                break;
            case 'left':
                if (this.direction.x !== 1) {
                    this.nextDirection = { x: -1, y: 0 };
                }
                break;
            case 'right':
                if (this.direction.x !== -1) {
                    this.nextDirection = { x: 1, y: 0 };
                }
                break;
        }
    }
    
    async showResult(result) {
        
        // 새로운 GameResultUI 컴포넌트 사용
        const gameResult = {
            gameId: 'snake-game',
            score: result.score,
            playTime: result.playTime,
            length: this.snake.length,
            sessionId: this.gameSessionId,
            isSuccess: true
        };
        
        // 콜백 함수 설정
        window.gameResultUI.onPlayAgain = () => {
            // 다시 플레이 - 메뉴 화면으로 돌아가기
            this.hideResult();
            this.reset();
            // 게임을 메뉴 상태로 설정 (바로 시작하지 않음)
            this.gameState = 'MENU';
            // UI 버튼 상태 초기화
            document.getElementById('startBtn').style.display = 'inline-block';
            document.getElementById('pauseBtn').style.display = 'none';
            document.getElementById('pauseBtn').textContent = '일시정지';
        };
        
        window.gameResultUI.onBackToMenu = () => {
            // 게임 목록으로 돌아가기
            window.location.href = 'mini-games.html';
        };
        
        // 결과 화면 표시
        await window.gameResultUI.showResult(gameResult, {
            title: '게임 종료!',
            successTitle: '🐍 스네이크 게임 완료!',
            showLeaderboard: true // 리더보드 활성화
        });
        
        // 버튼 상태 초기화
        document.getElementById('startBtn').style.display = 'inline-block';
        document.getElementById('pauseBtn').style.display = 'none';
        document.getElementById('pauseBtn').textContent = '일시정지';
    }
    
    hideResult() {
        // 새로운 GameResultUI 컴포넌트에서 처리
        window.gameResultUI.hideModal();
    }
    
    // 게임 인스턴스 정리
    destroy() {
        // 부모 클래스의 destroy 호출
        super.destroy();
        
        // 스네이크 게임 특화 정리
        this.snake = [];
        this.food = null;
        this.scoreSubmitted = false;
        
        // 이벤트 리스너 제거 (부모 클래스에서 처리됨)
        // 추가적인 스네이크 게임 특화 정리만 수행
        
        console.log('SnakeGame 인스턴스 정리 완료');
    }
    
    setupSwipeControls() {
        const canvas = this.canvas;
        let startX = 0;
        let startY = 0;
        let endX = 0;
        let endY = 0;
        
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
        }, { passive: false });
        
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });
        
        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (e.changedTouches.length === 0) return;
            
            const touch = e.changedTouches[0];
            endX = touch.clientX;
            endY = touch.clientY;
            
            const deltaX = endX - startX;
            const deltaY = endY - startY;
            const minSwipeDistance = 30;
            
            // 스와이프 거리가 충분한지 확인
            if (Math.abs(deltaX) < minSwipeDistance && Math.abs(deltaY) < minSwipeDistance) {
                return;
            }
            
            // 가장 큰 변화량으로 방향 결정
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // 수평 스와이프
                if (deltaX > 0) {
                    this.handleDirectionInput('right');
                } else {
                    this.handleDirectionInput('left');
                }
            } else {
                // 수직 스와이프
                if (deltaY > 0) {
                    this.handleDirectionInput('down');
                } else {
                    this.handleDirectionInput('up');
                }
            }
        }, { passive: false });
    }
    
    // 게임 엔진 오버라이드
    drawBackground() {
        // Google 스타일: 밝은 녹색 체크무늬 배경
        const lightGreen = '#A7D948';  // 연한 초록색
        const darkerGreen = '#8ECC39'; // 짙은 초록색
        
        for (let x = 0; x < this.gridWidth; x++) {
            for (let y = 0; y < this.gridHeight; y++) {
                const isEven = (x + y) % 2 === 0;
                this.ctx.fillStyle = isEven ? lightGreen : darkerGreen;
                this.ctx.fillRect(
                    x * this.gridSize, 
                    y * this.gridSize, 
                    this.gridSize, 
                    this.gridSize
                );
            }
        }
    }
    
    drawMenuOverlay() {
        // 반투명 배경
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // 제목
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 28px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('🐍 스네이크 게임', this.width / 2, this.height / 2 - 40);
        
        // 안내 메시지
        this.ctx.font = '16px Arial';
        this.ctx.fillText('시작 버튼을 클릭하거나', this.width / 2, this.height / 2);
        this.ctx.fillText('스페이스바를 눌러 시작하세요', this.width / 2, this.height / 2 + 25);
        
        // 조작법
        this.ctx.font = '14px Arial';
        this.ctx.fillText('화살표 키 또는 WASD로 조작', this.width / 2, this.height / 2 + 60);
    }
}

// 게임 인스턴스 생성 및 시작
let snakeGame = null;
let isInitializing = false; // 초기화 중복 방지 플래그

// canvas 요소 찾기
let canvasElement = null;
function findCanvas() {
    if (!canvasElement) {
        canvasElement = document.getElementById('gameCanvas') || 
                       document.querySelector('#gameCanvas') ||
                       document.querySelector('canvas[id="gameCanvas"]');
        console.log('Canvas 검색 결과:', canvasElement);
    }
    return canvasElement;
}

// canvas 요소 생성 함수
function createCanvas() {
    const gameContainer = document.querySelector('.game-container');
    if (!gameContainer) {
        console.error('게임 컨테이너를 찾을 수 없습니다.');
        return null;
    }
    
    // 기존 canvas 제거 (있다면)
    const existingCanvas = gameContainer.querySelector('#gameCanvas');
    if (existingCanvas) {
        existingCanvas.remove();
    }
    
    // 새 canvas 생성
    const canvas = document.createElement('canvas');
    canvas.id = 'gameCanvas';
    canvas.width = 595;
    canvas.height = 525;
    canvas.style.border = '20px solid #578A34';
    canvas.style.borderRadius = '10px';
    canvas.style.background = '#2c3e50';
    canvas.style.display = 'block';
    canvas.style.margin = '0 auto';
    canvas.style.maxWidth = '595px';
    canvas.style.maxHeight = '525px';
    canvas.style.width = '595px';
    canvas.style.height = '525px';
    
    // canvas를 게임 컨테이너에 추가
    const gameInfo = gameContainer.querySelector('.game-info');
    if (gameInfo && gameInfo.nextSibling) {
        gameContainer.insertBefore(canvas, gameInfo.nextSibling);
    } else {
        gameContainer.appendChild(canvas);
    }
    
    console.log('Canvas 요소를 동적으로 생성했습니다:', canvas);
    return canvas;
}

// DOM 로딩 완료 후 게임 초기화
function initializeSnakeGame() {
    // 중복 초기화 방지
    if (isInitializing || snakeGame) {
        console.log('이미 초기화 중이거나 완료됨:', { isInitializing, snakeGame: !!snakeGame });
        return;
    }
    
    isInitializing = true;
    
    // 미리 찾아둔 canvas 사용
    const canvas = findCanvas();
    
    // 세션 확인
    const gameSessionId = localStorage.getItem('gameSessionId');
    const gameId = localStorage.getItem('gameId');
    
    if (!gameSessionId || gameId !== 'snake-game') {
        window.errorHandler.showErrorModal({
            title: '세션 오류',
            message: '유효하지 않은 게임 세션입니다. 게임 선택 페이지로 돌아갑니다.',
            type: 'game',
            actions: [
                {
                    text: '게임 목록으로',
                    action: () => window.location.href = 'mini-games.html',
                    primary: true
                }
            ]
        });
        return;
    }
    
    try {
        // DOM 요소가 준비될 때까지 대기 (showLoading 없이)
        const waitForCanvas = () => {
            // 미리 찾아둔 canvas 또는 다시 검색
            let canvas = findCanvas() || document.getElementById('gameCanvas') || 
                        document.querySelector('#gameCanvas') ||
                        document.querySelector('canvas[id="gameCanvas"]');
            
            
            // canvas가 없으면 동적으로 생성
            if (!canvas) {
                canvas = createCanvas();
            }
            
            if (canvas && canvas.tagName === 'CANVAS') {
                
                // canvas가 실제로 렌더링 가능한지 확인
                if (canvas.offsetWidth > 0 && canvas.offsetHeight > 0) {
                    try {
                        // 기존 게임 인스턴스가 있다면 정리
                        if (snakeGame) {
                            snakeGame.destroy();
                            snakeGame = null;
                        }
                        
                        snakeGame = new SnakeGame();
                        isInitializing = false; // 초기화 완료
                    } catch (e) {
                        console.error('SnakeGame 생성 중 오류:', e);
                        window.errorHandler.handleGlobalError(e, 'game');
                        isInitializing = false; // 오류 시에도 플래그 리셋
                    }
                } else {
                    console.log('Canvas가 아직 렌더링되지 않음, 200ms 후 재시도');
                    setTimeout(waitForCanvas, 200);
                }
            } else {
                console.log('Canvas 생성 실패, 200ms 후 재시도');
                setTimeout(waitForCanvas, 200);
            }
        };
        
        waitForCanvas();
        
    } catch (error) {
        console.error('게임 초기화 오류:', error);
        window.errorHandler.handleGlobalError(error, 'game');
    }
}

// 초기화 이벤트 설정
document.addEventListener('DOMContentLoaded', initializeSnakeGame);
window.addEventListener('load', () => {
    // load 이벤트는 DOMContentLoaded 이후에만 실행
    if (!snakeGame && !isInitializing) {
        console.log('load 이벤트에서 초기화 시도');
        initializeSnakeGame();
    }
});

// 페이지 이탈 시 경고
window.addEventListener('beforeunload', (e) => {
    if (snakeGame && snakeGame.gameState === 'PLAYING') {
        e.preventDefault();
        e.returnValue = '게임이 진행 중입니다. 정말 나가시겠습니까?';
    }
});