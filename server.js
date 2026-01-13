const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();
const path = require("path");
const session = require("express-session");
const multer = require("multer");
const {
  generalLimiter,
  securityHeaders,
  contentFilter,
  validateInput,
} = require("./utils/securityMiddleware");
const cacheManager = require("./utils/cacheManager");
const imageOptimizer = require("./utils/imageOptimizer");
// const supabaseService = require("./utils/supabaseService"); // 더 이상 사용하지 않음 (로컬 데이터 사용)
// const { updateDailyLimits } = require("./utils/userDataMigration"); // 파일 삭제됨

const app = express();

// HTTP 요청 크기 제한 증가
app.use((req, res, next) => {
  // 헤더 크기 제한 해제
  if (req.connection.server) {
    req.connection.server.maxHeadersCount = 0;
  }
  next();
});

// 보안 헤더 적용 (강화)
app.use(securityHeaders);

// 콘텐츠 필터링 적용 (AI API에만 적용)
app.use("/api/generate-meal-plan", contentFilter.preventSqlInjection);
app.use("/api/generate-meal-plan", contentFilter.preventXSS);
// 관리자 API는 보안 미들웨어에서 자체적으로 처리

// 전역 레이트 리미팅 적용 (강화)
app.use(generalLimiter);

// CORS 설정: 개발 및 프로덕션 환경 모두 허용
app.use(
  cors({
    origin: function (origin, callback) {
      // 개발 환경에서는 모든 origin 허용
      if (process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }
      
      // 프로덕션 환경에서 허용할 origin 목록
      const allowedOrigins = [
        "http://localhost:3000",
        "https://eatple.onrender.com",
        "https://eatple.net",
        "https://www.eatple.net",
        process.env.FRONTEND_URL, // 환경변수로 프론트엔드 URL 설정 가능
        // Render의 자동 생성 도메인도 허용
        /^https:\/\/.*\.onrender\.com$/
      ];
      
      // origin이 없거나 허용 목록에 있으면 허용
      if (!origin || allowedOrigins.some(allowed => {
        if (typeof allowed === 'string') {
          return allowed === origin;
        } else if (allowed instanceof RegExp) {
          return allowed.test(origin);
        }
        return false;
      })) {
        callback(null, true);
      } else {
        console.log('CORS blocked origin:', origin);
        callback(new Error('CORS policy violation'));
      }
    },
    methods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
    credentials: true,
    optionsSuccessStatus: 200 // 일부 브라우저 호환성을 위해
  })
);
app.use(bodyParser.json({ limit: "50mb" })); // 요청 크기 제한 증가
app.use(
  bodyParser.urlencoded({
    extended: true,
    limit: "50mb",
    parameterLimit: 100000,
  })
);

// 세션 미들웨어 적용 (Render 환경 최적화)
const sessionConfig = {
  secret: process.env.SESSION_SECRET || "mealplan_secret_key_enhanced",
  resave: false,
  saveUninitialized: false,
  name: "mealplan_session",
  rolling: true, // 매 요청마다 세션 갱신
  // Render 환경에서 세션 지속성을 위한 설정
  proxy: true, // 프록시 뒤에서 실행될 때 필요
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // 24시간
  }
};

// Render 환경에서는 secure와 sameSite 설정을 조건부로 적용
if (process.env.NODE_ENV === "production") {
  sessionConfig.cookie.secure = true;
  // Render 환경에서는 sameSite를 none으로 명시적 설정
  sessionConfig.cookie.sameSite = "none";
  // 새 도메인(apex 및 www) 모두에서 세션 공유를 위해 최상위 도메인 설정
  sessionConfig.cookie.domain = ".eatple.net";
} else {
  sessionConfig.cookie.secure = false;
  sessionConfig.cookie.sameSite = "lax";
}

// console.log('세션 설정:', {
//   nodeEnv: process.env.NODE_ENV,
//   render: process.env.RENDER,
//   cookieConfig: sessionConfig.cookie
// });

// 세션 미들웨어 적용
app.use(session(sessionConfig));

// 세션 디버깅 미들웨어 (개발 환경에서만 활성화) - 로그 비활성화
// if (process.env.NODE_ENV !== 'production') {
//   app.use((req, res, next) => {
//     console.log('세션 상태:', {
//       sessionId: req.sessionID,
//       hasSession: !!req.session,
//       hasUser: !!req.session?.user,
//       cookie: req.headers.cookie
//     });
//     next();
//   });
// }

