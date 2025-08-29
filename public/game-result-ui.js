/**
 * GameResultUI - 게임 결과 및 포인트 적립 UI 컴포넌트
 * 모든 게임에서 공통으로 사용할 수 있는 결과 화면 컴포넌트
 */
class GameResultUI {
  constructor() {
    this.pointsManager = window.pointsManager || new PointsManager();
    this.currentResult = null;
    this.onPlayAgain = null;
    this.onBackToMenu = null;
    this.isSubmitting = false; // 중복 제출 방지 플래그
    this.submittedSessions = new Set(); // 제출된 세션 추적
  }

  /**
   * 게임 결과 화면 표시
   * @param {Object} gameResult - 게임 결과 데이터
   * @param {Object} options - 표시 옵션
   */
  async showResult(gameResult, options = {}) {
    this.currentResult = gameResult;

    // 기본 옵션 설정
    const defaultOptions = {
      title: "게임 종료!",
      successTitle: "축하합니다! 🎉",
      showTotalPoints: true,
      showPlayAgain: true,
      showBackToMenu: true,
      autoSubmitScore: true,
      showLeaderboard: false, // 기본적으로 비활성화
    };

    const config = { ...defaultOptions, ...options };

    // 결과 모달 생성 또는 업데이트
    this.createOrUpdateModal(config);

    // 게임 통계 표시
    this.displayGameStats(gameResult);

    // 리더보드 표시 (선택적)
    if (config.showLeaderboard) {
      await this.displayLeaderboard(gameResult);
    } else {
      // 리더보드 섹션 숨기기
      const leaderboardSection = document.querySelector(".leaderboard-section");
      if (leaderboardSection) {
        leaderboardSection.style.display = "none";
      }
    }

    // 포인트 적립 처리 (점수가 0보다 클 때만)
    if (config.autoSubmitScore && gameResult.gameId && gameResult.score > 0) {
      await this.handlePointsSubmission(gameResult);
    } else if (
      config.autoSubmitScore &&
      gameResult.gameId &&
      gameResult.score === 0
    ) {
      // 0점일 때는 즉시 포인트 적립 실패 메시지 표시
      // 먼저 로딩 상태를 숨김
      const pointsLoading = document.getElementById("pointsLoading");
      const pointsResult = document.getElementById("pointsResult");
      if (pointsLoading) pointsLoading.style.display = "none";
      if (pointsResult) pointsResult.style.display = "none";

      this.displayPointsError(
        new Error(
          "점수가 0점이면 포인트를 적립할 수 없습니다. 게임에서 점수를 획득해보세요!"
        )
      );
    }

    // 모달 표시
    this.showModal();
  }

  /**
   * 결과 모달 생성 또는 업데이트
   * @param {Object} config - 설정 옵션
   */
  createOrUpdateModal(config) {
    let modal = document.getElementById("gameResultModal");

    if (!modal) {
      modal = this.createModal();
      document.body.appendChild(modal);
    }

    // 버튼 표시/숨김 설정
    const playAgainBtn = modal.querySelector("#playAgainBtn");
    const backToMenuBtn = modal.querySelector("#backToMenuBtn");

    if (playAgainBtn) {
      playAgainBtn.style.display = config.showPlayAgain
        ? "inline-block"
        : "none";
    }

    if (backToMenuBtn) {
      backToMenuBtn.style.display = config.showBackToMenu
        ? "inline-block"
        : "none";
    }
  }

