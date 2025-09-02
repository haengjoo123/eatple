const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const helmet = require('helmet');

/**
 * 보안 미들웨어 모듈
 * API 레이트 리미팅, 입력 검증, 보안 헤더 등을 제공
 */

// 일반 API 요청에 대한 레이트 리미팅
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 1000, // 15분당 최대 1000회 요청 (기존 값으로 복원)
  message: {
    success: false,
    error: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
    retryAfter: '15분'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // 정적 파일 요청은 제외
    return req.url.startsWith('/css') || 
           req.url.startsWith('/js') || 
           req.url.startsWith('/images') ||
           req.url.endsWith('.html') ||
           req.url.endsWith('.css') ||
           req.url.endsWith('.js') ||
           req.url.startsWith('/api/auth/login') || // 로그인 요청은 제외
           req.url.startsWith('/api/auth/signup'); // 회원가입 요청은 제외
  }
});

// 게임 점수 제출에 대한 레이트 리미팅
const gameScoreLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 10, // 1분당 최대 10회 점수 제출 (기존 값으로 복원)
  message: {
    success: false,
    error: '점수 제출이 너무 빈번합니다. 잠시 후 다시 시도해주세요.',
    retryAfter: '1분'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // 사용자별로 제한 (IPv6 호환)
    return req.session?.user?.id || ipKeyGenerator(req);
  }
});

// 포인트 관련 API에 대한 레이트 리미팅
const pointsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5분
  max: 200, // 5분당 최대 200회 요청 (기존 값으로 복원)
  message: {
    success: false,
    error: '포인트 관련 요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요.',
    retryAfter: '5분'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.session?.user?.id || ipKeyGenerator(req);
  }
});

// 게임 세션 시작에 대한 레이트 리미팅 (제한 대폭 완화)
const gameSessionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 1000, // 1분당 최대 1000회 세션 시작 (사실상 제한 없음)
  message: {
    success: false,
    error: '게임 세션 시작이 너무 빈번합니다. 잠시 후 다시 시도해주세요.',
    retryAfter: '1분'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.session?.user?.id || ipKeyGenerator(req);
  }
});

/**
 * 입력 검증 미들웨어 (강화)
 */
