/**
 * 기억력 게임 (카드 매칭 게임) 구현
 */

class MemoryGame {
    constructor() {
        // 게임 설정
        this.difficulties = {
            easy: { rows: 4, cols: 4, name: '쉬움' },
            medium: { rows: 4, cols: 6, name: '보통' },
            hard: { rows: 6, cols: 6, name: '어려움' }
        };
        
        this.currentDifficulty = 'easy';
        this.cards = [];
        this.flippedCards = [];
        this.matchedPairs = 0;
        this.totalPairs = 0;
        this.attempts = 0;
        this.score = 0;
        this.startTime = null;
        this.endTime = null;
        this.gameState = 'MENU'; // MENU, PLAYING, PAUSED, COMPLETED
        this.gameTimer = null;
        
        // 게임 세션
        this.gameSessionId = localStorage.getItem('gameSessionId');
        
        // 카드 아이콘 (이모지)
        this.cardIcons = [
            '🍎', '🍌', '🍊', '🍇', '🍓', '🥝', '🍑', '🍒',
            '🥕', '🌽', '🥒', '🍅', '🥑', '🌶️', '🥔', '🍆',
            '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
            '🌸', '🌺', '🌻', '🌷', '🌹', '🌼', '🌿', '🍀',
            '⭐', '🌟', '✨', '💫', '🌙', '☀️', '🌈', '☁️'
        ];
        
        // BGM 관련 속성
        this.bgmTracks = ['/bgm/game_bgm_1.mp3', '/bgm/game_bgm_2.mp3'];
        this.bgmIndex = 0;
        this.bgmAudio = null;
        this.isBgmOn = true;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupDifficulty();
        this.createBoard();
        this.updateUI();
    }
    
    startGame() {
        this.gameState = 'PLAYING';
        this.startTime = Date.now();
        this.resetGame();
        this.updateUI();
        console.log('Memory Game started');
    }
    
    endGame() {
        this.gameState = 'COMPLETED';
        this.endTime = Date.now();
        this.submitScore();
        console.log('Memory Game ended');
    }
    
    async submitScore() {
        if (!this.gameSessionId) {
            console.error('No game session ID available');
            return;
        }
        
        const gameData = {
            gameId: 'memory-game',
            score: this.score,
            sessionId: this.gameSessionId,
            playTime: this.getPlayTime(),
            difficulty: this.currentDifficulty,
            attempts: this.attempts
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
    
    getPlayTime() {
        if (this.startTime && this.endTime) {
            return Math.floor((this.endTime - this.startTime) / 1000);
        }
        return 0;
    }
    
    setupEventListeners() {
        // 게임 컨트롤 버튼
        document.getElementById('startBtn').addEventListener('click', () => {
            this.startGame();
        });
        
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetGame();
        });
        
        document.getElementById('backBtn').addEventListener('click', () => {
            window.location.href = 'mini-games.html';
        });
        
        // BGM 토글 버튼
        const bgmToggleBtn = document.getElementById('bgmToggleBtn');
        if (bgmToggleBtn) {
            bgmToggleBtn.addEventListener('click', () => {
                this.toggleBgm();
            });
        }
        
        // 난이도 선택 버튼
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.gameState === 'PLAYING') {
                    if (!confirm('게임이 진행 중입니다. 난이도를 변경하면 게임이 초기화됩니다. 계속하시겠습니까?')) {
                        return;
                    }
                }
                
