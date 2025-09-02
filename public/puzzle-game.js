/**
 * 퍼즐 게임 (슬라이딩 퍼즐) 구현
 * 드래그 앤 드롭과 터치 이벤트를 모두 지원
 */

class PuzzleGame {
    constructor() {
        // 게임 설정
        this.difficulties = {
            easy: { size: 3, name: '쉬움' },
            medium: { size: 4, name: '보통' },
            hard: { size: 5, name: '어려움' }
        };
        
        this.currentDifficulty = 'easy';
        this.puzzleSize = 3;
        this.pieces = [];
        this.correctPositions = [];
        this.emptyPosition = { row: 2, col: 2 }; // 빈 공간 위치
        this.selectedPiece = null;
        
        // 게임 상태
        this.gameState = 'MENU'; // MENU, PLAYING, PAUSED, COMPLETED
        this.startTime = null;
        this.endTime = null;
        this.gameTimer = null;
        this.moves = 0;
        this.score = 0;
        
        // 게임 세션
        this.gameSessionId = localStorage.getItem('gameSessionId');
        
        // 드래그 앤 드롭 상태
        this.draggedPiece = null;
        this.isDragging = false;
        
        // 터치 지원
        this.isTouchDevice = 'ontouchstart' in window;
        
        // 섞기 상태 추적
        this.isShuffled = false;
        
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
        this.createPuzzle();
        this.updateUI();
    }
    
    async startGame() {
        if (this.gameState === 'PLAYING') return;
        
        // 실제 시작 시점에 세션을 새로 발급하여 서버의 세션 시작 시간과 동기화
        try {
            if (window.gameResultUI && typeof window.gameResultUI.fetchNewGameSession === 'function') {
                // 로컬스토리지의 gameId가 존재해야 함 (mini-games에서 설정됨)
                await window.gameResultUI.fetchNewGameSession();
                this.gameSessionId = localStorage.getItem('gameSessionId');
            }
        } catch (e) {
            console.warn('세션 동기화 실패(게임은 계속 진행):', e);
        }
        
        // 이미 섞인 상태가 아니라면 섞기
        if (!this.isShuffled) {
            this.shufflePuzzle(false);
        }
        
        this.gameState = 'PLAYING';
        this.startTime = Date.now();
        this.endTime = null;
        
        // 타이머 시작
        this.gameTimer = setInterval(() => {
            this.updateUI();
        }, 1000);
        
        // UI 업데이트
        const startBtn = document.getElementById('startBtn');
        const resetBtn = document.getElementById('resetBtn');
        
        if (startBtn) startBtn.style.display = 'none';
        if (resetBtn) resetBtn.style.display = 'inline-block';
        
        // BGM 재생
        this.playBgm();
        
        this.updateUI();
        console.log('Puzzle Game started');
    }
    
    // endGame() 메서드 제거 - showResult()에서 처리하도록 변경
    
    // submitScore() 메서드 제거 - game-result-ui.js에서 처리하도록 변경
    