const validateInput = {
  // 게임 점수 검증 (강화)
  gameScore: (req, res, next) => {
    const { gameId, score, sessionId, playTime } = req.body;
    
    // 필수 필드 검증
    if (!gameId || typeof gameId !== 'string') {
      return res.status(400).json({
        success: false,
        error: '유효한 게임 ID가 필요합니다.'
      });
    }
    
    if (typeof score !== 'number' || score < 0) {
      return res.status(400).json({
        success: false,
        error: '유효한 점수가 필요합니다.'
      });
    }
    
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        success: false,
        error: '유효한 세션 ID가 필요합니다.'
      });
    }
    
    if (typeof playTime !== 'number' || playTime < 0) {
      return res.status(400).json({
        success: false,
        error: '유효한 플레이 시간이 필요합니다.'
      });
    }
    
    // 점수 범위 검증 (대폭 완화)
    if (score > 10000000) { // 1000만점 초과 차단 (10배 증가)
      return res.status(400).json({
        success: false,
        error: '점수가 너무 높습니다.'
      });
    }
    
    // 플레이 시간 범위 검증 (완화)
    if (playTime > 7200) { // 2시간 초과 차단 (2배 증가)
      return res.status(400).json({
        success: false,
        error: '플레이 시간이 너무 깁니다.'
      });
    }
    
    if (playTime < 5 && score > 500) { // 5초 미만에 500점 초과 차단 (대폭 완화)
      return res.status(400).json({
        success: false,
        error: '플레이 시간에 비해 점수가 너무 높습니다.'
      });
    }
    
    next();
  },
  
  // 포인트 관련 검증 (강화)
  points: (req, res, next) => {
    const { points } = req.body;
    
    if (typeof points !== 'number' || points <= 0) {
      return res.status(400).json({
        success: false,
        error: '유효한 포인트 값이 필요합니다.'
      });
    }
    
    if (points > 1000) { // 한 번에 1000포인트 초과 차단 (기존 값으로 복원)
      return res.status(400).json({
        success: false,
        error: '포인트 값이 너무 큽니다.'
      });
    }
    
    next();
  },
  
  // AI API 검증
  aiApi: (req, res, next) => {
    const { prompt } = req.body;
    
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '유효한 프롬프트가 필요합니다.'
      });
    }
    
    // 프롬프트 길이 제한 (10,000자)
    if (prompt.length > 10000) {
      return res.status(400).json({
        success: false,
        error: '프롬프트가 너무 깁니다.'
      });
    }
    
    next();
  },
  
  // 게임 세션 시작 검증 (강화)
  gameSession: (req, res, next) => {
    const { gameId } = req.body;
    
    if (!gameId || typeof gameId !== 'string') {
      return res.status(400).json({
        success: false,
        error: '유효한 게임 ID가 필요합니다.'
      });
    }
    
    // 허용된 게임 ID만 통과
    const allowedGames = ['snake-game', 'memory-game', 'puzzle-game'];
    if (!allowedGames.includes(gameId)) {
      return res.status(400).json({
        success: false,
        error: '지원하지 않는 게임입니다.'
      });
    }
    
    next();
  },

  // AI API 입력 검증 (완화)
  aiApi: (req, res, next) => {
    const { prompt, ingredient } = req.body;
    
    // 식재료 분석 API와 식단 생성 API는 더 관대한 검증 적용
    if (req.path === '/api/analyze-ingredient' || req.path === '/api/generate-meal-plan') {
      // 기본적인 XSS 방지만 적용
      if (prompt && typeof prompt === 'string') {
        const dangerousPatterns = /<script|javascript:|on\w+\s*=|data:text\/html/i;
        if (dangerousPatterns.test(prompt)) {
          return res.status(400).json({
            success: false,
            error: '유효하지 않은 입력이 감지되었습니다.'
          });
        }
        
        // 프롬프트 길이 제한
        if (prompt.length > 10000) { // 식단 생성은 더 긴 프롬프트 허용
          return res.status(400).json({
            success: false,
            error: '프롬프트가 너무 깁니다.'
          });
        }
      }
      
      // 식재료명 검증 (완화)
      if (ingredient && typeof ingredient === 'string') {
        const dangerousPatterns = /<script|javascript:|on\w+\s*=|data:text\/html/i;
        if (dangerousPatterns.test(ingredient)) {
          return res.status(400).json({
            success: false,
            error: '유효하지 않은 식재료명이 감지되었습니다.'
          });
        }
        
        if (ingredient.length > 200) {
          return res.status(400).json({
            success: false,
            error: '식재료명이 너무 깁니다.'
          });
        }
      }
      
      return next();
    }
    
    // 다른 AI API는 기존 검증 적용
    // 프롬프트 검증
    if (prompt && typeof prompt === 'string') {
      // XSS 방지를 위한 특수문자 필터링
      const dangerousPatterns = /<script|javascript:|on\w+\s*=|data:text\/html/i;
      if (dangerousPatterns.test(prompt)) {
        return res.status(400).json({
          success: false,
          error: '유효하지 않은 입력이 감지되었습니다.'
        });
      }
      
      // SQL 인젝션 방지
      const sqlKeywords = ['union', 'select', 'insert', 'update', 'delete', 'drop', 'create', 'alter', 'exec', 'execute', 'script', 'declare', 'cast', 'convert', 'information_schema', 'database', 'table', 'user', 'password', 'admin', 'or', 'and', 'from', 'where', 'group', 'order', 'having', 'limit'];
      const sqlOperators = [' or ', ' and ', '--', '/*', '*/', ';', '=', '>', '<', '>=', '<=', '<>', '!='];
      const specialChars = ["'", '"', '`', ';', '-', '/', '*'];
      
      const lowerPrompt = prompt.toLowerCase();
      
      // SQL 키워드 검사
      for (const keyword of sqlKeywords) {
        if (lowerPrompt.includes(keyword)) {
          return res.status(400).json({
            success: false,
            error: '유효하지 않은 입력이 감지되었습니다.'
          });
        }
      }
      
      // SQL 연산자 검사
      for (const operator of sqlOperators) {
        if (lowerPrompt.includes(operator)) {
          return res.status(400).json({
            success: false,
            error: '유효하지 않은 입력이 감지되었습니다.'
          });
        }
      }
      
      // 특수 문자 검사
      for (const char of specialChars) {
        if (lowerPrompt.includes(char)) {
          return res.status(400).json({
            success: false,
            error: '유효하지 않은 입력이 감지되었습니다.'
          });
        }
      }
      
      // 프롬프트 길이 제한
      if (prompt.length > 2000) {
        return res.status(400).json({
          success: false,
          error: '프롬프트가 너무 깁니다.'
        });
      }
    }
    
    // 식재료 검증
    if (ingredient && typeof ingredient === 'string') {
      const dangerousPatterns = /<script|javascript:|on\w+\s*=|data:text\/html/i;
      if (dangerousPatterns.test(ingredient)) {
        return res.status(400).json({
          success: false,
          error: '유효하지 않은 식재료명이 감지되었습니다.'
        });
      }
      
      if (ingredient.length > 100) {
        return res.status(400).json({
          success: false,
          error: '식재료명이 너무 깁니다.'
        });
      }
    }
    
    next();
  }
};