                this.setDifficulty(btn.dataset.difficulty);
            });
        });
    }
    
    setupDifficulty() {
        // 난이도 버튼 활성화 상태 업데이트
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.difficulty === this.currentDifficulty);
        });
    }
    
    setDifficulty(difficulty) {
        this.currentDifficulty = difficulty;
        this.setupDifficulty();
        this.resetGame();
        this.createBoard();
    }
    
    createBoard() {
        const gameBoard = document.getElementById('gameBoard');
        const config = this.difficulties[this.currentDifficulty];
        
        // 보드 그리드 클래스 설정
        gameBoard.className = `game-board grid-${config.cols}x${config.rows}`;
        
        // 총 카드 수 계산
        const totalCards = config.rows * config.cols;
        this.totalPairs = totalCards / 2;
        
        // 카드 아이콘 선택 및 복제
        const selectedIcons = this.cardIcons.slice(0, this.totalPairs);
        const cardData = [...selectedIcons, ...selectedIcons]; // 각 아이콘을 2개씩
        
        // 카드 섞기
        this.shuffleArray(cardData);
        
        // 카드 생성
        this.cards = [];
        gameBoard.innerHTML = '';
        
        cardData.forEach((icon, index) => {
            const card = this.createCard(icon, index);
            this.cards.push(card);
            gameBoard.appendChild(card.element);
        });
    }
    
    createCard(icon, index) {
        const cardElement = document.createElement('div');
        cardElement.className = 'memory-card';
        cardElement.dataset.index = index;
        cardElement.textContent = '?';
        
        const card = {
            element: cardElement,
            icon: icon,
            index: index,
            isFlipped: false,
            isMatched: false
        };
        
        cardElement.addEventListener('click', () => {
            this.handleCardClick(card);
        });
        
        // 모바일 터치 최적화
        cardElement.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!card.isFlipped && !card.isMatched && this.gameState === 'PLAYING') {
                cardElement.style.transform = 'scale(0.95)';
            }
        });
        
        cardElement.addEventListener('touchend', (e) => {
            e.preventDefault();
            cardElement.style.transform = '';
            this.handleCardClick(card);
        });
        
        return card;
    }
    
    handleCardClick(card) {
        if (this.gameState !== 'PLAYING') return; // PREVIEW 상태에서는 클릭 불가
        if (card.isFlipped || card.isMatched) return;
        if (this.flippedCards.length >= 2) return;
        
        this.flipCard(card);
        this.flippedCards.push(card);
        
        if (this.flippedCards.length === 2) {
            this.attempts++;
            this.updateUI();
            
            setTimeout(() => {
                this.checkMatch();
            }, 1000);
        }
    }
    
    flipCard(card) {
        card.isFlipped = true;
        card.element.classList.add('flipped', 'flip-animation');
        card.element.textContent = card.icon;
    }
    
    unflipCard(card) {
        card.isFlipped = false;
        card.element.classList.remove('flipped');
        card.element.textContent = '?';
    }
    
    checkMatch() {
        const [card1, card2] = this.flippedCards;
        
        if (card1.icon === card2.icon) {
            // 매치 성공
            this.matchCards(card1, card2);
            this.matchedPairs++;
            this.addScore(this.calculateMatchScore());
            
            if (this.matchedPairs === this.totalPairs) {
                this.completeGame();
            }
        } else {
            // 매치 실패
            this.unflipCard(card1);
            this.unflipCard(card2);
        }
        
        this.flippedCards = [];
        this.updateUI();
    }
    
    matchCards(card1, card2) {
        card1.isMatched = true;
        card2.isMatched = true;
        card1.element.classList.add('matched');
        card2.element.classList.add('matched');
    }
    
    calculateMatchScore() {
        const baseScore = 25; // 50에서 25로 감소
        const difficultyMultiplier = {
            easy: 1,
            medium: 1.2, // 1.5에서 1.2로 감소
            hard: 1.5    // 2에서 1.5로 감소
        };
        
        const timeBonus = Math.max(0, 15 - this.getPlayTime()); // 30에서 15로 감소
        const accuracyBonus = this.attempts > 0 ? Math.floor((this.matchedPairs / this.attempts) * 10) : 0; // 20에서 10으로 감소
        
        return Math.floor(baseScore * difficultyMultiplier[this.currentDifficulty] + timeBonus + accuracyBonus);
    }
    
    startGame() {
        if (this.gameState === 'PLAYING') return;
        
        this.gameState = 'PREVIEW'; // 미리보기 상태 추가
        
        // UI 업데이트
        document.getElementById('startBtn').style.display = 'none';
        document.getElementById('resetBtn').style.display = 'inline-block';
        
        // 모든 카드를 잠깐 보여주기
        this.showAllCards();
        
        // 미리보기 메시지 표시 및 카운트다운 시작
        this.showPreviewMessage();
        
        // 3초 후에 카드를 뒤집고 게임 시작
        setTimeout(() => {
            this.hideAllCards();
            this.hidePreviewMessage();
            this.actuallyStartGame();
        }, 3000);
    }
    
    showAllCards() {
        this.cards.forEach(card => {
            card.element.classList.add('flipped', 'preview');
            card.element.textContent = card.icon;
        });
    }
    
    hideAllCards() {
        this.cards.forEach(card => {
            card.element.classList.remove('flipped', 'preview');
            card.element.textContent = '?';
            card.isFlipped = false;
        });
    }
    
    showPreviewMessage() {
        const previewMessage = document.getElementById('previewMessage');
        const previewCountdown = document.getElementById('previewCountdown');
        
        previewMessage.style.display = 'block';
        
        let countdown = 3;
        previewCountdown.textContent = countdown;
        
        const countdownInterval = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                previewCountdown.textContent = countdown;
            } else {
                clearInterval(countdownInterval);
            }
        }, 1000);
    }
    
    hidePreviewMessage() {
        const previewMessage = document.getElementById('previewMessage');
        previewMessage.style.display = 'none';
    }
    
    actuallyStartGame() {
        this.gameState = 'PLAYING';
        this.startTime = Date.now();
        this.endTime = null;
        
        // 타이머 시작
        this.gameTimer = setInterval(() => {
            this.updateUI();
        }, 1000);
        
        // 카드 활성화
        this.cards.forEach(card => {
            card.element.classList.remove('disabled');
        });
        
        // BGM 재생
        this.playBgm();
        
        this.updateUI();
    }
    

    
    resetGame() {
        this.gameState = 'MENU';
        this.matchedPairs = 0;
        this.attempts = 0;
        this.score = 0;
        this.startTime = null;
        this.endTime = null;
        this.flippedCards = [];
        
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
            this.gameTimer = null;
        }
        
        // BGM 정지
        this.stopBgm();
        
        // UI 초기화
        document.getElementById('startBtn').style.display = 'inline-block';
        document.getElementById('resetBtn').style.display = 'none';
        
        // 새로운 세션 ID 업데이트 (이미 game-result-ui.js에서 발급받음)
        this.gameSessionId = localStorage.getItem('gameSessionId');
        
        this.createBoard();
        this.updateUI();
    }
    
    completeGame() {
        this.gameState = 'COMPLETED';
        this.endTime = Date.now();
        
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
            this.gameTimer = null;
        }
        
        // BGM 정지
        this.stopBgm();
        
        // 완료 보너스 점수
        const completionBonus = this.calculateCompletionBonus();
        this.addScore(completionBonus);
        
        this.showResult();
    }
    
    calculateCompletionBonus() {
        const baseBonus = 50; // 100에서 50으로 감소
        const difficultyMultiplier = {
            easy: 1,
            medium: 1.2, // 1.5에서 1.2로 감소
            hard: 1.5    // 2에서 1.5로 감소
        };
        
        const timeBonus = Math.max(0, 150 - this.getPlayTime()); // 300에서 150으로 감소 (2.5분 이내)
        const perfectBonus = this.attempts === this.totalPairs ? 100 : 0; // 200에서 100으로 감소
        
        return Math.floor((baseBonus + timeBonus + perfectBonus) * difficultyMultiplier[this.currentDifficulty]);
    }
    
    addScore(points) {
        this.score += points;
    }
    
    getPlayTime() {
        if (!this.startTime) return 0;
        const endTime = this.endTime || Date.now();
        return Math.floor((endTime - this.startTime) / 1000);
    }
    
    updateUI() {
        document.getElementById('scoreDisplay').textContent = this.score;
        document.getElementById('timeDisplay').textContent = this.getPlayTime() + '초';
        document.getElementById('attemptsDisplay').textContent = this.attempts;
        document.getElementById('matchesDisplay').textContent = `${this.matchedPairs}/${this.totalPairs}`;
    }
    
    async showResult() {
        const playTime = this.getPlayTime();
        const accuracy = this.attempts > 0 ? Math.round((this.matchedPairs / this.attempts) * 100) : 100;
        
        // 새로운 GameResultUI 컴포넌트 사용
        const gameResult = {
            gameId: 'memory-game',
            score: this.score,
            playTime: playTime,
            attempts: this.attempts,
            accuracy: accuracy,
            sessionId: this.gameSessionId,
            isSuccess: true,
            additionalData: {
                difficulty: this.currentDifficulty,
                matchedPairs: this.matchedPairs,
                totalPairs: this.totalPairs
            }
        };
        
        // 콜백 함수 설정
        window.gameResultUI.setCallbacks(
            () => {
                // 다시 플레이 - 메뉴 화면으로 돌아가기
                this.hideResult();
                this.resetGame();
                // 게임을 메뉴 상태로 설정 (바로 시작하지 않음)
                this.gameState = 'MENU';
                // UI 버튼 상태 초기화
                document.getElementById('startBtn').style.display = 'inline-block';
                document.getElementById('pauseBtn').style.display = 'none';
            },
            () => {
                // 게임 목록으로 돌아가기
                window.location.href = 'mini-games.html';
            }
        );
        
        // 결과 화면 표시 (리더보드 활성화)
        await window.gameResultUI.showResult(gameResult, {
            title: '게임 완료!',
            successTitle: '🧠 기억력 게임 완료!',
            showLeaderboard: true
        });
        
        // 버튼 상태 초기화
        document.getElementById('startBtn').style.display = 'inline-block';
        document.getElementById('resetBtn').style.display = 'none';
    }
    
    hideResult() {
        // 새로운 GameResultUI 컴포넌트에서 처리
        window.gameResultUI.hideModal();
    }
    
    // 배열 섞기 (Fisher-Yates 알고리즘)
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
    
    // BGM 관련 메서드
    playBgm() {
        if (!this.isBgmOn || this.bgmTracks.length === 0) return;
        
        // 기존 오디오 정지 및 해제
        if (this.bgmAudio) {
            this.bgmAudio.pause();
            this.bgmAudio = null;
        }
        
        // 새로운 Audio 객체 생성 및 재생
        this.bgmAudio = new Audio(this.bgmTracks[this.bgmIndex]);
        this.bgmAudio.volume = 0.5; // 볼륨 조절
        this.bgmAudio.onended = () => this.handleBgmEnded();
        this.bgmAudio.play().catch(error => {
            console.warn('BGM 재생 실패:', error);
        });
        
        // 버튼 아이콘 업데이트
        this.updateBgmButtonIcon();
    }
    
    stopBgm() {
        if (this.bgmAudio) {
            this.bgmAudio.pause();
            this.bgmAudio.currentTime = 0;
            this.bgmAudio = null;
        }
    }
    
    toggleBgm() {
        this.isBgmOn = !this.isBgmOn;
        
        if (this.isBgmOn) {
            if (this.gameState === 'PLAYING') {
                this.playBgm();
            }
        } else {
            this.stopBgm();
        }
        
        // 버튼 아이콘 업데이트
        this.updateBgmButtonIcon();
    }
    
    handleBgmEnded() {
        this.bgmIndex = (this.bgmIndex + 1) % this.bgmTracks.length;
        this.playBgm();
    }
    
    updateBgmButtonIcon() {
        const bgmToggleBtn = document.getElementById('bgmToggleBtn');
        if (bgmToggleBtn) {
            bgmToggleBtn.textContent = this.isBgmOn ? '🔊' : '🔇';
        }
    }
}