// 정적 파일 제공 (HTML, CSS, JS) - 캐싱 적용
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: "1h", // 1시간 캐싱
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      // 이미지 파일에 대해 더 긴 캐싱 적용
      if (path.includes("/uploads/")) {
        res.setHeader("Cache-Control", "public, max-age=86400"); // 24시간
      }
    },
  })
);

// favicon 제공
app.get("/favicon.ico", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "favicon.ico"));
});

// 인증 라우터 연결
app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin", require("./routes/auth"));
app.use("/api/profile", require("./routes/profile"));
app.use("/api/saved-meals", require("./routes/saved-meals"));
app.use("/api/supplements", require("./routes/supplements"));
app.use("/api/restaurants", require("./routes/restaurants"));
app.use("/api/stats", require("./routes/stats"));
app.use("/api/contact", require("./routes/contact"));
app.use("/api/points", require("./routes/points"));
app.use("/api/games", require("./routes/games"));
// 영양 정보 관련 유틸리티들 (Supabase 데이터 전용)
const SupabaseNutritionDataManager = require("./utils/supabaseNutritionDataManager");

// 인스턴스 생성 (Supabase 사용)
const supabaseNutritionDataManager = new SupabaseNutritionDataManager();

// 추천 서비스 초기화
const NutritionRecommendationService = require("./utils/nutritionRecommendationService");
const recommendationService = new NutritionRecommendationService();

// nutrition-info 라우터 초기화 (Supabase 사용)
const nutritionInfoRouter = require("./routes/nutrition-info")(
  supabaseNutritionDataManager, // Supabase 기반 데이터 매니저 사용
  null, // contentAggregator (현재 사용하지 않음)
  null, // aiContentProcessor (현재 사용하지 않음)
  recommendationService
);
app.use("/api/nutrition-info", nutritionInfoRouter);
app.use("/api/admin/nutrition-info", require("./routes/admin-nutrition-info"));
app.use("/api/admin/manual-posting", require("./routes/admin-manual-posting"));
app.use("/api/admin/monitoring", require("./routes/monitoring"));

// RSS 피드 라우트
const rssRouter = require("./routes/rss")();
app.use("/rss", rssRouter);
app.use("/rss.xml", rssRouter);

// 사이트맵 라우트
const sitemapRouter = require("./routes/sitemap")();
app.use("/sitemap.xml", sitemapRouter);
// 잇플스토어 일시 비활성화 - 재활성화시 주석 해제
// app.use("/api/admin/products", require("./routes/admin-products"));
// app.use("/api/admin/product-categories", require("./routes/admin-categories"));
// app.use("/api/promotions", require("./routes/promotions"));
// app.use("/api/shop", require("./routes/shop"));
// YouTube API와 News API 라우터는 현재 비활성화
// app.use("/api/youtube", require("./routes/youtube"));
// app.use("/api/news", require("./routes/news"));
// 파파고 번역 API 라우터는 현재 비활성화
// app.use("/api/translation", require("./routes/translation"));
app.use(
  "/api/food-nutrition-external",
  require("./routes/food-nutrition-external")
);
// 인증은 routes/auth.js에서 처리 (로컬 파일 기반)

// 관리자 캐시 및 최적화 API (직접 정의)
app.get("/api/admin/cache-stats", (req, res) => {
  if (!req.session || !req.session.user || req.session.user.role !== "admin") {
    return res.status(403).json({ error: "관리자 권한이 필요합니다." });
  }

  const stats = cacheManager.getCacheStats();
  res.json({
    success: true,
    stats,
    memoryUsage: cacheManager.getMemoryUsage(),
  });
});

app.post("/api/admin/cache-invalidate", (req, res) => {
  if (!req.session || !req.session.user || req.session.user.role !== "admin") {
    return res.status(403).json({ error: "관리자 권한이 필요합니다." });
  }

  const { type, key } = req.body;
  const success = cacheManager.invalidateCache(type, key);

  res.json({
    success,
    message: success ? "캐시 무효화 완료" : "캐시 무효화 실패",
  });
});