    setupEventListeners() {
        // 게임 컨트롤 버튼
        const startBtn = document.getElementById('startBtn');
        const shuffleBtn = document.getElementById('shuffleBtn');
        const resetBtn = document.getElementById('resetBtn');
        const backBtn = document.getElementById('backBtn');
        const bgmToggleBtn = document.getElementById('bgmToggleBtn');
        
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.startGame();
            });
        }
        
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', () => {
                this.shufflePuzzle();
            });
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetGame();
            });
        }
        
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.location.href = 'mini-games.html';
            });
        }
        
        // BGM 토글 버튼
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
        this.puzzleSize = this.difficulties[difficulty].size;
        this.emptyPosition = { row: this.puzzleSize - 1, col: this.puzzleSize - 1 };
        
        this.setupDifficulty();
        this.resetGame();
        this.createPuzzle();
        this.isShuffled = false; // 난이도 변경 시 섞기 상태 초기화
    }
    
    createPuzzle() {
        const puzzleBoard = document.getElementById('puzzleBoard');
        const referenceGrid = document.getElementById('referenceGrid');
        
        // 보드 그리드 클래스 설정
        const gridClass = `grid-${this.puzzleSize}x${this.puzzleSize}`;
        puzzleBoard.className = `puzzle-board ${gridClass}`;
        referenceGrid.className = `reference-grid ${gridClass}`;
        
        // 퍼즐 조각 데이터 생성
        this.pieces = [];
        this.correctPositions = [];
        
        for (let row = 0; row < this.puzzleSize; row++) {
            for (let col = 0; col < this.puzzleSize; col++) {
                const number = row * this.puzzleSize + col + 1;
                const isEmpty = row === this.puzzleSize - 1 && col === this.puzzleSize - 1;
                
                if (!isEmpty) {
                    this.pieces.push({
                        number: number,
                        currentRow: row,
                        currentCol: col,
                        correctRow: row,
                        correctCol: col
                    });
                }
                
                this.correctPositions.push({
                    row: row,
                    col: col,
                    number: isEmpty ? null : number
                });
            }
        }
        
        // 디버깅: 초기 조각 위치 확인
        console.log('Initial pieces:', this.pieces.map(p => `Piece ${p.number}: (${p.currentRow}, ${p.currentCol})`));
        
        // 빈 공간 위치 초기화
        this.emptyPosition = { row: this.puzzleSize - 1, col: this.puzzleSize - 1 };
        
        // DOM 요소 생성
        this.createPuzzleElements();
        this.createReferenceElements();
    }
    
    createPuzzleElements() {
        const puzzleBoard = document.getElementById('puzzleBoard');
        puzzleBoard.innerHTML = '';
        // 포인터 제스처와 스크롤 충돌 방지
        puzzleBoard.style.touchAction = 'none';
        
        // 모든 위치를 순회하면서 조각이나 빈 공간 생성
        for (let row = 0; row < this.puzzleSize; row++) {
            for (let col = 0; col < this.puzzleSize; col++) {
                // 현재 위치가 빈 공간인지 확인
                const isEmpty = row === this.emptyPosition.row && col === this.emptyPosition.col;
                
                if (isEmpty) {
                    // 빈 공간 생성
                    const element = document.createElement('div');
                    element.className = 'puzzle-piece empty';
                    element.dataset.row = row;
                    element.dataset.col = col;
                    element.textContent = '';
                    puzzleBoard.appendChild(element);
                } else {
                    // 조각 찾기 - 더 정확한 방법 사용
                    const piece = this.pieces.find(p => 
                        p.currentRow === row && p.currentCol === col
                    );
                    
                    if (piece) {
                        const element = this.createPieceElement(piece, row, col);
                        puzzleBoard.appendChild(element);
                    } else {
                        // 조각을 찾지 못한 경우 - 빈 공간으로 처리
                        console.warn(`No piece found at position (${row}, ${col})`);
                        const element = document.createElement('div');
                        element.className = 'puzzle-piece empty';
                        element.dataset.row = row;
                        element.dataset.col = col;
                        element.textContent = '';
                        puzzleBoard.appendChild(element);
                    }
                }
            }
        }
        
        // 디버깅: 빈 공간 위치 확인
        console.log('Empty position:', this.emptyPosition);
        console.log('Total pieces:', this.pieces.length);
        console.log('Expected pieces:', this.puzzleSize * this.puzzleSize - 1);
        console.log('Empty cells found:', document.querySelectorAll('.puzzle-piece.empty').length);
        console.log('Pieces positions:', this.pieces.map(p => `Piece ${p.number}: (${p.currentRow}, ${p.currentCol})`));
    }
    
    createPieceElement(piece, row, col) {
        const element = document.createElement('div');
        element.className = 'puzzle-piece';
        element.dataset.row = row;
        element.dataset.col = col;
        
        if (piece) {
            element.textContent = piece.number;
            element.dataset.number = piece.number;
            
            // 올바른 위치에 있는지 확인
            if (piece.currentRow === piece.correctRow && piece.currentCol === piece.correctCol) {
                element.classList.add('correct');
            }
            
            // 이벤트 리스너 추가
            this.addPieceEventListeners(element, piece);
        }
        
        return element;
    }
    
    addPieceEventListeners(element, piece) {
        // 공통: 포인터 이벤트 기반 드래그(모바일/PC 동일 동작)
        let pointerDragging = false;
        let startRow = 0;
        let startCol = 0;
        
        element.addEventListener('pointerdown', (e) => {
            if (this.gameState !== 'PLAYING') return;
            // 마우스 오른쪽 등은 무시
            if (e.button && e.button !== 0) return;
            pointerDragging = true;
            element.setPointerCapture?.(e.pointerId);
            startRow = piece.currentRow;
            startCol = piece.currentCol;
            element.classList.add('dragging');
        });
        
        element.addEventListener('pointermove', (e) => {
            if (!pointerDragging) return;
            // 빈칸 위에만 드롭 허용: 이동 중에는 시각적 피드백만
        });
        
        element.addEventListener('pointerup', (e) => {
            if (!pointerDragging) return;
            pointerDragging = false;
            element.releasePointerCapture?.(e.pointerId);
            element.classList.remove('dragging');
            
            // 포인터가 놓인 좌표의 셀을 계산하여 빈칸인지 판단
            const board = document.getElementById('puzzleBoard');
            const rect = board.getBoundingClientRect();
            const cellWidth = rect.width / this.puzzleSize;
            const cellHeight = rect.height / this.puzzleSize;
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const dropCol = Math.floor(x / cellWidth);
            const dropRow = Math.floor(y / cellHeight);
            
            if (dropRow === this.emptyPosition.row && dropCol === this.emptyPosition.col) {
                // 조각이 실제로 빈칸과 인접한지 검증 후 이동
                if (this.canMovePiece(piece)) {
                    this.movePiece(piece);
                }
            } else {
                // 보조: 클릭으로도 이동 가능(인접 시)
                if (this.canMovePiece(piece)) {
                    // 포인터업 위치가 빈칸이 아니면 이동하지 않음
                }
            }
        });
        
        // 키보드/클릭 보조 동작 유지
        element.addEventListener('click', () => {
            if (this.gameState !== 'PLAYING') return;
            if (this.canMovePiece(piece)) {
                this.movePiece(piece);
            }
        });
        
        // 기존 마우스 D&D는 유지하되 포인터와 중복되지 않도록 최소화
        element.draggable = true;
        element.addEventListener('dragstart', (e) => { this.handleDragStart(e, piece); });
        element.addEventListener('dragover', (e) => { e.preventDefault(); });
        element.addEventListener('drop', (e) => { e.preventDefault(); this.handleDrop(e, piece); });
    }
    
    createReferenceElements() {
        const referenceGrid = document.getElementById('referenceGrid');
        referenceGrid.innerHTML = '';
        
        for (let row = 0; row < this.puzzleSize; row++) {
            for (let col = 0; col < this.puzzleSize; col++) {
                const element = document.createElement('div');
                element.className = 'reference-cell';
                
                const number = row * this.puzzleSize + col + 1;
                const isEmpty = row === this.puzzleSize - 1 && col === this.puzzleSize - 1;
                
                element.textContent = isEmpty ? '' : number;
                referenceGrid.appendChild(element);
            }
        }
    }
    
    handlePieceTouch(piece) {
        if (this.gameState !== 'PLAYING') return;
        
        if (this.selectedPiece === piece) {
            // 같은 조각을 다시 터치하면 선택 해제
            this.selectedPiece = null;
            this.updatePieceSelection();
        } else if (this.selectedPiece === null) {
            // 조각 선택
            this.selectedPiece = piece;
            this.updatePieceSelection();
        } else {
            // 다른 조각이 선택된 상태에서 빈 공간 근처의 조각을 터치
            if (this.canMovePiece(piece)) {
                this.movePiece(piece);
                this.selectedPiece = null;
                this.updatePieceSelection();
            } else {
                // 새로운 조각 선택
                this.selectedPiece = piece;
                this.updatePieceSelection();
            }
        }
    }
    
    handlePieceClick(piece) {
        if (this.gameState !== 'PLAYING') return;
        if (this.isTouchDevice) return; // 터치 디바이스에서는 클릭 이벤트 무시
        
        if (this.canMovePiece(piece)) {
            this.movePiece(piece);
        }
    }
    
    handleDragStart(e, piece) {
        if (this.gameState !== 'PLAYING') return;
        
        this.draggedPiece = piece;
        this.isDragging = true;
        e.dataTransfer.effectAllowed = 'move';
        e.target.classList.add('dragging');
    }
    
    handleDrop(e, targetPiece) {
        if (this.gameState !== 'PLAYING') return;
        if (!this.draggedPiece) return;
        
        // 빈 공간으로 드롭하는 경우
        const dropRow = parseInt(e.target.dataset.row);
        const dropCol = parseInt(e.target.dataset.col);
        
        if (dropRow === this.emptyPosition.row && dropCol === this.emptyPosition.col) {
            if (this.canMovePiece(this.draggedPiece)) {
                this.movePiece(this.draggedPiece);
            }
        }
        
        // 드래그 상태 정리
        document.querySelectorAll('.puzzle-piece.dragging').forEach(el => {
            el.classList.remove('dragging');
        });
        
        this.draggedPiece = null;
        this.isDragging = false;
    }
    
    canMovePiece(piece) {
        const rowDiff = Math.abs(piece.currentRow - this.emptyPosition.row);
        const colDiff = Math.abs(piece.currentCol - this.emptyPosition.col);
        
        // 빈 공간과 인접한 위치에 있는 조각만 이동 가능
        return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
    }
    
    movePiece(piece) {
        if (!this.canMovePiece(piece)) return;
        
        // 조각과 빈 공간의 위치 교환
        const oldRow = piece.currentRow;
        const oldCol = piece.currentCol;
        
        piece.currentRow = this.emptyPosition.row;
        piece.currentCol = this.emptyPosition.col;
        
        this.emptyPosition.row = oldRow;
        this.emptyPosition.col = oldCol;
        
        this.moves++;
        this.addScore(this.calculateMoveScore());
        
        // DOM 업데이트
        this.createPuzzleElements();
        this.updateUI();
        
        // 완성 확인
        if (this.isPuzzleComplete()) {
            this.completeGame();
        }
    }
    
    updatePieceSelection() {
        document.querySelectorAll('.puzzle-piece').forEach(el => {
            el.classList.remove('selected');
        });
        
        if (this.selectedPiece) {
            const selectedElement = document.querySelector(
                `[data-number="${this.selectedPiece.number}"]`
            );
            if (selectedElement) {
                selectedElement.classList.add('selected');
            }
        }
    }
    
    isPuzzleComplete() {
        return this.pieces.every(piece => 
            piece.currentRow === piece.correctRow && 
            piece.currentCol === piece.correctCol
        );
    }
    
    shufflePuzzle(showConfirm = true) {
        if (this.gameState === 'PLAYING' && showConfirm) {
            if (!confirm('게임이 진행 중입니다. 퍼즐을 섞으면 게임이 초기화됩니다. 계속하시겠습니까?')) {
                return;
            }
        }
        
        // 빈 공간 위치 초기화 (오른쪽 하단)
        this.emptyPosition = { row: this.puzzleSize - 1, col: this.puzzleSize - 1 };
        
        // 모든 조각을 올바른 초기 위치로 재설정
        this.pieces.forEach((piece, index) => {
            const row = Math.floor(index / this.puzzleSize);
            const col = index % this.puzzleSize;
            
            // 마지막 조각(빈 공간)은 건너뛰기
            if (row === this.puzzleSize - 1 && col === this.puzzleSize - 1) {
                return;
            }
            
            piece.currentRow = row;
            piece.currentCol = col;
        });
        
        // 퍼즐을 무작위로 섞기 (해결 가능한 상태 보장)
        const shuffleMoves = this.puzzleSize * this.puzzleSize * 10;
        
        for (let i = 0; i < shuffleMoves; i++) {
            const movablePieces = this.pieces.filter(piece => this.canMovePiece(piece));
            if (movablePieces.length > 0) {
                const randomPiece = movablePieces[Math.floor(Math.random() * movablePieces.length)];
                
                // 조각과 빈 공간의 위치 교환 (점수나 이동 횟수에 영향 없음)
                const oldRow = randomPiece.currentRow;
                const oldCol = randomPiece.currentCol;
                
                randomPiece.currentRow = this.emptyPosition.row;
                randomPiece.currentCol = this.emptyPosition.col;
                
                this.emptyPosition.row = oldRow;
                this.emptyPosition.col = oldCol;
            }
        }
        
        // 게임 상태 초기화
        this.moves = 0;
        this.score = 0;
        this.selectedPiece = null;
        
        // 섞기 완료 표시
        this.isShuffled = true;
        
        // 디버깅: 섞기 후 조각 위치 확인
        console.log('After shuffle - Empty position:', this.emptyPosition);
        console.log('After shuffle - Pieces positions:', this.pieces.map(p => `Piece ${p.number}: (${p.currentRow}, ${p.currentCol})`));
        
        this.createPuzzleElements();
        this.updateUI();
    }
    
    calculateMoveScore() {
        const baseScore = 1; // 기본 점수를 3에서 1로 더 감소
        const difficultyMultiplier = {
            easy: 1,
            medium: 1.1, // 1.2에서 1.1로 감소
            hard: 1.3    // 1.5에서 1.3으로 감소
        };
        
        // 효율적인 이동에 대한 보너스 (매우 엄격하게)
        const efficiency = this.calculateEfficiency();
        const efficiencyBonus = efficiency > 0.95 ? 1 : 0; // 0.9에서 0.95로 상향, 보너스 2에서 1로 감소
        
        return Math.floor(baseScore * difficultyMultiplier[this.currentDifficulty] + efficiencyBonus);
    }
    
    calculateEfficiency() {
        // 게임 완료 시에는 섞기 시작 시점의 상태를 기준으로 계산
        if (this.gameState === 'COMPLETED') {
            return this.calculateCompletionEfficiency();
        }
        
        const minMoves = this.getMinimumMoves();
        const optimalMoves = this.getOptimalMoves();
        
        // 더 합리적인 효율성 계산
        if (this.moves === 0) return 0;
        
        // 최적 이동 횟수와 실제 이동 횟수 비교
        const moveEfficiency = optimalMoves > 0 ? Math.min(1, optimalMoves / this.moves) : 0;
        
        // 추가 페널티: 너무 많은 이동에 대한 감점 (더 관대하게)
        const penalty = this.moves > optimalMoves * 3 ? 0.2 : 0; // 2배에서 3배로, 0.3에서 0.2로
        
        const efficiency = Math.max(0, moveEfficiency - penalty);
        
        // 디버깅: 효율성 계산
        console.log('=== Efficiency Calculation ===');
        console.log('Optimal Moves:', optimalMoves);
        console.log('Actual Moves:', this.moves);
        console.log('Move Efficiency:', moveEfficiency);
        console.log('Penalty:', penalty);
        console.log('Final Efficiency:', efficiency);
        console.log('=============================');
        
        return efficiency;
    }
    
    calculateCompletionEfficiency() {
        // 게임 완료 시 효율성 계산 (섞기 시작 시점 기준)
        const totalPieces = this.puzzleSize * this.puzzleSize - 1; // 빈 공간 제외
        const expectedMoves = totalPieces * 2; // 각 조각당 평균 2번 이동
        
        if (this.moves === 0) return 0;
        
        // 이동 횟수 기반 효율성 (더 관대하게)
        const moveEfficiency = Math.min(1, expectedMoves / this.moves);
        
        // 시간 기반 효율성 (3분 이내 완료 시 보너스)
        const timeEfficiency = this.getPlayTime() <= 180 ? 0.2 : 0;
        
        const totalEfficiency = Math.min(1, moveEfficiency + timeEfficiency);
        
        console.log('=== Completion Efficiency Calculation ===');
        console.log('Total Pieces:', totalPieces);
        console.log('Expected Moves:', expectedMoves);
        console.log('Actual Moves:', this.moves);
        console.log('Move Efficiency:', moveEfficiency);
        console.log('Time Efficiency:', timeEfficiency);
        console.log('Total Efficiency:', totalEfficiency);
        console.log('=======================================');
        
        return totalEfficiency;
    }
    
    getMinimumMoves() {
        // 간단한 추정: 각 조각이 올바른 위치까지의 맨하탄 거리의 합
        return this.pieces.reduce((total, piece) => {
            const distance = Math.abs(piece.currentRow - piece.correctRow) + 
                           Math.abs(piece.currentCol - piece.correctCol);
            return total + distance;
        }, 0);
    }
    
    getOptimalMoves() {
        // 더 정확한 최적 이동 횟수 계산
        const minMoves = this.getMinimumMoves();
        
        // 퍼즐 크기에 따른 기본 이동 횟수 추가 (더 합리적으로)
        const baseMoves = this.puzzleSize * this.puzzleSize * 0.5; // 2에서 0.5로 감소
        
        // 섞기 정도에 따른 추가 이동
        const shuffleFactor = this.getShuffleFactor();
        
        const optimalMoves = Math.floor(minMoves + baseMoves * shuffleFactor);
        
        // 디버깅: 최적 이동 횟수 계산
        console.log('=== Optimal Moves Calculation ===');
        console.log('Min Moves:', minMoves);
        console.log('Base Moves:', baseMoves);
        console.log('Shuffle Factor:', shuffleFactor);
        console.log('Optimal Moves:', optimalMoves);
        console.log('Actual Moves:', this.moves);
        console.log('==================================');
        
        return optimalMoves;
    }
    
    getShuffleFactor() {
        // 섞기 정도를 판단하는 함수
        let misplacedPieces = 0;
        this.pieces.forEach(piece => {
            if (piece.currentRow !== piece.correctRow || piece.currentCol !== piece.correctCol) {
                misplacedPieces++;
            }
        });
        
        // 섞기 정도에 따른 팩터 (0.1 ~ 0.5)
        return Math.min(0.5, Math.max(0.1, misplacedPieces / this.pieces.length));
    }
    

    
    togglePause() {
        if (this.gameState === 'PLAYING') {
            this.pauseGame();
        } else if (this.gameState === 'PAUSED') {
            this.resumeGame();
        }
    }
    
    pauseGame() {
        this.gameState = 'PAUSED';
        clearInterval(this.gameTimer);
        
        document.getElementById('pauseBtn').textContent = '계속하기';
    }
    
    resumeGame() {
        this.gameState = 'PLAYING';
        
        // 타이머 재시작
        this.gameTimer = setInterval(() => {
            this.updateUI();
        }, 1000);
        
        document.getElementById('pauseBtn').textContent = '일시정지';
    }
    
    resetGame() {
        this.gameState = 'MENU';
        this.moves = 0;
        this.score = 0;
        this.startTime = null;
        this.endTime = null;
        this.selectedPiece = null;
        this.isShuffled = false; // 섞기 상태 초기화
        
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
            this.gameTimer = null;
        }
        
        // BGM 정지
        this.stopBgm();
        
        // UI 초기화
        const startBtn = document.getElementById('startBtn');
        const resetBtn = document.getElementById('resetBtn');
        
        if (startBtn) startBtn.style.display = 'inline-block';
        if (resetBtn) resetBtn.style.display = 'none';
        
        // 새로운 세션 ID 업데이트 (이미 game-result-ui.js에서 발급받음)
        this.gameSessionId = localStorage.getItem('gameSessionId');
        
        this.createPuzzle();
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
        
        // 디버깅: 최종 점수 확인
        console.log('Puzzle Game completed with score:', this.score);
        console.log('Session ID:', this.gameSessionId);
        
        this.showResult();
    }
    
    calculateCompletionBonus() {
        const baseBonus = 50;
        const difficultyMultiplier = {
            easy: 1,
            medium: 1.2, // 1.3에서 1.2로 감소
            hard: 1.5    // 1.8에서 1.5로 감소
        };
        
        const playTime = this.getPlayTime();
        const timeBonus = Math.max(0, 180 - playTime); // 5분에서 3분으로 단축
        const efficiency = this.calculateEfficiency();
        const efficiencyBonus = Math.floor(efficiency * 15); // 30에서 15로 감소
        
        const totalBonus = Math.floor((baseBonus + timeBonus + efficiencyBonus) * difficultyMultiplier[this.currentDifficulty]);
        
        // 디버깅: 완료 보너스 계산
        console.log('=== Completion Bonus Calculation ===');
        console.log('Base Bonus:', baseBonus);
        console.log('Play Time:', playTime, 'seconds');
        console.log('Time Bonus:', timeBonus);
        console.log('Efficiency:', efficiency);
        console.log('Efficiency Bonus:', efficiencyBonus);
        console.log('Difficulty Multiplier:', difficultyMultiplier[this.currentDifficulty]);
        console.log('Total Completion Bonus:', totalBonus);
        console.log('===================================');
        
        return totalBonus;
    }
    
    addScore(points) {
        this.score += points;
    }
    
    getPlayTime() {
        if (!this.startTime) return 0;
        const endTime = this.endTime || Date.now();
        return Math.floor((endTime - this.startTime) / 1000);
    }
    
    getProgress() {
        const correctPieces = this.pieces.filter(piece => 
            piece.currentRow === piece.correctRow && 
            piece.currentCol === piece.correctCol
        ).length;
        
        return Math.floor((correctPieces / this.pieces.length) * 100);
    }
    
    updateUI() {
        document.getElementById('scoreDisplay').textContent = this.score;
        document.getElementById('timeDisplay').textContent = this.getPlayTime() + '초';
        document.getElementById('movesDisplay').textContent = this.moves;
        document.getElementById('progressDisplay').textContent = this.getProgress() + '%';
    }
    
    async showResult() {
        const playTime = this.getPlayTime();
        const efficiency = Math.floor(this.calculateEfficiency() * 100);
        
        // 디버깅: 세션 ID 및 점수 정보 확인
        console.log('=== Puzzle Game Result Debug ===');
        console.log('Session ID:', this.gameSessionId);
        console.log('Game ID:', 'puzzle-game');
        console.log('Score:', this.score);
        console.log('Play Time:', playTime);
        console.log('Moves:', this.moves);
        console.log('Efficiency:', efficiency);
        console.log('Difficulty:', this.currentDifficulty);
        console.log('Puzzle Size:', this.puzzleSize);
        console.log('===============================');
        
        // 새로운 GameResultUI 컴포넌트 사용
        const gameResult = {
            gameId: 'puzzle-game',
            score: this.score,
            playTime: playTime,
            moves: this.moves,
            efficiency: efficiency,
            sessionId: this.gameSessionId,
            isSuccess: true,
            additionalData: {
                difficulty: this.currentDifficulty,
                puzzleSize: this.puzzleSize
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
                const startBtn = document.getElementById('startBtn');
                const resetBtn = document.getElementById('resetBtn');
                
                if (startBtn) startBtn.style.display = 'inline-block';
                if (resetBtn) resetBtn.style.display = 'none';
            },
            () => {
                // 게임 목록으로 돌아가기
                window.location.href = 'mini-games.html';
            }
        );
        
        // 결과 화면 표시
        await window.gameResultUI.showResult(gameResult, {
            title: '퍼즐 완성!',
            successTitle: '🧩 퍼즐 게임 완료!',
            showLeaderboard: true
        });
        
        // 버튼 상태 초기화
        const startBtn = document.getElementById('startBtn');
        const resetBtn = document.getElementById('resetBtn');
        
        if (startBtn) startBtn.style.display = 'inline-block';
        if (resetBtn) resetBtn.style.display = 'none';
    }
    
    hideResult() {
        // 새로운 GameResultUI 컴포넌트에서 처리
        window.gameResultUI.hideModal();
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
let puzzleGame;

document.addEventListener('DOMContentLoaded', () => {
    // 세션 확인
    const gameSessionId = localStorage.getItem('gameSessionId');
    const gameId = localStorage.getItem('gameId');
    
    if (!gameSessionId || gameId !== 'puzzle-game') {
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
            const board = document.getElementById('puzzleBoard');
            console.log('Puzzle board 검색 결과:', board);
            if (board) {
                console.log('Puzzle board 준비됨, PuzzleGame 생성 시작');
                try {
                    puzzleGame = new PuzzleGame();
                    console.log('PuzzleGame 인스턴스 생성 성공');
                    console.log('퍼즐 게임 초기화 완료');
                } catch (e) {
                    console.error('PuzzleGame 생성 중 오류:', e);
                    window.errorHandler.handleGlobalError(e, 'game');
                }
            } else {
                console.log('Puzzle board를 찾을 수 없음, 200ms 후 재시도');
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
    if (puzzleGame && puzzleGame.gameState === 'PLAYING') {
        e.preventDefault();
        e.returnValue = '게임이 진행 중입니다. 정말 나가시겠습니까?';
    }
});

// 키보드 단축키
document.addEventListener('keydown', (e) => {
    if (!puzzleGame) return;
    
    switch (e.code) {
        case 'Space':
            e.preventDefault();
            if (puzzleGame.gameState === 'MENU') {
                puzzleGame.startGame();
            } else if (puzzleGame.gameState === 'PLAYING' || puzzleGame.gameState === 'PAUSED') {
                puzzleGame.togglePause();
            }
            break;
        case 'KeyR':
            if (e.ctrlKey) {
                e.preventDefault();
                puzzleGame.resetGame();
            }
            break;
        case 'KeyS':
            if (e.ctrlKey) {
                e.preventDefault();
                puzzleGame.shufflePuzzle();
            }
            break;
        case 'Escape':
            if (puzzleGame.gameState === 'PLAYING') {
                puzzleGame.pauseGame();
            }
            break;
        // 화살표 키로 조각 이동 (선택된 조각이 있을 때)
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight':
            if (puzzleGame.selectedPiece && puzzleGame.gameState === 'PLAYING') {
                e.preventDefault();
                puzzleGame.handleArrowKeyMove(e.code);
            }
            break;
    }
});

// 화살표 키로 선택된 조각 이동
PuzzleGame.prototype.handleArrowKeyMove = function(keyCode) {
    if (!this.selectedPiece) return;
    
    const piece = this.selectedPiece;
    let targetRow = this.emptyPosition.row;
    let targetCol = this.emptyPosition.col;
    
    // 선택된 조각이 빈 공간과 인접한지 확인하고 방향에 따라 이동
    switch (keyCode) {
        case 'ArrowUp':
            if (piece.currentRow === this.emptyPosition.row + 1 && 
                piece.currentCol === this.emptyPosition.col) {
                this.movePiece(piece);
            }
            break;
        case 'ArrowDown':
            if (piece.currentRow === this.emptyPosition.row - 1 && 
                piece.currentCol === this.emptyPosition.col) {
                this.movePiece(piece);
            }
            break;
        case 'ArrowLeft':
            if (piece.currentRow === this.emptyPosition.row && 
                piece.currentCol === this.emptyPosition.col + 1) {
                this.movePiece(piece);
            }
            break;
        case 'ArrowRight':
            if (piece.currentRow === this.emptyPosition.row && 
                piece.currentCol === this.emptyPosition.col - 1) {
                this.movePiece(piece);
            }
            break;
    }
};