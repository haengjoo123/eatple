const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { generateText, resolveOpenAIModel, isOpenAIConfigured } = require("./utils/openaiClient");
require("dotenv").config();
const path = require("path");
const session = require("express-session");
const MemoryStore = require("memorystore")(session);
const multer = require("multer");
const {
  generalLimiter,
  securityHeaders,
  validateInput,
} = require("./utils/securityMiddleware");
const cacheManager = require("./utils/cacheManager");
const ImageOptimizer = require('./utils/imageOptimizer');
const imageOptimizer = new ImageOptimizer();
const { adminAuth } = require('./utils/authMiddleware');
const { getSessionConfig, createOriginChecker } = require('./utils/httpSecurity');
const { createMonitoringWebSocket } = require('./utils/monitoringWebSocket');
// const supabaseService = require("./utils/supabaseService"); // 더 이상 사용하지 않음 (로컬 데이터 사용)
// const { updateDailyLimits } = require("./utils/userDataMigration"); // 파일 삭제됨

const app = express();

// Render terminates TLS at its proxy; trust only the nearest hop in production.
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);
app.use(securityHeaders);
app.use(generalLimiter);
const isAllowedOrigin = createOriginChecker();
app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    const error = new Error('허용되지 않은 요청 출처입니다.');
    error.status = 403;
    callback(error);
  },
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH', 'OPTIONS'],
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb', parameterLimit: 1000 }));
const sessionMiddleware = session({
  ...getSessionConfig(),
  store: new MemoryStore({
    checkPeriod: 10 * 60 * 1000,
    max: 1000,
  }),
});
app.use(sessionMiddleware);

// URL 리라이트 미들웨어: .html 확장자 제거
// 1. .html로 끝나는 URL을 확장자 없는 URL로 301 리다이렉트
app.use((req, res, next) => {
  if (['GET', 'HEAD'].includes(req.method) && req.path.endsWith('.html')) {
    const newPath = '/' + req.path.slice(0, -5).replace(/^\/+/, '');
    return res.redirect(301, newPath + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''));
  }
  next();
});

// 2. 확장자 없는 URL 요청 시 .html 파일 제공
app.use((req, res, next) => {
  // API 라우트나 정적 파일(이미지, CSS, JS)은 제외
  if (req.path.startsWith('/api/') || 
      req.path.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|webp|json|xml|txt|map)$/)) {
    return next();
  }
  
  // 확장자가 없는 경로에 대해 .html 파일 존재 여부 확인
  if (!req.path.includes('.')) {
    const fs = require('fs');
    const htmlPath = path.join(__dirname, 'public', req.path + '.html');
    
    if (fs.existsSync(htmlPath)) {
      return res.sendFile(htmlPath);
    }
  }
  
  next();
});

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

  const stats = cacheManager.getStats();
  res.json({
    success: true,
    stats,
    memoryUsage: process.memoryUsage(),
  });
});

app.post("/api/admin/cache-invalidate", (req, res) => {
  if (!req.session || !req.session.user || req.session.user.role !== "admin") {
    return res.status(403).json({ error: "관리자 권한이 필요합니다." });
  }

  const { type, key } = req.body;
  if (typeof type !== 'string' || (key !== undefined && typeof key !== 'string')) {
    return res.status(400).json({ success: false, error: '유효한 캐시 종류와 키가 필요합니다.' });
  }
  const removed = key ? cacheManager.delete(type, key) : cacheManager.invalidateCache(type);

  res.json({
    success: true,
    removed,
    message: '캐시 무효화 완료',
  });
});