app.post(
  "/api/admin/optimize-images",
  validateInput.aiApi, // 입력 검증
  async (req, res) => {
    if (
      !req.session ||
      !req.session.user ||
      req.session.user.role !== "admin"
    ) {
      return res.status(403).json({ error: "관리자 권한이 필요합니다." });
    }

    const { inputPath, outputPath, options } = req.body;

    try {
      const result = await imageOptimizer.optimizeImage(
        inputPath,
        outputPath,
        options
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

app.get("/api/admin/image-score/:imagePath(*)", (req, res) => {
  if (!req.session || !req.session.user || req.session.user.role !== "admin") {
    return res.status(403).json({ error: "관리자 권한이 필요합니다." });
  }

  const imagePath = req.params.imagePath;

  imageOptimizer
    .calculateImageScore(imagePath)
    .then((result) => {
      res.json(result);
    })
    .catch((error) => {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    });
});

// 환경 변수에서 API 키들 가져오기
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const KAKAO_MAP_API_KEY =
  process.env.KAKAO_MAP_API_KEY;

console.log("🔍 환경 변수 상태 확인:");
console.log("- GEMINI_API_KEY:", GEMINI_API_KEY ? "설정됨" : "설정되지 않음");
console.log(
  "- KAKAO_MAP_API_KEY:",
  KAKAO_MAP_API_KEY ? "설정됨" : "설정되지 않음"
);

if (!GEMINI_API_KEY) {
  console.error(
    "Gemini API 키가 설정되지 않았습니다. .env 파일에 GEMINI_API_KEY를 추가하세요."
  );
  console.warn("⚠️  Mock 모드로 실행됩니다. 실제 API 기능이 제한됩니다.");
} else {
  console.log("✅ Gemini API 키가 설정되었습니다. 실제 API 기능을 사용합니다.");
}

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
// 추천식단 전용 Gemini 2.5 Pro API URL
const GEMINI_MEAL_PLAN_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;

// 서비스 이용 횟수 추적 모듈
const {
  incrementServiceUsage,
  SERVICE_TYPES,
} = require("./utils/serviceUsageTracker");

// 포인트 서비스 모듈
const PointsService = require("./utils/pointsService");

// AI API 호출 (추천식단 - Gemini 2.5 Pro 사용)
app.post(
  "/api/generate-meal-plan",
  validateInput.aiApi, // 입력 검증 적용
  async (req, res) => {
    const prompt = req.body.prompt;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return res
        .status(400)
        .json({ error: "유효한 프롬프트가 제공되지 않았습니다." });
    }

    // 더 정확한 캐시 키 생성 (전체 프롬프트의 해시 사용)
    const crypto = require("crypto");
    const cacheKey = `meal_plan_${crypto
      .createHash("sha256")
      .update(prompt)
      .digest("hex")}`;

    // 캐시에서 응답 확인
    const cachedResponse = cacheManager.get('api', cacheKey);
    if (cachedResponse) {
      console.log("✅ 캐시된 응답 사용 (완전 동일한 요청)");
      return res.json(cachedResponse);
    }

    try {
      console.log("🍽️ 추천식단 생성 - Gemini 2.5 Pro 모델 사용");
      const response = await axios.post(
        GEMINI_MEAL_PLAN_API_URL,
        {
          contents: [{ parts: [{ text: prompt }] }],
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 300000, // 300초 타임아웃
        }
      );

      // 응답 캐싱 (1시간)
      cacheManager.set('api', cacheKey, response.data, {}, 3600);

      // 로그인한 사용자인 경우 서비스 이용 횟수 증가
      if (req.session && req.session.user) {
        incrementServiceUsage(req.session.user.id, SERVICE_TYPES.MEAL_PLAN);
      }

      res.json(response.data);
    } catch (error) {
      console.error(
        "Gemini API 오류:",
        error.response ? error.response.data : error.message
      );
      res.status(500).json({
        error: "Gemini API 호출 실패",
        details: error.response ? error.response.data : error.message,
      });
    }
  }
);

// 영양제 추천용 Gemini API 엔드포인트
app.post(
  "/api/generate-supplement-recommendation",
  validateInput.aiApi,
  async (req, res) => {
    const prompt = req.body.prompt;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return res
        .status(400)
        .json({ error: "유효한 프롬프트가 제공되지 않았습니다." });
    }

    // 더 정확한 캐시 키 생성 (전체 프롬프트의 해시 사용)
    const crypto = require("crypto");
    const cacheKey = `supplement_${crypto
      .createHash("sha256")
      .update(prompt)
      .digest("hex")}`;

    // 캐시에서 응답 확인
    const cachedResponse = cacheManager.get('api', cacheKey);
    if (cachedResponse) {
      console.log("✅ 캐시된 영양제 추천 응답 사용 (완전 동일한 요청)");
      return res.json(cachedResponse);
    }

    try {
      const response = await axios.post(
        GEMINI_API_URL,
        {
          contents: [{ parts: [{ text: prompt }] }],
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 300000, // 300초 타임아웃
        }
      );

      // 응답 캐싱 (2시간)
      cacheManager.set('api', cacheKey, response.data, {}, 7200);

      res.json(response.data);
    } catch (error) {
      console.error(
        "영양제 추천 Gemini API 오류:",
        error.response ? error.response.data : error.message
      );
      res.status(500).json({
        error: "영양제 추천 API 호출 실패",
        details: error.response ? error.response.data : error.message,
      });
    }
  }
);

// AI 식재료 분석용 Gemini API 엔드포인트 (보안 강화)
app.post("/api/analyze-ingredient", validateInput.aiApi, async (req, res) => {
  const { ingredient, prompt } = req.body;

  if (
    !ingredient ||
    typeof ingredient !== "string" ||
    ingredient.trim().length === 0
  ) {
    return res
      .status(400)
      .json({ error: "유효한 식재료명이 제공되지 않았습니다." });
  }

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return res
      .status(400)
      .json({ error: "유효한 프롬프트가 제공되지 않았습니다." });
  }

  // 캐시 키 생성
  const cacheKey = `ingredient_${Buffer.from(ingredient + prompt)
    .toString("base64")
    .substring(0, 50)}`;

  // 캐시에서 응답 확인
  const cachedResponse = cacheManager.get('api', cacheKey);
  if (cachedResponse) {
    console.log("✅ 캐시된 식재료 분석 응답 사용");
    return res.json(cachedResponse);
  }

  try {
    const response = await axios.post(
      GEMINI_API_URL,
      {
        contents: [{ parts: [{ text: prompt }] }],
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 300000, // 300초 타임아웃
      }
    );

    // Gemini API 응답에서 텍스트 추출
    const generatedText = response.data.candidates[0].content.parts[0].text;

    // 로그인한 사용자인 경우 서비스 이용 횟수 증가
    if (req.session && req.session.user) {
      incrementServiceUsage(
        req.session.user.id,
        SERVICE_TYPES.INGREDIENT_ANALYSIS
      );
    }

    // JSON 파싱 시도
    try {
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedResult = JSON.parse(jsonMatch[0]);
        const result = { result: parsedResult };

        // 응답 캐싱 (3시간)
        cacheManager.set('api', cacheKey, result, {}, 10800);

        res.json(result);
      } else {
        // JSON이 아닌 경우 텍스트 그대로 반환
        const result = { result: { text: generatedText } };

        // 응답 캐싱 (3시간)
        cacheManager.set('api', cacheKey, result, {}, 10800);

        res.json(result);
      }
    } catch (parseError) {
      console.error("JSON 파싱 오류:", parseError);
      const result = { result: { text: generatedText } };

      // 응답 캐싱 (3시간)
      cacheManager.set('api', cacheKey, result, {}, 10800);

      res.json(result);
    }
  } catch (error) {
    console.error(
      "식재료 분석 Gemini API 오류:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({
      error: "식재료 분석 API 호출 실패",
      details: error.response ? error.response.data : error.message,
    });
  }
});



