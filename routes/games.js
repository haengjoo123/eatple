const express = require('express');
const { requireLogin } = require('../utils/authMiddleware');
const { incrementServiceUsage, SERVICE_TYPES } = require('../utils/serviceUsageTracker');
const PointsService = require('../utils/pointsService');
const WeeklyLeaderboardService = require('../utils/weeklyLeaderboardService');
const { 
  gameScoreLimiter, 
  gameSessionLimiter, 
  validateInput, 
  suspiciousActivityDetector 
} = require('../utils/securityMiddleware');
const router = express.Router();

// 게임 세션 관리 (메모리 기반 - 실제 운영에서는 Redis 등 사용 권장)
const gameSessions = new Map();

// 게임 설정 데이터
const GAME_CONFIG = {
  "snake-game": {
    "name": "스네이크 게임",
    "description": "뱀을 조작해서 먹이를 먹고 점수를 획득하세요",
    "estimatedTime": "3-5분",
    "maxPoints": 30,
    "scoreMultiplier": 0.04
  },
  "memory-game": {
    "name": "기억력 게임", 
    "description": "카드를 뒤집어서 같은 그림을 찾으세요",
    "estimatedTime": "2-4분",
    "maxPoints": 40,
    "scoreMultiplier": 0.05
  },
  "puzzle-game": {
    "name": "퍼즐 게임",
    "description": "조각을 맞춰서 그림을 완성하세요", 
    "estimatedTime": "4-6분",
    "maxPoints": 60,
    "scoreMultiplier": 0.06
  }
};

// 사용가능한 게임 목록 반환
router.get('/list', requireLogin, (req, res) => {
  try {
    res.json({
      success: true,
      games: GAME_CONFIG
    });
  } catch (error) {
    console.error('게임 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '게임 목록을 불러오는데 실패했습니다.'
    });
  }
});