  /**
   * 결과 모달 DOM 생성
   * @returns {HTMLElement} 생성된 모달 요소
   */
  createModal() {
    const modal = document.createElement("div");
    modal.id = "gameResultModal";
    modal.className = "game-result-modal";

    modal.innerHTML = `
            <div class="result-content">
                <div class="result-stats" id="gameStats">
                    <!-- 게임 통계가 여기에 동적으로 추가됩니다 -->
                </div>
                
                <div class="sections-container">
                    <div class="leaderboard-section">
                        <div class="leaderboard-display" id="leaderboardDisplay" tabindex="0" aria-label="게임 리더보드">
                            <div class="leaderboard-loading" id="leaderboardLoading">
                                <div class="loading-spinner"></div>
                                <p>순위를 불러오는 중...</p>
                            </div>
                            <div class="leaderboard-result" id="leaderboardResult" style="display: none;">
                                <!-- 순위 결과가 여기에 표시됩니다 -->
                            </div>
                            <div class="leaderboard-error" id="leaderboardError" style="display: none;">
                                <!-- 순위 오류가 여기에 표시됩니다 -->
                            </div>
                        </div>
                    </div>
                    
                    <div class="points-section">
                        <div class="points-display" id="pointsDisplay">
                            <div class="points-loading" id="pointsLoading">
                                <div class="loading-spinner"></div>
                                <p>포인트를 적립하는 중...</p>
                            </div>
                            <div class="points-result" id="pointsResult" style="display: none;">
                                <!-- 포인트 결과가 여기에 표시됩니다 -->
                            </div>
                            <div class="points-error" id="pointsError" style="display: none;">
                                <!-- 포인트 오류가 여기에 표시됩니다 -->
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="result-actions">
                    <button id="playAgainBtn" class="result-btn primary-btn">다시 플레이</button>
                    <button id="backToMenuBtn" class="result-btn secondary-btn">게임 선택으로</button>
                </div>
            </div>
        `;

    // 이벤트 리스너 추가
    this.attachEventListeners(modal);

    return modal;
  }