// 카카오 지도 API 키 제공 엔드포인트
app.get("/api/kakao-map-key", (req, res) => {
  console.log("🔑 카카오맵 API 키 요청 받음");
  console.log("📡 요청 도메인:", req.get('origin') || req.get('host'));
  console.log("🔑 API 키 상태:", KAKAO_MAP_API_KEY ? "설정됨" : "설정되지 않음");
  
  if (!KAKAO_MAP_API_KEY) {
    console.error("❌ 카카오맵 API 키가 설정되지 않았습니다!");
    return res.status(500).json({ 
      error: "카카오맵 API 키가 설정되지 않았습니다.",
      apiKey: null 
    });
  }
  
  res.json({ apiKey: KAKAO_MAP_API_KEY });
});

// 카카오 JavaScript 키 제공 엔드포인트
app.get("/api/kakao-js-key", (req, res) => {
  res.json({ apiKey: process.env.KAKAO_JAVASCRIPT_KEY });
});

// 카카오 REST API 키 제공 엔드포인트
app.get("/api/kakao-rest-key", (req, res) => {
  res.json({ apiKey: process.env.KAKAO_REST_API_KEY });
});

// 환경변수 상태 확인 엔드포인트 (디버깅용)
app.get("/api/env-status", (req, res) => {
  res.json({
    KAKAO_MAP_API_KEY: KAKAO_MAP_API_KEY ? "설정됨" : "설정되지 않음",
    KAKAO_REST_API_KEY: process.env.KAKAO_REST_API_KEY ? "설정됨" : "설정되지 않음",
    KAKAO_JAVASCRIPT_KEY: process.env.KAKAO_JAVASCRIPT_KEY ? "설정됨" : "설정되지 않음",
    NODE_ENV: process.env.NODE_ENV || "설정되지 않음",
    PORT: process.env.PORT || "설정되지 않음"
  });
});