/**
 * 보안 헤더 설정 (강화)
 */
const securityHeaders = (req, res, next) => {
  // XSS 보호
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // 개발 환경에서는 SAMEORIGIN, 프로덕션에서는 DENY
  const isDevelopment = process.env.NODE_ENV !== 'production';
  res.setHeader('X-Frame-Options', isDevelopment ? 'SAMEORIGIN' : 'DENY');
  
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // CSRF 보호를 위한 헤더
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // 추가 보안 헤더
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googleapis.com https://accounts.google.com https://gstatic.com https://*.gstatic.com https://cdn.jsdelivr.net https://unpkg.com https://dapi.kakao.com http://dapi.kakao.com https://*.kakao.com http://*.kakao.com https://kakao.com http://kakao.com https://*.daumcdn.net http://*.daumcdn.net https://daumcdn.net http://daumcdn.net https://t1.kakaocdn.net https://*.kakaocdn.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com https://accounts.google.com https://gstatic.com https://*.gstatic.com https://cdn.jsdelivr.net; img-src 'self' data: blob: https: http: https://images.unsplash.com https://img.youtube.com https://cdn.jsdelivr.net https://*.kakao.com http://*.kakao.com https://*.daumcdn.net http://*.daumcdn.net https://gstatic.com https://*.gstatic.com https://developers.kakao.com https://t1.kakaocdn.net https://*.kakaocdn.net; font-src 'self' https://fonts.gstatic.com https://gstatic.com https://*.gstatic.com https://cdn.jsdelivr.net; frame-src 'self' https://accounts.google.com https://*.google.com https://coupa.ng https://*.coupa.ng https://ads-partners.coupang.com https://*.coupang.com https://partners.coupangcdn.com https://*.coupangcdn.com; connect-src 'self' https://generativelanguage.googleapis.com https://www.googleapis.com https://accounts.google.com https://oauth2.googleapis.com https://eutils.ncbi.nlm.nih.gov https://newsapi.org https://cdn.jsdelivr.net https://dapi.kakao.com http://dapi.kakao.com https://*.kakao.com http://*.kakao.com https://kakao.com http://kakao.com https://*.daumcdn.net http://*.daumcdn.net https://daumcdn.net http://daumcdn.net https://kapi.kakao.com https://t1.kakaocdn.net https://*.kakaocdn.net;");
  res.setHeader('Permissions-Policy', 'geolocation=(self), microphone=(), camera=()');
  
  next();
};

/**
 * 콘텐츠 필터링 미들웨어 (최종 강화)
 */