app.post(
  "/api/admin/optimize-images",
  adminAuth,
  async (req, res) => {
    const { inputPath, outputPath, options } = req.body;

    try {
      const result = await imageOptimizer.optimizeAndSave(
        imageOptimizer.resolveUploadPath(inputPath),
        imageOptimizer.resolveUploadPath(outputPath),
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

  Promise.resolve()
    .then(() => imageOptimizer.getImageMetadata(imageOptimizer.resolveUploadPath(req.params.imagePath)))
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

const KAKAO_MAP_API_KEY = process.env.KAKAO_MAP_API_KEY;

// AI credentials stay on the server. Missing configuration fails AI requests explicitly.
console.log("- OPENAI_API_KEY:", isOpenAIConfigured() ? "설정됨" : "설정되지 않음");
console.log("- OPENAI_RESPONSES_MODEL:", resolveOpenAIModel());

// 서비스 이용 횟수 추적 모듈
const {
  incrementServiceUsage,
  SERVICE_TYPES,
} = require("./utils/serviceUsageTracker");

// 포인트 서비스 모듈
const PointsService = require("./utils/pointsService");

// AI 요청 큐 모듈
const aiRequestQueue = require("./utils/aiRequestQueue");

function generationResponse(result) {
  // Older cached browser scripts read candidates; keep this response alias during migration.
  return { ...result, candidates: [{ content: { parts: [{ text: result.text }] } }] };
}

// AI 큐 상태 조회 엔드포인트 (관리자용)
app.get("/api/ai-queue/status", adminAuth, (req, res) => {
  try {
    const status = aiRequestQueue.getStatus();
    const stats = aiRequestQueue.getStats();
    
    res.json({
      success: true,
      status,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// AI API 호출 (추천식단 - OpenAI GPT-6 Luna 사용)
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
    const cacheKey = `meal_plan_${resolveOpenAIModel()}_${crypto
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
      console.log("🍽️ 추천식단 생성 - OpenAI GPT-6 Luna 모델 사용");
      
      // AI 요청 큐에 추가하여 순차 처리
      const response = generationResponse(await aiRequestQueue.add(
        (signal) => generateText(prompt, { signal, timeout: 300000 }),
        { type: 'meal-plan', userId: req.session?.user?.id }
      ));

      // 응답 캐싱 (1시간)
      cacheManager.set('api', cacheKey, response, {}, 3600);

      // 로그인한 사용자인 경우 서비스 이용 횟수 증가
      if (req.session && req.session.user) {
        incrementServiceUsage(req.session.user.id, SERVICE_TYPES.MEAL_PLAN);
      }

      res.json(response);
    } catch (error) {
      console.error(
        "OpenAI API 오류:",
        error.message
      );
      res.status(error.status || 500).json({ error: error.message, code: error.code || "AI_FAILED" });
    }
  }
);

// 영양제 추천용 OpenAI API 엔드포인트
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
    const cacheKey = `supplement_${resolveOpenAIModel()}_${crypto
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
      // AI 요청 큐에 추가하여 순차 처리
      const response = generationResponse(await aiRequestQueue.add(
        (signal) => generateText(prompt, { signal, timeout: 300000 }),
        { type: 'supplement-recommendation', userId: req.session?.user?.id }
      ));

      // 응답 캐싱 (2시간)
      cacheManager.set('api', cacheKey, response, {}, 7200);

      res.json(response);
    } catch (error) {
      console.error(
        "영양제 추천 OpenAI API 오류:",
        error.message
      );
      res.status(error.status || 500).json({ error: error.message, code: error.code || "AI_FAILED" });
    }
  }
);

// AI 식재료 분석용 OpenAI API 엔드포인트 (보안 강화)
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
  const cacheKey = `ingredient_${resolveOpenAIModel()}_${require("crypto").createHash("sha256").update(JSON.stringify([ingredient, prompt])).digest("hex")}`;

  // 캐시에서 응답 확인
  const cachedResponse = cacheManager.get('api', cacheKey);
  if (cachedResponse) {
    console.log("✅ 캐시된 식재료 분석 응답 사용");
    return res.json(cachedResponse);
  }

  try {
    // AI 요청 큐에 추가하여 순차 처리
    const response = await aiRequestQueue.add(
      (signal) => generateText(prompt, { signal, timeout: 300000 }),
      { type: 'ingredient-analysis', userId: req.session?.user?.id, ingredient }
    );

    // OpenAI API 응답에서 텍스트 추출
    const generatedText = response.text;

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
      "식재료 분석 OpenAI API 오류:",
      error.message
    );
    res.status(error.status || 500).json({ error: error.message, code: error.code || "AI_FAILED" });
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
app.get("/api/env-status", adminAuth, (req, res) => {
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
app.post("/api/upload-images", adminAuth, upload.array("images", 10), async (req, res) => {
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

        // Only persist successfully decoded images; never publish arbitrary original bytes.
        await imageOptimizer.optimizeAndSave(file.buffer, filePath, {
          maxWidth: 1200,
          maxHeight: 800,
          quality: 85,
          format: 'jpeg'
        });

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
        .status(400)
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

// 주기적으로 오래된 연결과 과도하게 쌓인 캐시만 정리
function performPeriodicMaintenance() {
  try {
    if (cacheManager.getStats().totalKeys > 500) {
      cacheManager.cleanup();
    }

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

  } catch (error) {
    console.error("❌ 주기적 정리 실패:", error);
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
const server = http.createServer(app);

// WebSocket 서버 설정
const wss = createMonitoringWebSocket(server, sessionMiddleware, isAllowedOrigin);

// 실시간 모니터링 시스템 초기화
const {
  getRealtimeMonitoring,
} = require("./utils/realtimeMonitoringSystem");
const { getMemoryMonitor } = require("./utils/memoryMonitor");

const monitoringSystem = getRealtimeMonitoring();
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
server.headersTimeout = 60000; // 60초 헤더 타임아웃
server.requestTimeout = 300000; // 5분 요청 타임아웃

if (require.main === module) server.listen(PORT, async () => {
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

  const initialMemory = memoryMonitor.getMemoryUsage();
  const limitLabel = initialMemory.memoryLimit === null ? '한도 확인 불가' : `${initialMemory.memoryLimit}MB`;
  console.log(`초기 프로세스 메모리: ${initialMemory.rss}MB / ${limitLabel}`);

  // 기존 사용자들의 일일 한도 업데이트 (함수 삭제됨)
  // updateDailyLimits();

  initializeDailyLimits();
  initializeSecurityData();
  initializeWeeklyLeaderboard();
  scheduleDailyReset();

  // 1시간마다 보안 데이터 정리
  setInterval(cleanupSecurityData, 60 * 60 * 1000);

  // 실제 프로세스 RSS를 컨테이너 한도와 비교하여 2분마다 확인
  memoryMonitor.checkMemoryUsage();
  setInterval(() => memoryMonitor.checkMemoryUsage(), 2 * 60 * 1000);

  setInterval(performPeriodicMaintenance, 5 * 60 * 1000);


  console.log("✅ 서버 초기화 완료 - 모든 스케줄러가 시작되었습니다.");
});

module.exports = { app, server, wss };