// Multer 설정 (메모리 저장)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 10, // 최대 10개 파일
  },
  fileFilter: (req, file, cb) => {
    // 이미지 파일만 허용
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("이미지 파일만 업로드 가능합니다."), false);
    }
  },
});

// 이미지 업로드 엔드포인트 (최적화 포함)
app.post("/api/upload-images", upload.array("images", 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "업로드할 이미지가 없습니다." });
    }

    const fs = require("fs");
    const path = require("path");
    const crypto = require("crypto");

    // uploads 디렉토리 생성
    const uploadsDir = path.join(__dirname, "public", "uploads", "products");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const imageUrls = [];

    for (const file of req.files) {
      try {
        // 고유한 파일명 생성
        const fileName = `${crypto.randomUUID()}.jpg`; // 모든 이미지를 jpg로 통일
        const filePath = path.join(uploadsDir, fileName);

        // 이미지 최적화 시도 (sharp가 설치되어 있는 경우)
        try {
          const ImageOptimizer = require("./utils/imageOptimizer");
          const optimizer = new ImageOptimizer();

          await optimizer.optimizeAndSave(file.buffer, filePath, {
            maxWidth: 1200,
            maxHeight: 800,
            quality: 85,
            format: "jpeg",
          });

          console.log(`이미지 최적화 완료: ${fileName}`);
        } catch (optimizeError) {
          // 최적화 실패 시 원본 저장
          console.warn("이미지 최적화 실패, 원본 저장:", optimizeError.message);
          fs.writeFileSync(filePath, file.buffer);
        }

        // 웹에서 접근 가능한 URL 생성
        const imageUrl = `/uploads/products/${fileName}`;
        imageUrls.push(imageUrl);
      } catch (fileError) {
        console.error(`파일 처리 실패: ${file.originalname}`, fileError);
        // 개별 파일 실패는 건너뛰고 계속 진행
      }
    }

    if (imageUrls.length === 0) {
      return res
        .status(500)
        .json({ error: "모든 이미지 처리에 실패했습니다." });
    }

    res.json({
      imageUrls,
      message: `${imageUrls.length}개 이미지가 업로드되었습니다.`,
    });
  } catch (error) {
    console.error("이미지 업로드 실패:", error);
    res.status(500).json({ error: "이미지 업로드에 실패했습니다." });
  }
});

// 네이버 Client ID 제공 엔드포인트
app.get("/api/naver-client-id", (req, res) => {
  const clientId = process.env.NAVER_CLOUD_CLIENT_ID || process.env.NAVER_CLIENT_ID;

  if (!clientId) {
    return res.status(500).json({
      error: "NAVER Client ID가 설정되지 않았습니다.",
      clientId: null,
    });
  }

  res.json({ clientId });
});

// 잇플스토어 일시 비활성화 - 상품 문의 API 엔드포인트 (Supabase 사용)
/*
app.get("/api/product-inquiries", async (req, res) => {
  try {
    const inquiries = await supabaseService.getProductInquiries();
    res.json(inquiries);
  } catch (error) {
    console.error("상품 문의 조회 실패:", error);
    console.error("오류 상세:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    // 테이블이 존재하지 않는 경우 빈 배열 반환
    if (error.code === "PGRST116" || error.message.includes("does not exist")) {
      console.log("product_qna 테이블이 존재하지 않아 빈 배열을 반환합니다.");
      return res.json([]);
    }

    res.status(500).json({
      error: "상품 문의를 불러올 수 없습니다.",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});
*/

/*
app.put("/api/product-inquiries/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { answer, status, adminId } = req.body;

    const updatedInquiry = await supabaseService.updateProductInquiry(id, {
      answer,
      status,
      adminId,
    });

    res.json({
      message: "문의가 업데이트되었습니다.",
      inquiry: updatedInquiry,
    });
  } catch (error) {
    console.error("상품 문의 업데이트 실패:", error);
    res.status(500).json({ error: "문의 업데이트에 실패했습니다." });
  }
});
*/

