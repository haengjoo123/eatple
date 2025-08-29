/**
 * 미니게임 선택 페이지 스크립트
 */

class MiniGamesManager {
  constructor() {
    this.games = {};
    this.userStats = {};
    this.dailyLimitInfo = {};
    this.isLoggedIn = false;
    this.updateInterval = null;
    this.init();
  }

  async init() {
    // 로딩 상태 표시
    window.errorHandler.showLoading(
      "miniGamesInit",
      document.getElementById("loadingSection"),
      "게임 목록을 불러오는 중..."
    );

    try {
      // 로그인 상태 확인
      await this.checkAuthStatus();

      if (!this.isLoggedIn) {
        window.errorHandler.hideLoading("miniGamesInit");
        this.showLoginRequired();
        return;
      }

      // 게임 목록과 사용자 통계 로드 (병렬 처리)
      await Promise.all([
        this.loadGames(),
        this.loadUserStats(),
        this.loadDailyLimitInfo(),
      ]);

      this.renderGames();
      this.updateDailyLimitDisplay();
      this.startRealTimeUpdates();

      window.errorHandler.hideLoading("miniGamesInit");
      this.hideLoading();
    } catch (error) {
      window.errorHandler.hideLoading("miniGamesInit");
      console.error("초기화 오류:", error);

      // 오류 타입에 따른 처리
      if (error.message.includes("인증") || error.message.includes("로그인")) {
        window.errorHandler.handleGlobalError(error, "authentication");
      } else if (
        error.message.includes("네트워크") ||
        error.message.includes("fetch")
      ) {
        error.retryCallback = () => this.init();
        window.errorHandler.handleGlobalError(error, "network");
      } else {
        this.showError();
      }
    }
  }