// 게임 세션 시작 (보안을 위한 세션 생성)
router.post('/start-session', requireLogin, gameSessionLimiter, validateInput.gameSession, (req, res) => {
  try {
    const { gameId } = req.body;
    const userId = req.session.user.id;
    
    // 게임 존재 여부 확인
    if (!GAME_CONFIG[gameId]) {
      return res.status(400).json({
        success: false,
        error: '존재하지 않는 게임입니다.'
      });
    }
    
    // 기존 활성 세션 확인 및 정리
    const existingSessions = Array.from(gameSessions.entries())
      .filter(([key, session]) => session.userId === userId && session.gameId === gameId && !session.used);
    
    // 사용자당 게임별 최대 100개 세션 허용 (사실상 제한 없음)
    if (existingSessions.length >= 100) {
      return res.status(429).json({
        success: false,
        error: '동시에 너무 많은 게임 세션이 활성화되어 있습니다. 잠시 후 다시 시도해주세요.'
      });
    }
    
    // 세션 ID 생성 (더 안전한 방식)
    const sessionId = `${userId}_${gameId}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // 게임 세션 정보 저장
    gameSessions.set(sessionId, {
      userId: userId,
      gameId: gameId,
      startTime: Date.now(),
      used: false,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || 'unknown'
    });
    
    // 5분 후 세션 자동 만료
    setTimeout(() => {
      gameSessions.delete(sessionId);
    }, 5 * 60 * 1000);
    
    res.json({
      success: true,
      sessionId: sessionId,
      gameConfig: GAME_CONFIG[gameId]
    });
    
  } catch (error) {
    console.error('게임 세션 시작 오류:', error);
    res.status(500).json({
      success: false,
      error: '게임 세션을 시작할 수 없습니다.'
    });
  }
});

// 게임 점수 제출 및 포인트 변환 (보안 강화)
router.post('/submit-score', requireLogin, gameScoreLimiter, validateInput.gameScore, suspiciousActivityDetector.detectSuspiciousScore, (req, res) => {
  try {
    const { gameId, score, sessionId, playTime } = req.body;
    const userId = req.session.user.id;
    
    // 입력 검증
    if (!gameId || typeof score !== 'number' || !sessionId || typeof playTime !== 'number') {
      return res.status(400).json({
        success: false,
        error: '필수 데이터가 누락되었습니다.'
      });
    }
    
    // 세션 ID 형식 검증 (보안 강화)
    if (typeof sessionId !== 'string' || sessionId.length < 10) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 세션 ID 형식입니다.'
      });
    }
    
    // 세션 ID가 현재 사용자와 게임에 맞는 형식인지 검증
    const expectedPrefix = `${userId}_${gameId}_`;
    if (!sessionId.startsWith(expectedPrefix)) {
      return res.status(400).json({
        success: false,
        error: '세션 ID가 현재 사용자 및 게임과 일치하지 않습니다.'
      });
    }
    
    // 게임 존재 여부 확인
    if (!GAME_CONFIG[gameId]) {
      return res.status(400).json({
        success: false,
        error: '존재하지 않는 게임입니다.'
      });
    }
    
    // 세션 검증
    const session = gameSessions.get(sessionId);
    if (!session) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 게임 세션입니다.'
      });
    }
    
    if (session.userId !== userId || session.gameId !== gameId) {
      return res.status(400).json({
        success: false,
        error: '세션 정보가 일치하지 않습니다.'
      });
    }
    
    if (session.used) {
      return res.status(400).json({
        success: false,
        error: '이미 사용된 세션입니다.'
      });
    }
    
          // 세션을 사용됨으로 표시 (즉시 표시하여 중복 제출 방지)
      session.used = true;
      
      // 세션 즉시 정리 (게임 종료 후)
      gameSessions.delete(sessionId);
      
      // IP 주소 및 User-Agent 검증 (추가 보안)
      const currentIP = req.ip;
      const currentUserAgent = req.get('User-Agent') || 'unknown';
    
    if (session.ipAddress !== currentIP) {
      console.warn(`IP 주소 불일치 감지: 세션 IP ${session.ipAddress}, 현재 IP ${currentIP}, 사용자: ${userId}`);
      // IP 변경은 경고만 하고 차단하지 않음 (모바일 환경 고려)
    }
    
    if (session.userAgent !== currentUserAgent) {
      console.warn(`User-Agent 불일치 감지: 사용자 ${userId}, 게임: ${gameId}`);
      // User-Agent 변경도 경고만 함
    }
    
    // 플레이 시간 검증 (세션 시작 시간과 비교)
    const actualPlayTime = Math.floor((Date.now() - session.startTime) / 1000);
    const timeDifference = Math.abs(actualPlayTime - playTime);
    
    // 플레이 시간이 너무 다르면 의심스러운 요청
    if (timeDifference > 30) { // 30초 이상 차이
      return res.status(400).json({
        success: false,
        error: '플레이 시간이 일치하지 않습니다.'
      });
    }
    
    // PointsService를 사용한 점수 검증
    const scoreValidation = PointsService.validateGameScore(score, gameId, playTime);
    if (!scoreValidation.valid) {
      return res.status(400).json({
        success: false,
        error: scoreValidation.reason || '포인트 적립 요건을 만족하지 않습니다.'
      });
    }
    
    // 게임별 추가 검증 로직
    const gameConfig = GAME_CONFIG[gameId];
    
    // 게임별 최대 점수 검증
    const maxScorePerGame = {
      'snake-game': 2500,
      'memory-game': 2500,
      'puzzle-game': 3000  // 퍼즐 게임 최대 점수 원래대로 복원
    };
    
    console.log(`점수 검증: 게임=${gameId}, 점수=${score}, 최대점수=${maxScorePerGame[gameId]}`);
    
    if (score > maxScorePerGame[gameId]) {
      console.log(`점수 초과: ${score} > ${maxScorePerGame[gameId]}`);
      return res.status(400).json({
        success: false,
        error: '게임 최대 점수를 초과했습니다.'
      });
    }
    
    // 0점일 때는 포인트 적립하지 않음
    if (score === 0) {
      return res.status(400).json({
        success: false,
        error: '점수가 0점이면 포인트를 적립할 수 없습니다. 게임에서 점수를 획득해보세요!'
      });
    }
    
    // 점수를 포인트로 변환
    const convertedPoints = PointsService.convertScoreToPoints(score, gameId);
    
    // 포인트 적립 (PointsService 직접 사용)
    try {
      const result = PointsService.earnPoints(
        userId, 
        convertedPoints, 
        'mini-game', 
        `${gameConfig.name}에서 ${score}점 획득`
      );
      
      // 서비스 이용 횟수 증가
      incrementServiceUsage(userId, 'mini-game');
      
      // 주간 리더보드 업데이트
      try {
        const usersData = PointsService.readUsersData();
        const currentUser = usersData.find(user => user.id === userId);
        let playerName = currentUser?.name || currentUser?.username;
        
        if (!playerName && currentUser?.email) {
          const emailPrefix = currentUser.email.split('@')[0];
          playerName = emailPrefix.substring(0, 4) + '****';
        }
        if (!playerName) {
          playerName = '익명';
        }
        
        WeeklyLeaderboardService.updateWeeklyLeaderboard(userId, gameId, score, playerName);
      } catch (error) {
        console.error('주간 리더보드 업데이트 오류:', error);
        // 리더보드 업데이트 실패해도 게임 점수 제출은 성공으로 처리
      }
      
      // 세션 정리
      gameSessions.delete(sessionId);
      
      // 응답 데이터 로깅
      const responseData = {
        success: true,
        gameScore: score,
        convertedPoints: convertedPoints,
        earnedPoints: result.earnedPoints,
        totalBalance: result.totalPoints,
        dailyEarned: result.dailyEarned,
        dailyRemaining: result.dailyRemaining,
        gameConfig: gameConfig,
        playTime: playTime
      };
      
      console.log('게임 점수 제출 응답 데이터:', responseData);
      
      res.json(responseData);
      
    } catch (pointsError) {
      console.error('포인트 적립 오류:', pointsError);
      
      // 세션 정리
      gameSessions.delete(sessionId);
      
      // 오류 타입에 따른 HTTP 상태 코드 결정
      let statusCode = 400;
      if (pointsError.message.includes('한도')) {
        statusCode = 429; // Too Many Requests
      } else if (pointsError.message.includes('인증') || pointsError.message.includes('권한')) {
        statusCode = 401; // Unauthorized
      }
      
      res.status(statusCode).json({
        success: false,
        error: pointsError.message || '포인트 적립에 실패했습니다.'
      });
    }
    
  } catch (error) {
    console.error('게임 점수 제출 오류:', error);
    res.status(500).json({
      success: false,
      error: '점수 제출에 실패했습니다.'
    });
  }
});

// 보안 통계 조회 (관리자용)
router.get('/security-stats', requireLogin, (req, res) => {
  try {
    const userId = req.session.user.id;
    
    // 사용자별 의심스러운 활동 통계
    const userStats = suspiciousActivityDetector.getUserSuspiciousStats(userId);
    
    // 전체 보안 통계 (관리자만)
    let globalStats = null;
    if (req.session.user.role === 'admin') {
      globalStats = suspiciousActivityDetector.getSecurityStats();
    }
    
    res.json({
      success: true,
      userStats: userStats,
      globalStats: globalStats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('보안 통계 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '보안 통계 조회에 실패했습니다.'
    });
  }
});

// 일일 게임 통계 조회
router.get('/daily-stats', requireLogin, (req, res) => {
  try {
    const userId = req.session.user.id;
    
    // PointsService를 직접 사용하여 포인트 정보 조회
    const pointsInfo = PointsService.getPointsBalance(userId);
    
    // 오늘 게임 플레이 횟수 계산 (포인트 내역에서 mini-game 소스 카운트)
    const today = new Date().toISOString().split('T')[0];
    const todayHistory = PointsService.getPointsHistory(userId, 100)
      .filter(transaction => 
        transaction.type === 'earn' && 
        transaction.source === 'mini-game' &&
        transaction.timestamp.startsWith(today)
      );
    
    const gamesPlayedToday = todayHistory.length;
    
    // 게임별 오늘 최고 점수 계산
    const bestScoresToday = {};
    todayHistory.forEach(transaction => {
      if (transaction.description) {
        // "스네이크 게임에서 1250점 획득" 형태에서 점수 추출
        const scoreMatch = transaction.description.match(/(\d+)점 획득/);
        if (scoreMatch) {
          const score = parseInt(scoreMatch[1]);
          const gameMatch = transaction.description.match(/(스네이크|기억력|퍼즐) 게임/);
          if (gameMatch) {
            const gameType = gameMatch[1];
            const gameKey = gameType === '스네이크' ? 'snake-game' : 
                           gameType === '기억력' ? 'memory-game' : 'puzzle-game';
            
            if (!bestScoresToday[gameKey] || score > bestScoresToday[gameKey]) {
              bestScoresToday[gameKey] = score;
            }
          }
        }
      }
    });
    
    res.json({
      success: true,
      stats: {
        gamesPlayedToday: gamesPlayedToday,
        pointsEarnedToday: pointsInfo.dailyEarned,
        dailyLimit: pointsInfo.dailyLimit,
        remainingPoints: pointsInfo.dailyRemaining,
        totalBalance: pointsInfo.totalPoints,
        bestScoresToday: bestScoresToday,
        availableGames: Object.keys(GAME_CONFIG).length
      }
    });
    
  } catch (error) {
    console.error('일일 게임 통계 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '통계 조회에 실패했습니다.'
    });
  }
});

// 게임별 리더보드 조회
router.get('/leaderboard/:gameId', requireLogin, (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.session.user.id;
    const currentScore = req.query.currentScore ? parseInt(req.query.currentScore) : null;
    
    console.log('리더보드 요청 받음:', { gameId, userId, currentScore });
    
    // 게임 존재 여부 확인
    if (!GAME_CONFIG[gameId]) {
      console.log('존재하지 않는 게임:', gameId);
      return res.status(400).json({
        success: false,
        error: '존재하지 않는 게임입니다.'
      });
    }
    
    console.log('PointsService.getGameLeaderboard 호출 시작');
    
    // PointsService를 사용하여 리더보드 데이터 조회 (현재 점수 포함)
    const leaderboard = PointsService.getGameLeaderboard(gameId, 10, userId, currentScore);
    
    console.log('리더보드 데이터 조회 완료:', leaderboard);
    
    // 현재 사용자 표시를 위한 데이터 처리
    const processedLeaderboard = leaderboard.map(entry => ({
      ...entry,
      isCurrentUser: entry.userId === userId
    }));
    
    console.log('처리된 리더보드 데이터:', processedLeaderboard);
    
    res.json({
      success: true,
      leaderboard: processedLeaderboard,
      gameId: gameId
    });
    
  } catch (error) {
    console.error('리더보드 조회 오류:', error);
    console.error('오류 스택:', error.stack);
    res.status(500).json({
      success: false,
      error: '리더보드를 불러올 수 없습니다.'
    });
  }
});

// 사용자 통계 반환 (실제값)
router.get('/user-stats', requireLogin, (req, res) => {
  try {
    const userId = req.session.user.id;
    const pointsInfo = PointsService.getPointsBalance(userId);
    
    // 오늘 날짜
    const today = new Date().toISOString().split('T')[0];
    
    // 오늘 플레이 횟수 및 최고점 계산
    const history = PointsService.getPointsHistory(userId, 100).filter(tran => 
      tran.timestamp.startsWith(today) && 
      tran.type === 'earn' && 
      tran.source === 'mini-game'
    );
    const gamesPlayedToday = history.length;
    
    const bestScoresToday = {};
    history.forEach(tran => {
      if (tran.description) {
        // "스네이크 게임에서 1250점 획득" 형태에서 점수 추출
        const scoreMatch = tran.description.match(/(\d+)점 획득/);
        if (scoreMatch) {
          const score = parseInt(scoreMatch[1]);
          const gameMatch = tran.description.match(/(스네이크|기억력|퍼즐) 게임/);
          if (gameMatch) {
            const gameType = gameMatch[1];
            const gameKey = gameType === '스네이크' ? 'snake-game' : 
                           gameType === '기억력' ? 'memory-game' : 'puzzle-game';
            if (!bestScoresToday[gameKey] || score > bestScoresToday[gameKey]) {
              bestScoresToday[gameKey] = score;
            }
          }
        }
      }
    });

    // 전체 사용자의 최고 점수 조회
    const globalHighScores = PointsService.getAllGamesHighScores();

    res.json({
      stats: {
        totalBalance: pointsInfo.totalPoints,
        gamesPlayedToday,
        remainingPoints: pointsInfo.dailyRemaining,
        bestScoresToday,
        globalHighScores
      }
    });
  } catch (error) {
    console.error('사용자 통계 조회 오류:', error);
    res.status(500).json({ error: '사용자 통계 조회 실패' });
  }
});

// 주간 리더보드 조회
router.get('/weekly-leaderboard/:gameId', requireLogin, (req, res) => {
  try {
    const { gameId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    
    // 게임 존재 여부 확인
    if (!GAME_CONFIG[gameId]) {
      return res.status(400).json({
        success: false,
        error: '존재하지 않는 게임입니다.'
      });
    }
    
    const result = WeeklyLeaderboardService.getCurrentWeeklyLeaderboard(gameId, limit);
    const timeUntilReset = WeeklyLeaderboardService.getTimeUntilReset();
    
    // 현재 사용자의 순위 정보 추가
    const userId = req.session.user.id;
    const userRank = WeeklyLeaderboardService.getUserWeeklyRank(userId, gameId);
    
    res.json({
      success: true,
      leaderboard: result.leaderboard,
      weekInfo: result.weekInfo,
      timeUntilReset: timeUntilReset,
      userRank: userRank,
      gameId: gameId
    });
    
  } catch (error) {
    console.error('주간 리더보드 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '주간 리더보드를 불러올 수 없습니다.'
    });
  }
});

// 주간 리더보드 히스토리 조회
router.get('/weekly-leaderboard-history', requireLogin, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const history = WeeklyLeaderboardService.getLeaderboardHistory(limit);
    
    res.json({
      success: true,
      history: history
    });
    
  } catch (error) {
    console.error('주간 리더보드 히스토리 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '리더보드 히스토리를 불러올 수 없습니다.'
    });
  }
});

// 주간 리더보드 상태 정보 조회
router.get('/weekly-leaderboard-info', requireLogin, (req, res) => {
  try {
    const data = WeeklyLeaderboardService.readLeaderboardData();
    const timeUntilReset = WeeklyLeaderboardService.getTimeUntilReset();
    
    res.json({
      success: true,
      currentWeek: data.currentWeek,
      nextResetDate: data.nextResetDate,
      timeUntilReset: timeUntilReset,
      lastResetDate: data.lastResetDate
    });
    
  } catch (error) {
    console.error('주간 리더보드 정보 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '리더보드 정보를 불러올 수 없습니다.'
    });
  }
});

// 관리자용: 수동 리더보드 초기화
router.post('/admin/reset-weekly-leaderboard', requireLogin, (req, res) => {
  try {
    // 관리자 권한 확인
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: '관리자 권한이 필요합니다.'
      });
    }
    
    const result = WeeklyLeaderboardService.resetWeeklyLeaderboard();
    
    res.json({
      success: true,
      message: '주간 리더보드가 초기화되었습니다.',
      rewardResults: result
    });
    
  } catch (error) {
    console.error('수동 리더보드 초기화 오류:', error);
    res.status(500).json({
      success: false,
      error: '리더보드 초기화에 실패했습니다.'
    });
  }
});

module.exports = router;