// 잇플스토어 일시 비활성화 - 특정 상품의 문의 조회
/*
app.get("/api/products/:productId/inquiries", async (req, res) => {
  try {
    const { productId } = req.params;
    const inquiries = await supabaseService.getProductInquiriesByProductId(
      productId
    );
    res.json(inquiries);
  } catch (error) {
    console.error("특정 상품 문의 조회 실패:", error);
    res.status(500).json({ error: "상품 문의를 불러올 수 없습니다." });
  }
});
*/

// 잇플스토어 일시 비활성화 - Supabase 제품 API 엔드포인트
/*
app.get("/api/products", async (req, res) => {
  try {
    const products = await supabaseService.getProducts();
    res.json({ products });
  } catch (error) {
    console.error("제품 조회 실패:", error);
    res.status(500).json({ error: "제품 데이터를 불러오는데 실패했습니다." });
  }
});
*/

/*
app.post("/api/products", async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      originalPrice,
      brand,
      shippingFee,
      maxSalesQuantity,
      category,
      status,
      image_url,
      summary,
    } = req.body;

    // 디버깅 로그 추가
    console.log("🔍 [DEBUG] POST /api/products 받은 데이터:", req.body);
    console.log(
      "🔍 [DEBUG] originalPrice:",
      originalPrice,
      typeof originalPrice
    );

    // 입력 검증
    if (!name || !price || !category || !brand) {
      return res.status(400).json({ error: "필수 필드가 누락되었습니다." });
    }

    const productData = {
      name,
      description: description || null,
      price: parseInt(price),
      originalPrice: originalPrice ? parseInt(originalPrice) : null,
      brand: brand || null,
      shipping_fee: shippingFee ? parseInt(shippingFee) : 3000, // snake_case로 변경
      max_sales_quantity: maxSalesQuantity || null,
      category,
      status: status || "active",
      image_url: image_url || null,
      summary: summary || null,
    };

    const newProduct = await supabaseService.createProduct(productData);

    res.json({
      product: newProduct,
      message: "제품이 성공적으로 추가되었습니다.",
    });
  } catch (error) {
    console.error("제품 추가 실패:", error);
    res.status(500).json({ error: "제품 추가에 실패했습니다." });
  }
});
*/

/*
app.put("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      originalPrice,
      brand,
      shippingFee,
      maxSalesQuantity,
      category,
      status,
      image_url,
      summary,
    } = req.body;

    // 디버깅 로그 추가
    console.log("🔍 [DEBUG] PUT /api/products/:id 받은 데이터:", req.body);
    console.log(
      "🔍 [DEBUG] originalPrice:",
      originalPrice,
      typeof originalPrice
    );

    // 입력 검증
    if (!name || !price || !category || !brand) {
      return res.status(400).json({ error: "필수 필드가 누락되었습니다." });
    }

    const productData = {
      name,
      description: description || null,
      price: parseInt(price),
      originalPrice: originalPrice ? parseInt(originalPrice) : null,
      brand: brand || null,
      shipping_fee: shippingFee ? parseInt(shippingFee) : 3000, // snake_case로 변경
      max_sales_quantity: maxSalesQuantity || null,
      category,
      status: status || "active",
      image_url: image_url || null,
      summary: summary || null,
    };

    const updatedProduct = await supabaseService.updateProduct(id, productData);

    res.json({
      product: updatedProduct,
      message: "제품이 성공적으로 업데이트되었습니다.",
    });
  } catch (error) {
    console.error("제품 업데이트 실패:", error);
    res.status(500).json({ error: "제품 업데이트에 실패했습니다." });
  }
});
*/

/*
app.delete("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await supabaseService.deleteProduct(id);

    res.json({ message: "제품이 성공적으로 삭제되었습니다." });
  } catch (error) {
    console.error("제품 삭제 실패:", error);
    res.status(500).json({ error: "제품 삭제에 실패했습니다." });
  }
});
*/

// 잇플스토어 일시 비활성화 - 제품 이미지 업데이트 엔드포인트
/*
app.put("/api/products/:id/images", async (req, res) => {
  try {
    const { id } = req.params;
    const { images } = req.body;

    if (!images || !Array.isArray(images)) {
      return res.status(400).json({ error: "이미지 데이터가 필요합니다." });
    }

    const imageUrl = images.length > 0 ? JSON.stringify(images) : null;

    const result = await supabaseService.updateProduct(id, {
      image_url: imageUrl,
    });
    res.json(result);
  } catch (error) {
    console.error("제품 이미지 업데이트 실패:", error);
    res.status(500).json({ error: "제품 이미지 업데이트에 실패했습니다." });
  }
});
*/