  async checkAuthStatus() {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });
      const data = await response.json();
      this.isLoggedIn = data.loggedIn;
    } catch (error) {
      console.error("인증 상태 확인 오류:", error);
      this.isLoggedIn = false;
    }
  }

  async loadGames() {
    try {
      // 하드코딩된 게임 목록 (원래 상태)
      this.games = {
        "snake-game": {
          name: "스네이크 게임",
          description: "뱀을 조종하여 음식을 먹고 성장시키는 게임",
          estimatedTime: "1-3분",
          maxPoints: 30,
        },
        "memory-game": {
          name: "기억력 게임",
          description: "카드를 뒤집어 짝을 맞추는 기억력 게임",
          estimatedTime: "2-5분",
          maxPoints: 50,
        },
        "puzzle-game": {
          name: "퍼즐 게임",
          description: "조각을 맞춰 이미지를 완성하는 퍼즐 게임",
          estimatedTime: "3-7분",
          maxPoints: 60,
        },
      };
    } catch (error) {
      console.error("게임 목록 로드 오류:", error);
      throw error;
    }
  }

  async loadUserStats() {
    try {
      const response = await fetch("/api/games/user-stats", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("사용자 통계 로드 실패");
      }

      const data = await response.json();
      this.userStats = data.stats;
    } catch (error) {
      console.error("사용자 통계 로드 오류:", error);
      throw error;
    }
  }

  async loadDailyLimitInfo() {
    try {
      const response = await fetch("/api/points/daily-limit", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("일일 한도 정보 로드 실패");
      }

      const data = await response.json();
      this.dailyLimitInfo = data;
    } catch (error) {
      console.error("일일 한도 정보 로드 오류:", error);
      throw error;
    }
  }

  renderGames() {
    const gamesGrid = document.getElementById("gamesGrid");
    const dailyLimitWarning = document.getElementById("dailyLimitWarning");

    // 포인트 상태 업데이트 (우측 상단 표시만)
    document.getElementById("totalPoints").textContent =
      this.userStats.totalBalance || 0;

    // 일일 한도 경고 표시
    if (this.userStats.remainingPoints <= 0) {
      dailyLimitWarning.style.display = "block";
    }

    // 게임 카드 생성
    gamesGrid.innerHTML = "";

    Object.entries(this.games).forEach(([gameId, gameConfig]) => {
      const gameCard = this.createGameCard(gameId, gameConfig);
      gamesGrid.appendChild(gameCard);
    });
  }

  createGameCard(gameId, gameConfig) {
    const card = document.createElement("div");
    card.className = "game-card";

    // 게임별 아이콘 매핑
    const gameIcons = {
      "snake-game": "🐍",
      "memory-game": "🧠",
      "puzzle-game": "🧩",
    };

    // 내 점수 (사용자의 개인 최고 점수)
    const myScore = this.userStats.bestScoresToday?.[gameId] || 0;

    // 최고 점수 (전체 사용자 중 최고 점수)
    const highestScore = this.userStats.globalHighScores?.[gameId] || 0;

    // 플레이 불가능 조건 확인
    const canPlay = this.userStats.remainingPoints > 0;

    card.innerHTML = `
            <div class="game-icon">${gameIcons[gameId] || "🎮"}</div>
            <div class="game-title">${gameConfig.name}</div>
            <div class="game-description">${gameConfig.description}</div>
            
            <div class="game-stats">
                <div class="game-stat">
                    <div class="game-stat-value">${
                      gameConfig.estimatedTime
                    }</div>
                    <div class="game-stat-label">예상 시간</div>
                </div>
                <div class="game-stat">
                    <div class="game-stat-value">${gameConfig.maxPoints}P</div>
                    <div class="game-stat-label">최대 포인트</div>
                </div>
                <div class="game-stat">
                    <div class="game-stat-value">${highestScore}</div>
                    <div class="game-stat-label">최고 점수</div>
                </div>
                <div class="game-stat">
                    <div class="game-stat-value">${myScore}</div>
                    <div class="game-stat-label">오늘 내 점수</div>
                </div>
            </div>
            
            <button class="play-button" ${!canPlay ? "disabled" : ""} 
                    onclick="miniGamesManager.startGame('${gameId}')">
                ${canPlay ? "게임 시작" : "일일 한도 도달"}
            </button>
        `;

    return card;
  }

  async startGame(gameId) {
    // 게임 시작 버튼 비활성화 (중복 클릭 방지)
    const button = event.target;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "시작 중...";

    try {
      // 게임 세션 시작
      const response = await fetch("/api/games/start-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ gameId }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("AUTHENTICATION_REQUIRED");
        } else if (response.status === 429) {
          throw new Error("일일 게임 플레이 한도에 도달했습니다.");
        } else {
          throw new Error("게임 세션 시작 실패");
        }
      }

      const data = await response.json();

      // 세션 ID를 로컬 스토리지에 저장
      localStorage.setItem("gameSessionId", data.sessionId);
      localStorage.setItem("gameId", gameId);
      localStorage.setItem("gameStartTime", Date.now().toString());

      // 성공 알림
      window.errorHandler.showNotification(
        "게임을 시작합니다!",
        "success",
        2000
      );

      // 해당 게임 페이지로 이동
      window.location.href = `${gameId}.html`;
    } catch (error) {
      console.error("게임 시작 오류:", error);

      // 버튼 상태 복원
      button.disabled = false;
      button.textContent = originalText;

      // 오류 타입별 처리
      if (error.message === "AUTHENTICATION_REQUIRED") {
        window.errorHandler.handleGlobalError(error, "authentication");
      } else if (error.message.includes("한도")) {
        window.errorHandler.showNotification(error.message, "warning", 5000);
        // 통계 새로고침
        this.refresh();
      } else {
        error.retryCallback = () => this.startGame(gameId);
        window.errorHandler.handleGlobalError(error, "network");
      }
    }
  }

  showLoginRequired() {
    document.getElementById("loadingSection").style.display = "none";
    document.getElementById("loginRequired").style.display = "block";
  }

  showError() {
    document.getElementById("loadingSection").style.display = "none";
    document.getElementById("errorSection").style.display = "block";
  }

  hideLoading() {
    document.getElementById("loadingSection").style.display = "none";
    document.getElementById("gameContent").style.display = "block";
  }

  // 일일 한도 정보 표시 업데이트
  updateDailyLimitDisplay() {
    if (!this.dailyLimitInfo) return;

    const progressFill = document.getElementById("progressFill");
    const progressText = document.getElementById("progressText");
    const resetTimer = document.getElementById("resetTimer");
    const detailEarned = document.getElementById("detailEarned");
    const detailRemaining = document.getElementById("detailRemaining");
    const detailLimit = document.getElementById("detailLimit");

    // 진행률 계산
    const progressPercentage = Math.round(
      (this.dailyLimitInfo.dailyEarned / this.dailyLimitInfo.dailyLimit) * 100
    );

    // 진행률 바 업데이트
    if (progressFill) {
      progressFill.style.width = `${progressPercentage}%`;

      // 진행률에 따른 색상 변경
      progressFill.className = "progress-fill";
      if (progressPercentage >= 90) {
        progressFill.classList.add("danger");
      } else if (progressPercentage >= 70) {
        progressFill.classList.add("warning");
      }
    }

    // 진행률 텍스트 업데이트
    if (progressText) {
      progressText.textContent = `${this.dailyLimitInfo.dailyEarned} / ${this.dailyLimitInfo.dailyLimit} 포인트 (${progressPercentage}%)`;
    }

    // 초기화 시간 업데이트
    if (resetTimer) {
      const timeUntilReset = this.formatTimeUntilReset(
        this.dailyLimitInfo.timeUntilReset
      );
      resetTimer.textContent = `${timeUntilReset} 후 초기화`;
    }

    // 상세 정보 업데이트
    if (detailEarned) {
      detailEarned.textContent = `${this.dailyLimitInfo.dailyEarned}P`;
    }

    if (detailRemaining) {
      detailRemaining.textContent = `${this.dailyLimitInfo.dailyRemaining}P`;
      detailRemaining.className =
        this.dailyLimitInfo.dailyRemaining <= 0 ? "value exhausted" : "value";
    }

    if (detailLimit) {
      detailLimit.textContent = `${this.dailyLimitInfo.dailyLimit}P`;
    }
  }

  // 남은 시간을 사용자 친화적 형식으로 변환
  formatTimeUntilReset(milliseconds) {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else {
      return `${minutes}분`;
    }
  }

  // 실시간 업데이트 시작
  startRealTimeUpdates() {
    // 30초마다 업데이트
    this.updateInterval = setInterval(async () => {
      try {
        await Promise.all([this.loadUserStats(), this.loadDailyLimitInfo()]);

        this.renderGames();
        this.updateDailyLimitDisplay();
      } catch (error) {
        console.warn("실시간 업데이트 실패:", error.message);
      }
    }, 30000);

    // 1분마다 시간 표시 업데이트
    setInterval(() => {
      // 일일 한도 시간 업데이트
      if (this.dailyLimitInfo && this.dailyLimitInfo.timeUntilReset) {
        // 시간 감소
        this.dailyLimitInfo.timeUntilReset -= 60000;
        if (this.dailyLimitInfo.timeUntilReset < 0) {
          this.dailyLimitInfo.timeUntilReset = 0;
        }

        const resetTimer = document.getElementById("resetTimer");
        if (resetTimer) {
          const timeUntilReset = this.formatTimeUntilReset(
            this.dailyLimitInfo.timeUntilReset
          );
          resetTimer.textContent = `${timeUntilReset} 후 초기화`;
        }
      }
    }, 60000);
  }

  // 실시간 업데이트 중지
  stopRealTimeUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  // 페이지 새로고침
  async refresh() {
    document.getElementById("gameContent").style.display = "none";
    document.getElementById("loadingSection").style.display = "block";

    try {
      await Promise.all([this.loadUserStats(), this.loadDailyLimitInfo()]);
      this.renderGames();
      this.updateDailyLimitDisplay();
      this.hideLoading();
    } catch (error) {
      console.error("새로고침 오류:", error);
      this.showError();
    }
  }
}

// 전역 인스턴스 생성
let miniGamesManager;

// 페이지 로드 시 초기화
document.addEventListener("DOMContentLoaded", () => {
  miniGamesManager = new MiniGamesManager();
});

// 페이지 포커스 시 통계 새로고침
window.addEventListener("focus", () => {
  if (miniGamesManager && miniGamesManager.isLoggedIn) {
    miniGamesManager.refresh();
  }
});

// 뒤로가기 버튼 처리
window.addEventListener("popstate", () => {
  if (miniGamesManager && miniGamesManager.isLoggedIn) {
    miniGamesManager.refresh();
  }
});