  /**
   * 모달에 이벤트 리스너 추가
   * @param {HTMLElement} modal - 모달 요소
   */
  attachEventListeners(modal) {
    const playAgainBtn = modal.querySelector("#playAgainBtn");
    const backToMenuBtn = modal.querySelector("#backToMenuBtn");

    if (playAgainBtn) {
      playAgainBtn.addEventListener("click", async () => {
        this.hideModal();
        if (this.onPlayAgain) {
          // 새로운 게임 세션 발급 후 콜백 실행
          await this.fetchNewGameSession();
          this.onPlayAgain();
        }
      });
    }

    if (backToMenuBtn) {
      backToMenuBtn.addEventListener("click", () => {
        this.hideModal();
        if (this.onBackToMenu) {
          this.onBackToMenu();
        } else {
          // 기본 동작: 게임 선택 페이지로 이동
          window.location.href = "mini-games.html";
        }
      });
    }

    // 모달 외부 클릭 시 닫기 (선택적)
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        // 모달 외부 클릭 시에는 닫지 않음 (의도적 선택 필요)
      }
    });
  }

  /**
   * 게임 통계 표시
   * @param {Object} gameResult - 게임 결과 데이터
   */
  displayGameStats(gameResult) {
    const statsContainer = document.getElementById("gameStats");
    if (!statsContainer) return;

    const stats = this.formatGameStats(gameResult);

    statsContainer.innerHTML = stats
      .map(
        (stat) => `
            <div class="result-stat">
                <span class="stat-label">${stat.label}:</span>
                <span class="stat-value">${stat.value}</span>
            </div>
        `
      )
      .join("");
  }

  /**
   * 게임 결과 데이터를 표시용 통계로 변환
   * @param {Object} gameResult - 게임 결과 데이터
   * @returns {Array} 표시할 통계 배열
   */
  formatGameStats(gameResult) {
    const stats = [];

    // 기본 통계
    if (gameResult.score !== undefined) {
      stats.push({
        label: "최종 점수",
        value: gameResult.score.toLocaleString(),
      });
    }

    if (gameResult.playTime !== undefined) {
      const minutes = Math.floor(gameResult.playTime / 60);
      const seconds = gameResult.playTime % 60;
      const timeStr =
        minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
      stats.push({ label: "플레이 시간", value: timeStr });
    }

    // 게임별 특수 통계
    switch (gameResult.gameId) {
      case "snake-game":
        if (gameResult.length !== undefined) {
          stats.push({ label: "뱀 길이", value: gameResult.length });
        }
        break;

      case "memory-game":
        if (gameResult.attempts !== undefined) {
          stats.push({ label: "총 시도", value: gameResult.attempts });
        }
        if (gameResult.accuracy !== undefined) {
          stats.push({ label: "정확도", value: `${gameResult.accuracy}%` });
        }
        break;

      case "puzzle-game":
        if (gameResult.moves !== undefined) {
          stats.push({ label: "총 이동", value: gameResult.moves });
        }
        if (gameResult.efficiency !== undefined) {
          stats.push({ label: "효율성", value: `${gameResult.efficiency}%` });
        }
        break;
    }

    return stats;
  }

  /**
   * 포인트 적립 처리
   * @param {Object} gameResult - 게임 결과 데이터
   */
  async handlePointsSubmission(gameResult) {
    // 중복 제출 방지 (더 강화된 검증)
    if (this.isSubmitting) {
      return;
    }

    // 세션 ID 검증
    const sessionId =
      gameResult.sessionId || localStorage.getItem("gameSessionId");
    if (!sessionId) {
      console.error("세션 ID가 없습니다. 포인트 제출을 건너뜁니다.");
      this.displayPointsError(new Error("게임 세션이 유효하지 않습니다."));
      return;
    }

    // 이미 제출된 세션인지 확인
    if (this.submittedSessions && this.submittedSessions.has(sessionId)) {
      console.log("이미 제출된 세션입니다:", sessionId);
      this.displayPointsError(new Error("이미 처리된 게임 결과입니다."));
      return;
    }

    this.isSubmitting = true;

    const pointsLoading = document.getElementById("pointsLoading");
    const pointsResult = document.getElementById("pointsResult");
    const pointsError = document.getElementById("pointsError");

    // 로딩 표시
    if (pointsLoading) pointsLoading.style.display = "block";
    if (pointsResult) pointsResult.style.display = "none";
    if (pointsError) pointsError.style.display = "none";

    try {
      // 게임 점수 제출 API 호출
      const response = await fetch("/api/games/submit-score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          gameId: gameResult.gameId,
          score: gameResult.score,
          sessionId:
            gameResult.sessionId || localStorage.getItem("gameSessionId"),
          playTime: gameResult.playTime,
          additionalData: gameResult.additionalData || {},
        }),
      });

      // 로딩 즉시 숨김 (응답을 받았으므로)
      if (pointsLoading) pointsLoading.style.display = "none";

      if (!response.ok) {
        let errorMessage = "포인트 적립에 실패했습니다.";

        if (response.status === 401) {
          throw new Error("AUTHENTICATION_REQUIRED");
        } else {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;

            // 상태 코드별 기본 메시지 설정
            if (!errorData.error && !errorData.message) {
              switch (response.status) {
                case 429:
                  errorMessage = "일일 포인트 획득 한도에 도달했습니다.";
                  break;
                case 400:
                  errorMessage = "게임 플레이 요건을 만족하지 않습니다.";
                  break;
                case 403:
                  errorMessage = "포인트 적립 권한이 없습니다.";
                  break;
                case 500:
                  errorMessage = "서버 내부 오류가 발생했습니다.";
                  break;
                default:
                  errorMessage = `서버 오류 (${response.status})`;
              }
            }
          } catch (parseError) {
            console.error("오류 응답 파싱 실패:", parseError);
            // 상태 코드별 기본 메시지
            switch (response.status) {
              case 429:
                errorMessage = "일일 포인트 획득 한도에 도달했습니다.";
                break;
              case 400:
                errorMessage = "게임 플레이 요건을 만족하지 않습니다.";
                break;
              default:
                errorMessage = `서버 오류 (${response.status})`;
            }
          }
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.success) {
        // 성공적으로 제출된 세션 추적
        if (!this.submittedSessions) {
          this.submittedSessions = new Set();
        }
        this.submittedSessions.add(sessionId);

        this.displayPointsSuccess(data);
      } else {
        this.displayPointsError(
          new Error(data.error || "포인트 적립에 실패했습니다.")
        );
      }
    } catch (error) {
      console.error("포인트 제출 오류:", error);

      // 로딩 숨김 (오류 발생 시에도)
      if (pointsLoading) pointsLoading.style.display = "none";

      // 오류 타입별 처리
      if (error.message === "AUTHENTICATION_REQUIRED") {
        window.errorHandler?.handleGlobalError(error, "authentication");
      } else if (
        error.message.includes("네트워크") ||
        error.message.includes("fetch")
      ) {
        error.retryCallback = () => this.handlePointsSubmission(gameResult);
        window.errorHandler?.handleGlobalError(error, "network");
      } else {
        this.displayPointsError(error);
      }
    } finally {
      // 세션 정리
      this.cleanupGameSession();

      // 제출 완료 후 플래그 초기화
      this.isSubmitting = false;
    }
  }

  /**
   * 포인트 적립 성공 결과 표시
   * @param {Object} data - 서버 응답 데이터
   */
  displayPointsSuccess(data) {
    const pointsResult = document.getElementById("pointsResult");
    if (!pointsResult) return;

    const earnedPoints = data.earnedPoints || 0;
    // 서버 응답에서 totalBalance를 우선 사용하고, 없으면 totalPoints 사용
    const totalPoints = data.totalBalance || data.totalPoints || 0;
    const dailyRemaining =
      data.dailyRemaining !== undefined ? data.dailyRemaining : "정보 없음";



    pointsResult.innerHTML = `
            <div class="points-success">
                <h3>🎉 포인트 적립 완료!</h3>
                <div class="points-breakdown">
                    <div class="points-item earned">
                        <span class="points-label">획득 포인트</span>
                        <span class="points-value">+${earnedPoints}P</span>
                    </div>
                    <div class="points-item total">
                        <span class="points-label">총 보유 포인트</span>
                        <span class="points-value">${totalPoints.toLocaleString()}P</span>
                    </div>
                    <div class="points-item remaining">
                        <span class="points-label">오늘 획득 가능</span>
                        <span class="points-value">${dailyRemaining}P</span>
                    </div>
                </div>
            </div>
        `;

    pointsResult.style.display = "block";

    // 성공 애니메이션 효과
    pointsResult.classList.add("points-animate");
    setTimeout(() => {
      pointsResult.classList.remove("points-animate");
    }, 1000);
  }

  /**
   * 포인트 적립 오류 표시
   * @param {Error} error - 오류 객체
   */
  displayPointsError(error) {
    const pointsLoading = document.getElementById("pointsLoading");
    const pointsResult = document.getElementById("pointsResult");
    const pointsError = document.getElementById("pointsError");

    // 먼저 로딩과 결과를 숨김
    if (pointsLoading) pointsLoading.style.display = "none";
    if (pointsResult) pointsResult.style.display = "none";

    if (!pointsError) return;

    // 오류 메시지에 따른 아이콘과 색상 결정
    let errorIcon = "⚠️";
    let errorClass = "points-error-content";
    let showRetryButton = true;

    // 특정 오류 타입에 따른 처리
    if (error.message.includes("한도")) {
      errorIcon = "🚫";
      errorClass = "points-error-content limit-reached";
      showRetryButton = false; // 한도 도달 시 재시도 버튼 숨김
    } else if (
      error.message.includes("시간") ||
      error.message.includes("요건") ||
      error.message.includes("0점")
    ) {
      errorIcon = "⏰";
      errorClass = "points-error-content requirements-not-met";
      showRetryButton = false; // 요건 미달 시 재시도 버튼 숨김
    } else if (
      error.message.includes("세션") ||
      error.message.includes("처리된")
    ) {
      errorIcon = "🔒";
      errorClass = "points-error-content session-error";
      showRetryButton = false; // 세션 오류 시 재시도 버튼 숨김
    }

    pointsError.innerHTML = `
            <div class="${errorClass}">
                <h3>${errorIcon} 포인트 적립 실패</h3>
                <p class="error-message">${error.message}</p>
                ${
                  showRetryButton
                    ? `
                    <div class="error-actions">
                        <button class="retry-btn" onclick="gameResultUI.retryPointsSubmission()">
                            다시 시도
                        </button>
                    </div>
                `
                    : `
                    <div class="error-info">
                        <p class="error-help">게임 결과는 정상적으로 기록되었습니다.</p>
                    </div>
                `
                }
            </div>
        `;

    pointsError.style.display = "block";
  }

  /**
   * 포인트 적립 재시도
   */
  async retryPointsSubmission() {
    if (this.currentResult) {
      await this.handlePointsSubmission(this.currentResult);
    }
  }

  /**
   * 새로운 게임 세션 발급
   */
  async fetchNewGameSession() {
    try {
      const gameId =
        localStorage.getItem("gameId") || this.currentResult?.gameId;
      if (!gameId) {
        console.error("게임 ID를 찾을 수 없습니다.");
        return;
      }

      console.log("새로운 게임 세션 발급 중...", gameId);

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
          throw new Error("새로운 게임 세션 발급 실패");
        }
      }

      const data = await response.json();

      // 새로운 세션 ID를 로컬 스토리지에 저장
      localStorage.setItem("gameSessionId", data.sessionId);
      localStorage.setItem("gameId", gameId);
      localStorage.setItem("gameStartTime", Date.now().toString());

      console.log("새로운 게임 세션 발급 완료:", data.sessionId);
    } catch (error) {
      console.error("새로운 게임 세션 발급 오류:", error);

      if (error.message === "AUTHENTICATION_REQUIRED") {
        window.errorHandler?.handleGlobalError(error, "authentication");
      } else if (error.message.includes("한도")) {
        window.errorHandler?.showNotification(error.message, "warning", 5000);
      } else {
        window.errorHandler?.handleGlobalError(error, "network");
      }
    }
  }

  /**
   * 게임 세션 정리
   */
  cleanupGameSession() {
    localStorage.removeItem("gameSessionId");
    localStorage.removeItem("gameId");
    localStorage.removeItem("gameStartTime");
  }

  /**
   * 리더보드 표시
   * @param {Object} gameResult - 게임 결과 데이터
   */
  async displayLeaderboard(gameResult) {
    const leaderboardLoading = document.getElementById("leaderboardLoading");
    const leaderboardResult = document.getElementById("leaderboardResult");
    const leaderboardError = document.getElementById("leaderboardError");

    // 로딩 표시
    if (leaderboardLoading) leaderboardLoading.style.display = "block";
    if (leaderboardResult) leaderboardResult.style.display = "none";
    if (leaderboardError) leaderboardError.style.display = "none";

    try {
      // 현재 게임 점수를 쿼리 파라미터로 전달
      const url = `/api/games/leaderboard/${gameResult.gameId}?currentScore=${gameResult.score}`;

      // 리더보드 데이터 가져오기
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });



      if (!response.ok) {
        const errorText = await response.text();
        console.error("리더보드 API 오류 응답:", errorText);
        throw new Error(`서버 오류 (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      if (data.success) {
        this.displayLeaderboardSuccess(data.leaderboard, gameResult);
      } else {
        throw new Error(data.error || "리더보드 로딩 실패");
      }
    } catch (error) {
      console.error("리더보드 로딩 오류:", error);
      console.error("오류 상세:", error.stack);

      // 리더보드 로딩 실패 시에도 게임 결과는 정상적으로 표시
      // 오류 메시지를 숨기고 대신 간단한 안내 메시지 표시
      if (leaderboardError) {
        leaderboardError.innerHTML = `
                    <div class="leaderboard-error-content">
                        <h3>📊 순위</h3>
                        <p class="error-message">순위를 불러올 수 없습니다. 게임 결과는 정상적으로 저장되었습니다.</p>
                    </div>
                `;
        leaderboardError.style.display = "block";
      }
    } finally {
      // 로딩 숨김
      if (leaderboardLoading) leaderboardLoading.style.display = "none";
    }
  }

  /**
   * 플레이어 이름 익명화
   * @param {string} playerName - 원본 플레이어 이름
   * @returns {string} 익명화된 플레이어 이름
   */
  anonymizePlayerName(playerName) {
    if (!playerName || playerName.length <= 2) {
      return playerName;
    }

    // 뒤의 두 글자를 **로 변경
    const visiblePart = playerName.slice(0, -2);
    return visiblePart + "**";
  }

  /**
   * 리더보드 성공 결과 표시 (주간 리더보드만)
   * @param {Array} leaderboard - 리더보드 데이터 (사용하지 않음)
   * @param {Object} gameResult - 현재 게임 결과
   */
  displayLeaderboardSuccess(leaderboard, gameResult) {
    const leaderboardResult = document.getElementById("leaderboardResult");
    if (!leaderboardResult) return;

    // 주간 리더보드만 표시
    this.loadWeeklyLeaderboard(gameResult.gameId)
      .then((weeklyData) => {
        this.renderWeeklyLeaderboard(weeklyData, gameResult);
      })
      .catch(error => {
        console.error('주간 리더보드 로딩 오류:', error);
        this.displayLeaderboardError(error);
      });
  }

  /**
   * 주간 리더보드 데이터 로드
   */
  async loadWeeklyLeaderboard(gameId) {
    try {
      const response = await fetch(`/api/games/weekly-leaderboard/${gameId}?limit=3`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('주간 리더보드 로드 실패');
      }
      
      const data = await response.json();
      return data.success ? data : null;
    } catch (error) {
      console.error('주간 리더보드 로드 오류:', error);
      return null;
    }
  }

  /**
   * 주간 리더보드만 표시
   */
  renderWeeklyLeaderboard(weeklyData, gameResult) {
    const leaderboardResult = document.getElementById("leaderboardResult");
    if (!leaderboardResult) return;

    let leaderboardHTML = `<div class="leaderboard-success">`;

    // 주간 리더보드 섹션
    if (weeklyData && weeklyData.leaderboard && weeklyData.leaderboard.length > 0) {
      leaderboardHTML += `
        <div class="weekly-leaderboard-section">
          <h3>🏆 이번 주 순위</h3>
          <div class="week-info">${weeklyData.weekInfo.displayText}</div>
          <div class="reset-info">
            ${this.formatWeeklyResetTime(weeklyData.timeUntilReset)} 후 초기화
          </div>
          <div class="leaderboard-breakdown">
      `;

      // 주간 리더보드 상위 3명
      for (let i = 0; i < Math.min(3, weeklyData.leaderboard.length); i++) {
        const entry = weeklyData.leaderboard[i];
        const rank = i + 1;
        const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
        const rewardPoints = rank === 1 ? 500 : rank === 2 ? 300 : 200;
        const anonymizedName = this.anonymizePlayerName(entry.playerName);

        leaderboardHTML += `
          <div class="leaderboard-item weekly-item">
            <div class="rank-info">
              <span class="rank-medal">${medal}</span>
              <span class="rank-number">${rank}위</span>
              <span class="reward-info">+${rewardPoints}P</span>
            </div>
            <div class="player-info">
              <span class="player-name">${anonymizedName}</span>
              <span class="player-score">${entry.score.toLocaleString()}점</span>
            </div>
          </div>
        `;
      }

      // 현재 사용자의 주간 순위 표시
      if (weeklyData.userRank && weeklyData.userRank.rank) {
        const userRank = weeklyData.userRank.rank;
        if (userRank > 3) {
          leaderboardHTML += `
            <div class="leaderboard-item weekly-item current-user outside-top3">
              <div class="rank-info">
                <span class="rank-number">${userRank}위</span>
              </div>
              <div class="player-info">
                <span class="player-name">나</span>
                <span class="player-score">${weeklyData.userRank.score.toLocaleString()}점</span>
              </div>
            </div>
          `;
        }
      }

      leaderboardHTML += `
          </div>
        </div>
      `;
    } else {
      // 주간 리더보드 데이터가 없는 경우
      leaderboardHTML += `
        <div class="weekly-leaderboard-section">
          <h3>🏆 이번 주 순위</h3>
          <div class="no-data-message">
            <p>아직 이번 주 순위 데이터가 없습니다.</p>
            <p>게임을 플레이하여 순위에 도전해보세요!</p>
          </div>
        </div>
      `;
    }

    leaderboardHTML += `</div>`;

    leaderboardResult.innerHTML = leaderboardHTML;
    leaderboardResult.style.display = "block";
  }

  /**
   * 전체 리더보드만 표시 (기존 방식)
   */
  renderAllTimeLeaderboard(leaderboard, gameResult) {
    const leaderboardResult = document.getElementById("leaderboardResult");
    if (!leaderboardResult) return;

    const currentUserRank = this.getCurrentUserRank(leaderboard, gameResult);

    let leaderboardHTML = `
      <div class="leaderboard-success">
        <h3>🏆 전체 순위</h3>
        <div class="leaderboard-breakdown">
    `;

    // 3등까지 표시
    for (let i = 0; i < Math.min(3, leaderboard.length); i++) {
      const entry = leaderboard[i];
      const rank = i + 1;
      const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
      const isCurrentUser = entry.isCurrentUser;
      const isNewScore = isCurrentUser && entry.score === gameResult.score;
      const anonymizedName = this.anonymizePlayerName(entry.playerName);

      leaderboardHTML += `
        <div class="leaderboard-item ${isCurrentUser ? "current-user" : ""} ${isNewScore ? "new-score" : ""}">
          <div class="rank-info">
            <span class="rank-medal">${medal}</span>
            <span class="rank-number">${rank}위</span>
            ${isNewScore ? '<span class="new-badge">NEW!</span>' : ""}
          </div>
          <div class="player-info">
            <span class="player-name">${anonymizedName}</span>
            <span class="player-score">${entry.score.toLocaleString()}점</span>
          </div>
        </div>
      `;
    }

    // 현재 사용자가 3등 밖에 있는 경우 추가 표시
    if (currentUserRank && currentUserRank > 3) {
      const currentEntry = leaderboard.find((entry) => entry.isCurrentUser);
      if (currentEntry) {
        const isNewScore = currentEntry.score === gameResult.score;
        const anonymizedName = this.anonymizePlayerName(currentEntry.playerName);
        leaderboardHTML += `
          <div class="leaderboard-item current-user outside-top3 ${isNewScore ? "new-score" : ""}">
            <div class="rank-info">
              <span class="rank-number">${currentUserRank}위</span>
              ${isNewScore ? '<span class="new-badge">NEW!</span>' : ""}
            </div>
            <div class="player-info">
              <span class="player-name">${anonymizedName}</span>
              <span class="player-score">${currentEntry.score.toLocaleString()}점</span>
            </div>
          </div>
        `;
      }
    }

    leaderboardHTML += `
        </div>
      </div>
    `;

    leaderboardResult.innerHTML = leaderboardHTML;
    leaderboardResult.style.display = "block";
  }

  /**
   * 주간 초기화 시간 포맷팅
   */
  formatWeeklyResetTime(timeInfo) {
    if (!timeInfo) return '시간 정보 없음';
    
    if (timeInfo.days > 0) {
      return `${timeInfo.days}일 ${timeInfo.hours}시간`;
    } else if (timeInfo.hours > 0) {
      return `${timeInfo.hours}시간 ${timeInfo.minutes}분`;
    } else {
      return `${timeInfo.minutes}분`;
    }
  }

  /**
   * 현재 사용자의 순위 계산
   * @param {Array} leaderboard - 리더보드 데이터
   * @param {Object} gameResult - 현재 게임 결과
   * @returns {number} 현재 사용자 순위
   */
  getCurrentUserRank(leaderboard, gameResult) {
    const currentUserEntry = leaderboard.find((entry) => entry.isCurrentUser);
    if (currentUserEntry) {
      return leaderboard.findIndex((entry) => entry.isCurrentUser) + 1;
    }
    return null;
  }

  /**
   * 리더보드 오류 표시
   * @param {Error} error - 오류 객체
   */
  displayLeaderboardError(error) {
    const leaderboardError = document.getElementById("leaderboardError");
    if (!leaderboardError) return;

    leaderboardError.innerHTML = `
            <div class="leaderboard-error-content">
                <h3>⚠️ 리더보드 로딩 실패</h3>
                <p class="error-message">${error.message}</p>
            </div>
        `;

    leaderboardError.style.display = "block";
  }

  /**
   * 모달 표시
   */
  showModal() {
    const modal = document.getElementById("gameResultModal");
    if (modal) {
      modal.style.display = "flex";
      // 애니메이션을 위한 클래스 추가
      setTimeout(() => {
        modal.classList.add("show");
      }, 10);
    }
  }

  /**
   * 모달 숨김
   */
  hideModal() {
    const modal = document.getElementById("gameResultModal");
    if (modal) {
      modal.classList.remove("show");
      setTimeout(() => {
        modal.style.display = "none";
      }, 300);
    }
  }

  /**
   * 콜백 함수 설정
   * @param {Function} onPlayAgain - 다시 플레이 콜백
   * @param {Function} onBackToMenu - 메뉴로 돌아가기 콜백
   */
  setCallbacks(onPlayAgain, onBackToMenu) {
    this.onPlayAgain = onPlayAgain;
    this.onBackToMenu = onBackToMenu;
  }

  /**
   * 컴포넌트 정리
   */
  destroy() {
    const modal = document.getElementById("gameResultModal");
    if (modal) {
      modal.remove();
    }
    this.currentResult = null;
    this.onPlayAgain = null;
    this.onBackToMenu = null;
  }
}

// 전역 인스턴스 생성
window.gameResultUI = new GameResultUI();