// 루트 경로에서 index.html 제공
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 서버 시작 시 일일 한도 초기화
function initializeDailyLimits() {
  try {
    console.log("일일 한도 초기화 시작...");
    const hasChanges = PointsService.resetAllUsersDailyLimits();

    if (hasChanges) {
      console.log("✅ 일일 한도 초기화 완료");
    } else {
      console.log("ℹ️ 초기화할 사용자가 없습니다.");
    }
  } catch (error) {
    console.error("❌ 일일 한도 초기화 오류:", error);
  }
}

// 주간 리더보드 시스템 초기화
function initializeWeeklyLeaderboard() {
  try {
    console.log("주간 리더보드 시스템 초기화 시작...");
    const WeeklyLeaderboardService = require("./utils/weeklyLeaderboardService");

    // 스케줄러 시작
    WeeklyLeaderboardService.startWeeklyScheduler();

    console.log("✅ 주간 리더보드 시스템 초기화 완료");
  } catch (error) {
    console.error("❌ 주간 리더보드 시스템 초기화 오류:", error);
  }
}

// 보안 관련 메모리 정리
function cleanupSecurityData() {
  try {
    const {
      suspiciousActivityDetector,
    } = require("./utils/securityMiddleware");
    suspiciousActivityDetector.cleanupOldActivity();
    console.log("보안 데이터 정리 완료:", new Date().toISOString());
  } catch (error) {
    console.error("보안 데이터 정리 실패:", error);
  }
}

// 메모리 정리 함수 (개선된 버전)
function performMemoryCleanup() {
  try {
    console.log("🧹 메모리 정리 시작...");

    // 메모리 사용량 체크
    const memoryInfo = memoryMonitor.checkMemoryUsage();

    // 캐시 정리
    cacheManager.cleanup();

    // 모니터링 시스템 정리
    if (
      monitoringSystem &&
      typeof monitoringSystem.cleanupWebSocketClients === "function"
    ) {
      monitoringSystem.cleanupWebSocketClients();
    }

    // WebSocket 클라이언트 정리
    const wsClients = Array.from(wss.clients);
    let closedConnections = 0;
    wsClients.forEach((ws) => {
      if (ws.readyState !== ws.OPEN) {
        ws.terminate();
        closedConnections++;
      }
    });

    if (closedConnections > 0) {
      console.log(`비활성 WebSocket 연결 ${closedConnections}개 정리됨`);
    }

    // 메모리 사용량이 높으면 가비지 컬렉션 강제 실행 (임계값 상향 조정)
    if (memoryInfo.usagePercent > 0.90 && global.gc) {
      global.gc();
      console.log("가비지 컬렉션 강제 실행 완료");
    } else if (!global.gc && memoryInfo.usagePercent > 0.90) {
      console.log("ℹ️ 가비지 컬렉션을 사용하려면 --expose-gc 플래그로 Node.js를 시작하세요");
    }

    // 정리 후 메모리 사용량 확인
    const afterCleanup = memoryMonitor.getMemoryUsage();
    console.log(
      `메모리 정리 완료: ${afterCleanup.usagePercent * 100}% (${
        afterCleanup.heapUsed
      }MB / ${afterCleanup.heapTotal}MB)`
    );

    // 메모리 사용량이 여전히 높으면 권장사항 출력 (임계값을 90%로 상향 조정)
    if (afterCleanup.usagePercent > 0.90) {
      const recommendations =
        memoryMonitor.getOptimizationRecommendations(afterCleanup);
      console.warn("⚠️ 메모리 최적화 권장사항:", recommendations);
    }
  } catch (error) {
    console.error("❌ 메모리 정리 실패:", error);
  }
}

// 서버 시작 시 의심스러운 활동 데이터 초기화
function initializeSecurityData() {
  try {
    const {
      suspiciousActivityDetector,
    } = require("./utils/securityMiddleware");
    suspiciousActivityDetector.initializeActivityData();
    console.log("의심스러운 활동 데이터 초기화 완료");
  } catch (error) {
    console.error("의심스러운 활동 데이터 초기화 실패:", error);
  }
}