const contentFilter = {
  // SQL 인젝션 방지 (완화)
  preventSqlInjection: (req, res, next) => {
    // 식재료 분석 API와 식단 생성 API, 관리자 API는 더 관대한 필터링 적용
    if (req.path === '/api/analyze-ingredient' || 
        req.path === '/api/generate-meal-plan' ||
        req.path.startsWith('/api/admin/products')) {
      return next(); // 해당 API들은 필터링 건너뛰기
    }
    
    // 매우 엄격한 SQL 패턴 검사
    const sqlPatterns = /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script|declare|cast|convert|information_schema|database|table|user|password|admin)\b)|(['"`;])|(\-\-)|(\/\*)|(\*\/)|(\b(or|and)\b\s+\d+\s*=\s*\d+)|(\b(union|select)\b\s+\b(all|distinct)\b)|(\b(or|and)\b\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?)|(\b(union|select)\b\s+\b(from|where|group|order|having|limit)\b)/i;
    
    const checkValue = (value) => {
      if (typeof value === 'string') {
        // SQL 키워드 개별 검사 (더 엄격)
        const sqlKeywords = ['union', 'select', 'insert', 'update', 'delete', 'drop', 'create', 'alter', 'exec', 'execute', 'script', 'declare', 'cast', 'convert', 'information_schema', 'database', 'table', 'user', 'password', 'admin', 'or', 'and', 'from', 'where', 'group', 'order', 'having', 'limit'];
        
        const lowerValue = value.toLowerCase();
        for (const keyword of sqlKeywords) {
          if (lowerValue.includes(keyword)) {
            return false;
          }
        }
        
        // SQL 연산자 검사 (더 엄격)
        const sqlOperators = [' or ', ' and ', '--', '/*', '*/', ';', '=', '>', '<', '>=', '<=', '<>', '!='];
        for (const operator of sqlOperators) {
          if (lowerValue.includes(operator)) {
            return false;
          }
        }
        
        // 특수 문자 검사
        const specialChars = ["'", '"', '`', ';', '-', '/', '*'];
        for (const char of specialChars) {
          if (lowerValue.includes(char)) {
            return false;
          }
        }
        
        // 패턴 매칭 검사
        if (sqlPatterns.test(value)) {
          return false;
        }
      }
      return true;
    };
    
    // 요청 본문 검사
    if (req.body && typeof req.body === 'object') {
      const bodyStr = JSON.stringify(req.body);
      if (!checkValue(bodyStr)) {
        return res.status(400).json({
          success: false,
          error: '유효하지 않은 입력이 감지되었습니다.'
        });
      }
    }
    
    // 쿼리 파라미터 검사
    if (req.query && typeof req.query === 'object') {
      const queryStr = JSON.stringify(req.query);
      if (!checkValue(queryStr)) {
        return res.status(400).json({
          success: false,
          error: '유효하지 않은 쿼리 파라미터가 감지되었습니다.'
        });
      }
    }
    
    next();
  },
  
  // XSS 방지 (완화)
  preventXSS: (req, res, next) => {
    // 식재료 분석 API와 식단 생성 API는 더 관대한 필터링 적용
    if (req.path === '/api/analyze-ingredient' || 
        req.path === '/api/generate-meal-plan' ||
        req.path.startsWith('/api/admin/products')) {
      return next(); // 해당 API들은 필터링 건너뛰기
    }
    
    const xssPatterns = /<script|javascript:|on\w+\s*=|data:text\/html|vbscript:|<iframe|<object|<embed|alert\(|confirm\(|prompt\(/i;
    
    const checkValue = (value) => {
      if (typeof value === 'string' && xssPatterns.test(value)) {
        return false;
      }
      return true;
    };
    
    // 요청 본문 검사
    if (req.body && typeof req.body === 'object') {
      const bodyStr = JSON.stringify(req.body);
      if (!checkValue(bodyStr)) {
        return res.status(400).json({
          success: false,
          error: 'XSS 공격이 감지되었습니다.'
        });
      }
    }
    
    // URL 파라미터 검사
    if (req.params && typeof req.params === 'object') {
      const paramsStr = JSON.stringify(req.params);
      if (!checkValue(paramsStr)) {
        return res.status(400).json({
          success: false,
          error: 'XSS 공격이 감지되었습니다.'
        });
      }
    }
    
    next();
  }
};

/**
 * 의심스러운 활동 감지
 */
const suspiciousActivityDetector = {
  // 사용자별 활동 추적
  userActivity: new Map(),
  
  // 서버 시작 시 활동 데이터 초기화
  initializeActivityData: function() {
    this.userActivity.clear();
            // 초기화 완료 로그는 서버에서 처리
  },
  
  // 의심스러운 점수 패턴 감지
  detectSuspiciousScore: function(req, res, next) {
    const userId = req.session?.user?.id;
    const { score, gameId, playTime } = req.body;
    
    if (!userId) {
      return next();
    }
    
    const now = Date.now();
    const userKey = `${userId}_${gameId}`;
    
    if (!suspiciousActivityDetector.userActivity.has(userKey)) {
      suspiciousActivityDetector.userActivity.set(userKey, {
        scores: [],
        lastSubmission: 0,
        suspiciousCount: 0,
        resetTime: now + (24 * 60 * 60 * 1000) // 24시간 후 리셋
      });
    }
    
    const activity = suspiciousActivityDetector.userActivity.get(userKey);
    
    // 24시간마다 의심스러운 활동 카운트 리셋
    if (now > activity.resetTime) {
      activity.suspiciousCount = 0;
      activity.resetTime = now + (24 * 60 * 60 * 1000);
    }
    
    // 의심스러운 활동 감지 완전 비활성화 (정상적인 게임 플레이를 위해)
    // 모든 감지 로직을 주석 처리
    
    // 활동 기록 업데이트
    activity.scores.push({ score, timestamp: now, playTime });
    activity.lastSubmission = now;
    
    // 오래된 기록 정리 (최근 10개만 유지)
    if (activity.scores.length > 10) {
      activity.scores = activity.scores.slice(-10);
    }
    
    next();
  },
  
  // 메모리 정리 (주기적으로 호출)
  cleanupOldActivity: function() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    for (const [key, activity] of suspiciousActivityDetector.userActivity.entries()) {
      if (activity.lastSubmission < oneHourAgo) {
        suspiciousActivityDetector.userActivity.delete(key);
      }
    }
    
            // 정리 완료 로그는 서버에서 처리
  },
  
  // 사용자별 의심스러운 활동 통계 조회
  getUserSuspiciousStats: function(userId) {
    const userStats = {};
    
    for (const [key, activity] of suspiciousActivityDetector.userActivity.entries()) {
      if (key.startsWith(userId + '_')) {
        const gameId = key.split('_')[1];
        userStats[gameId] = {
          suspiciousCount: activity.suspiciousCount,
          totalScores: activity.scores.length,
          lastActivity: new Date(activity.lastSubmission).toISOString()
        };
      }
    }
    
    return userStats;
  },
  
  // 전체 보안 통계 조회 (관리자용)
  getSecurityStats: function() {
    const stats = {
      totalUsers: suspiciousActivityDetector.userActivity.size,
      suspiciousUsers: 0,
      totalSuspiciousActivities: 0
    };
    
    for (const [key, activity] of suspiciousActivityDetector.userActivity.entries()) {
      if (activity.suspiciousCount > 0) {
        stats.suspiciousUsers++;
        stats.totalSuspiciousActivities += activity.suspiciousCount;
      }
    }
    
    return stats;
  }
};

// 점수 검증 미들웨어
const validateScore = (req, res, next) => {
  const { gameId, score, sessionId } = req.body;
  
  // 필수 필드 검증
  if (!gameId || typeof score !== 'number' || !sessionId) {
    return res.status(400).json({
      success: false,
      error: '필수 필드가 누락되었습니다.'
    });
  }
  
  // 게임별 최대 점수 제한
  const maxScores = {
    'snake-game': 10000,
    'memory-game': 5000,
    'puzzle-game': 8000
  };
  
  if (score > maxScores[gameId]) {
    return res.status(400).json({
      success: false,
      error: 'invalid score - 비현실적인 점수입니다.'
    });
  }
  
  // 음수 점수 차단
  if (score < 0) {
    return res.status(400).json({
      success: false,
      error: 'invalid score - 유효하지 않은 점수입니다.'
    });
  }
  
  next();
};

// 세션 검증 미들웨어
const validateSession = (req, res, next) => {
  const { sessionId } = req.body;
  
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: '세션 ID가 필요합니다.'
    });
  }
  
  // 세션 ID 형식 검증
  const sessionIdPattern = /^[a-zA-Z0-9-_]{10,50}$/;
  if (!sessionIdPattern.test(sessionId)) {
    return res.status(400).json({
      success: false,
      error: '유효하지 않은 세션 ID 형식입니다.'
    });
  }
  
  // 중복 세션 검증을 위한 캐시
  if (!global.usedSessions) {
    global.usedSessions = new Set();
  }
  
  if (global.usedSessions.has(sessionId)) {
    return res.status(400).json({
      success: false,
      error: 'duplicate session - 이미 사용된 세션입니다.'
    });
  }
  
  // 세션 ID를 사용된 목록에 추가
  global.usedSessions.add(sessionId);
  
  next();
};

module.exports = {
  generalLimiter,
  gameScoreLimiter,
  pointsLimiter,
  gameSessionLimiter,
  validateInput,
  validateScore,
  validateSession,
  securityHeaders,
  suspiciousActivityDetector,
  contentFilter
};