// 게임 인스턴스 생성 및 시작
let memoryGame;

document.addEventListener('DOMContentLoaded', () => {
    // 세션 확인
    const gameSessionId = localStorage.getItem('gameSessionId');
    const gameId = localStorage.getItem('gameId');
    
    if (!gameSessionId || gameId !== 'memory-game') {
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
        const waitForBoard = () => {
            const board = document.getElementById('gameBoard');
            console.log('Memory board 검색 결과:', board);
            if (board) {
                console.log('Memory board 준비됨, MemoryGame 생성 시작');
                try {
                    memoryGame = new MemoryGame();
                    console.log('MemoryGame 인스턴스 생성 성공');
                    console.log('기억력 게임 초기화 완료');
                } catch (e) {
                    console.error('MemoryGame 생성 중 오류:', e);
                    window.errorHandler.handleGlobalError(e, 'game');
                }
            } else {
                console.log('Memory board를 찾을 수 없음, 200ms 후 재시도');
                setTimeout(waitForBoard, 200);
            }
        };
        
        waitForBoard();
        
    } catch (error) {
        console.error('게임 초기화 오류:', error);
        window.errorHandler.handleGlobalError(error, 'game');
    }
});

// 페이지 이탈 시 경고
window.addEventListener('beforeunload', (e) => {
    if (memoryGame && memoryGame.gameState === 'PLAYING') {
        e.preventDefault();
        e.returnValue = '게임이 진행 중입니다. 정말 나가시겠습니까?';
    }
});

// 키보드 단축키
document.addEventListener('keydown', (e) => {
    if (!memoryGame) return;
    
    switch (e.code) {
        case 'Space':
            e.preventDefault();
            if (memoryGame.gameState === 'MENU') {
                memoryGame.startGame();
            }
            break;
        case 'KeyR':
            if (e.ctrlKey) {
                e.preventDefault();
                memoryGame.resetGame();
            }
            break;
    }
});