// 매일 자정에 일일 한도 초기화 (스케줄러)
function scheduleDailyReset() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const msUntilMidnight = tomorrow.getTime() - now.getTime();

  setTimeout(() => {
    initializeDailyLimits();
    // 24시간마다 반복
    setInterval(initializeDailyLimits, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);

  console.log(`다음 일일 한도 초기화: ${tomorrow.toLocaleString()}`);
}

const PORT = process.env.PORT || 3000;

// HTTP 서버 생성 (WebSocket 지원을 위해)
const http = require("http");
const WebSocket = require("ws");
const server = http.createServer(app);

// WebSocket 서버 설정
const wss = new WebSocket.Server({
  server,
  path: "/monitoring-ws",
});

// 실시간 모니터링 시스템 초기화
const {
  RealtimeMonitoringSystem,
} = require("./utils/realtimeMonitoringSystem");
const { getMemoryMonitor } = require("./utils/memoryMonitor");

const monitoringSystem = new RealtimeMonitoringSystem();
const memoryMonitor = getMemoryMonitor();

// WebSocket 연결 처리 (메모리 최적화)
wss.on("connection", (ws, req) => {
  console.log("🔌 모니터링 WebSocket 클라이언트 연결됨");

  // 클라이언트를 모니터링 시스템에 등록
  if (
    monitoringSystem &&
    typeof monitoringSystem.addWebSocketClient === "function"
  ) {
    monitoringSystem.addWebSocketClient(ws);
  }

  // 연결 상태 확인 (30초마다)
  const pingInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.ping();
    } else {
      clearInterval(pingInterval);
    }
  }, 30000);

  // 연결 해제 처리
  ws.on("close", () => {
    console.log("🔌 모니터링 WebSocket 클라이언트 연결 해제됨");
    clearInterval(pingInterval);
  });

  // 오류 처리
  ws.on("error", (error) => {
    console.error("WebSocket 오류:", error);
    clearInterval(pingInterval);
  });

  // pong 응답 처리
  ws.on("pong", () => {
    // 연결 상태 확인됨
  });
});

// 전역 모니터링 시스템 인스턴스를 앱에 추가
app.locals.monitoringSystem = monitoringSystem;

// HTTP 파서 옵션 설정
server.maxHeaderSize = 10 * 1024 * 1024; // 10MB 헤더 크기 제한
server.headersTimeout = 60000; // 60초 헤더 타임아웃
server.requestTimeout = 300000; // 5분 요청 타임아웃

server.listen(PORT, async () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중`);
  console.log(`WebSocket 모니터링: ws://localhost:${PORT}/monitoring-ws`);

  // Node.js 메모리 최적화 설정
  if (process.env.NODE_ENV === "production") {
    // 프로덕션 환경에서 메모리 제한 설정
    process.on("warning", (warning) => {
      if (warning.name === "MaxListenersExceededWarning") {
        console.warn("⚠️ MaxListenersExceededWarning:", warning.message);
      }
    });
  }

  // 서버 시작 시 초기화 작업 수행
  console.log("🚀 서버 초기화 시작...");

  // 초기 메모리 상태 확인 (프로덕션에서는 간단히만)
  if (process.env.NODE_ENV !== 'production') {
    const initialMemory = memoryMonitor.getMemoryUsage();
    console.log(
      `초기 메모리 사용량: ${initialMemory.usagePercent * 100}% (${
        initialMemory.heapUsed
      }MB / ${initialMemory.heapTotal}MB)`
    );
  }

  // 기존 사용자들의 일일 한도 업데이트 (함수 삭제됨)
  // updateDailyLimits();

  initializeDailyLimits();
  initializeSecurityData();
  initializeWeeklyLeaderboard();
  scheduleDailyReset();

  // 1시간마다 보안 데이터 정리
  setInterval(cleanupSecurityData, 60 * 60 * 1000);

  // 메모리 모니터링 시작 (5분마다 체크)
  setInterval(() => {
    memoryMonitor.checkMemoryUsage();
  }, 5 * 60 * 1000);

  // 5분마다 메모리 정리 실행 (더 자주 정리)
  setInterval(performMemoryCleanup, 5 * 60 * 1000);
  
  // 추가: 메모리 사용량이 높을 때 더 자주 체크
  setInterval(() => {
    const memoryInfo = memoryMonitor.checkMemoryUsage();
    if (memoryInfo.usagePercent > 0.8) {
      console.log(`⚠️ 높은 메모리 사용량 감지: ${memoryInfo.usagePercent * 100}% - 추가 정리 실행`);
      performMemoryCleanup();
    }
  }, 2 * 60 * 1000); // 2분마다 체크

  // 초기 메모리 정리 실행
  setTimeout(performMemoryCleanup, 5000);


  console.log("✅ 서버 초기화 완료 - 모든 스케줄러가 시작되었습니다.");
});
