const { generateText, resolveOpenAIModel } = require("./openaiClient");

class OpenAIAnalyzer {
    constructor(options = {}) {
        // Test data is returned only when explicitly requested, never for a missing API key.
        this.mockMode = options.mockMode === true;
        // 성능 최적화 설정
        this.config = {
            maxConcurrentRequests: options.maxConcurrentRequests || 2, // 동시 요청 수 감소
            requestTimeout: options.requestTimeout || 60000, // 타임아웃 증가 (60초)
            retryAttempts: options.retryAttempts || 3,
            retryDelay: options.retryDelay || 2000, // 재시도 지연 증가
            batchSize: options.batchSize || 1, // 배치 크기 감소
            rateLimitDelay: options.rateLimitDelay || 1000, // 요청 간 지연 증가
            ...options
        };

        // 요청 제한 관리
        this.activeRequests = 0;
        this.requestQueue = [];
        this.lastRequestTime = 0;

        // 성능 모니터링
        this.performanceMetrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            cacheHits: 0,
            cacheMisses: 0
        };

        // 응답 캐시
        this.responseCache = new Map();
        this.cacheTTL = 3600000; // 1시간
    }

    /**
     * 영양학 콘텐츠를 분석하고 요약 (최적화 버전)
     * @param {string} content - 원본 콘텐츠
     * @param {string} sourceType - 소스 타입 (paper, youtube, news)
     * @returns {Object} 분석 결과
     */
    async analyzeNutritionContent(content, sourceType = 'general') {
        const cacheKey = `analysis_${resolveOpenAIModel()}_${this.hashString(content + sourceType)}`;

        // 캐시 확인
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            this.performanceMetrics.cacheHits++;
            return cached;
        }
        this.performanceMetrics.cacheMisses++;

        // Mock 모드 처리
        if (this.mockMode) {
            if (process.env.LOG_LEVEL !== 'error' && process.env.OPENAI_LOG_LEVEL !== 'error') {
                console.log('🔧 Mock 모드: 영양학 콘텐츠 분석 시뮬레이션');
            }
            const mockResult = {
                summary: `[Mock] ${sourceType} 소스의 영양학 콘텐츠 분석 결과입니다.`,
                keyPoints: ['핵심 영양 정보 1', '핵심 영양 정보 2', '핵심 영양 정보 3'],
                recommendations: ['권장사항 1', '권장사항 2'],
                trustScore: 85,
                sourceType: sourceType
            };
            this.addToCache(cacheKey, mockResult);
            this.updatePerformanceMetrics(100, true);
            return mockResult;
        }

        try {
            const startTime = Date.now();

            // 요청 제한 확인
            await this.waitForRateLimit();

            const prompt = this.buildAnalysisPrompt(content, sourceType);
            const result = await this.executeWithRetry(() => generateText(prompt, {
                timeout: this.config.requestTimeout, maxOutputTokens: 2048
            }));
            const analysisText = result.text;
            const parsedResult = this.parseAnalysisResponse(analysisText);

            // 결과 캐싱
            this.addToCache(cacheKey, parsedResult);

            // 성능 메트릭 업데이트
            this.updatePerformanceMetrics(Date.now() - startTime, true);

            return parsedResult;
        } catch (error) {
            this.updatePerformanceMetrics(0, false);
            console.error('OpenAI analysis error:', error);
            throw new Error(`Content analysis failed: ${error.message}`);
        } finally {
            this.requestCompleted();
        }
    }



    /**
     * 콘텐츠에서 핵심 영양 정보 추출 (최적화 버전)
     * @param {string} content - 원본 콘텐츠
     * @returns {Object} 추출된 영양 정보
     */
    async extractNutritionFacts(content) {
        const cacheKey = `nutrition_${resolveOpenAIModel()}_${this.hashString(content)}`;

        // 캐시 확인
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            this.performanceMetrics.cacheHits++;
            return cached;
        }
        this.performanceMetrics.cacheMisses++;

        // Mock 모드 처리
        if (this.mockMode) {
            if (process.env.LOG_LEVEL !== 'error' && process.env.OPENAI_LOG_LEVEL !== 'error') {
                console.log('🔧 Mock 모드: 영양 정보 추출 시뮬레이션');
            }
            const mockNutritionFacts = {
                nutrients: ["비타민D", "칼슘", "단백질", "오메가3"],
                benefits: ["뼈 건강 개선", "면역력 강화", "심장 건강"],
                recommendations: ["하루 1000mg 칼슘 섭취 권장", "규칙적인 운동과 함께 섭취"],
                warnings: ["과다 섭취 시 부작용 가능", "의사와 상담 후 섭취 권장"],
                targetGroup: ["성인", "노인", "임산부", "운동선수"]
            };
            this.addToCache(cacheKey, mockNutritionFacts);
            this.updatePerformanceMetrics(100, true);
            return mockNutritionFacts;
        }

        try {
            const startTime = Date.now();

            // 요청 제한 확인
            await this.waitForRateLimit();

            const prompt = `
다음 콘텐츠에서 영양학적 핵심 정보를 추출하여 JSON 형태로 반환해주세요.

콘텐츠:
${content}

다음 형태의 JSON으로 응답해주세요:
{
  "nutrients": ["비타민D", "칼슘", "단백질"],
  "benefits": ["뼈 건강 개선", "면역력 강화"],
  "recommendations": ["하루 1000mg 섭취 권장"],
  "warnings": ["과다 섭취 시 부작용 가능"],
  "targetGroup": ["성인", "노인", "임산부"]
}
`;

            const result = await this.executeWithRetry(() => generateText(prompt, {
                timeout: this.config.requestTimeout, maxOutputTokens: 2048
            }));
            const responseText = result.text;

            // JSON 파싱 시도
            let parsedResult;
            try {
                parsedResult = JSON.parse(responseText);
            } catch (parseError) {
                // JSON 파싱 실패 시 기본 구조 반환
                parsedResult = {
                    nutrients: [],
                    benefits: [],
                    recommendations: [],
                    warnings: [],
                    targetGroup: []
                };
            }

            // 결과 캐싱
            this.addToCache(cacheKey, parsedResult);

            // 성능 메트릭 업데이트
            this.updatePerformanceMetrics(Date.now() - startTime, true);

            return parsedResult;
        } catch (error) {
            this.updatePerformanceMetrics(0, false);
            console.error('Nutrition facts extraction error:', error);
            throw new Error(`Nutrition facts extraction failed: ${error.message}`);
        } finally {
            this.requestCompleted();
        }
    }

    /**
     * 콘텐츠에서 태그 생성 (최적화 버전)
     * @param {string} content - 원본 콘텐츠
     * @returns {Array} 생성된 태그 배열
     */
    async generateTags(content) {
        const cacheKey = `tags_${resolveOpenAIModel()}_${this.hashString(content)}`;

        // 캐시 확인
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            this.performanceMetrics.cacheHits++;
            return cached;
        }
        this.performanceMetrics.cacheMisses++;

        // Mock 모드 처리
        if (this.mockMode) {
            if (process.env.LOG_LEVEL !== 'error' && process.env.OPENAI_LOG_LEVEL !== 'error') {
                console.log('🔧 Mock 모드: 태그 생성 시뮬레이션');
            }
            const mockTags = ['비타민D', '칼슘', '뼈건강', '면역력', '영양제', '건강식품', '운동', '건강관리'];
            this.addToCache(cacheKey, mockTags);
            this.updatePerformanceMetrics(100, true);
            return mockTags;
        }

        try {
            const startTime = Date.now();

            // 요청 제한 확인
            await this.waitForRateLimit();

            const prompt = `
다음 영양학/건강 콘텐츠를 분석하여 관련 태그를 5-8개 생성해주세요.
태그는 한국어로, 쉼표로 구분하여 나열해주세요.

콘텐츠:
${content}

예시: 비타민D, 칼슘, 뼈건강, 면역력, 영양제, 건강식품
`;

            const result = await this.executeWithRetry(() => generateText(prompt, {
                timeout: this.config.requestTimeout, maxOutputTokens: 2048
            }));
            const tagsText = result.text;

            // 쉼표로 분리하고 정리
            const tags = tagsText.split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0)
                .slice(0, 8); // 최대 8개로 제한

            // 결과 캐싱
            this.addToCache(cacheKey, tags);

            // 성능 메트릭 업데이트
            this.updatePerformanceMetrics(Date.now() - startTime, true);

            return tags;
        } catch (error) {
            this.updatePerformanceMetrics(0, false);
            console.error('Tag generation error:', error);
            return []; // 실패 시 빈 배열 반환
        } finally {
            this.requestCompleted();
        }
    }

    /**
     * 배치 처리로 여러 콘텐츠 분석
     * @param {Array} contents - 콘텐츠 배열
     * @param {string} operation - 수행할 작업 ('analysis', 'translation', 'nutrition', 'tags')
     * @returns {Array} 분석 결과 배열
     */
    async processBatch(contents, operation = 'analysis') {
        const results = [];
        const batches = this.chunkArray(contents, this.config.batchSize);

        if (process.env.LOG_LEVEL !== 'error' && process.env.OPENAI_LOG_LEVEL !== 'error') {
            console.log(`Processing ${contents.length} contents in ${batches.length} batches...`);
        }

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            if (process.env.LOG_LEVEL !== 'error' && process.env.OPENAI_LOG_LEVEL !== 'error') {
                console.log(`Processing batch ${i + 1}/${batches.length}...`);
            }

            // 배치 내 병렬 처리
            const batchPromises = batch.map(async (content, index) => {
                try {
                    let result;
                    switch (operation) {
                        case 'analysis':
                            result = await this.analyzeNutritionContent(content.content, content.sourceType);
                            break;
                        case 'nutrition':
                            result = await this.extractNutritionFacts(content.content);
                            break;
                        case 'tags':
                            result = await this.generateTags(content.content);
                            break;
                        default:
                            throw new Error(`Unknown operation: ${operation}`);
                    }

                    return {
                        success: true,
                        result,
                        originalContent: content
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message,
                        originalContent: content
                    };
                }
            });

            // 배치 실행
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // 배치 간 지연
            if (i < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, this.config.rateLimitDelay));
            }
        }

        return results;
    }

    /**
     * 재시도 메커니즘과 함께 API 호출 실행
     * @param {Function} operation - 실행할 API 호출 함수
     * @returns {Promise} API 호출 결과
     */
    async executeWithRetry(operation) {
        let lastError;

        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                if (error.status && ![429, 502, 503, 504].includes(error.status)) throw error;
                if (error.code === "AI_NOT_CONFIGURED") throw error;
                if (process.env.LOG_LEVEL !== 'error' && process.env.OPENAI_LOG_LEVEL !== 'error') {
                    console.log(`API call attempt ${attempt} failed: ${error.message}`);
                }

                if (attempt < this.config.retryAttempts) {
                    const delay = this.config.retryDelay * Math.pow(2, attempt - 1); // 지수 백오프
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    }

    /**
     * 요청 제한 확인 및 대기
     */
    async waitForRateLimit() {
        // 동시 요청 수 제한
        if (this.activeRequests >= this.config.maxConcurrentRequests) {
            await new Promise(resolve => {
                this.requestQueue.push(resolve);
            });
        } else {
            // Reserve the slot before yielding for the rate-limit delay.
            this.activeRequests++;
        }

        // 요청 간 최소 간격 확인
        const now = Date.now();
        const delay = Math.max(0, this.lastRequestTime + this.config.rateLimitDelay - now);
        this.lastRequestTime = now + delay;
        if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    /**
     * 요청 완료 시 호출
     */
    requestCompleted() {
        // Transfer the occupied slot to a waiting request, or release it.
        if (this.requestQueue.length > 0) {
            const nextRequest = this.requestQueue.shift();
            nextRequest();
        } else {
            this.activeRequests = Math.max(0, this.activeRequests - 1);
        }
    }

    /**
     * 캐시에서 데이터 조회
     * @param {string} key - 캐시 키
     * @returns {Object|null} 캐시된 데이터 또는 null
     */
    getFromCache(key) {
        const cached = this.responseCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }

        if (cached) {
            this.responseCache.delete(key);
        }

        return null;
    }

    /**
     * 캐시에 데이터 저장
     * @param {string} key - 캐시 키
     * @param {Object} data - 저장할 데이터
     */
    addToCache(key, data) {
        this.responseCache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * 캐시 정리
     */
    cleanupCache() {
        const now = Date.now();
        for (const [key, value] of this.responseCache) {
            if (now - value.timestamp > this.cacheTTL) {
                this.responseCache.delete(key);
            }
        }
    }

    /**
     * 문자열 해시 생성
     * @param {string} str - 해시할 문자열
     * @returns {string} 해시값
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32비트 정수로 변환
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * 배열을 청크로 분할
     * @param {Array} array - 분할할 배열
     * @param {number} chunkSize - 청크 크기
     * @returns {Array} 청크 배열
     */
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * 성능 메트릭 업데이트
     * @param {number} responseTime - 응답 시간 (ms)
     * @param {boolean} success - 성공 여부
     */
    updatePerformanceMetrics(responseTime, success) {
        this.performanceMetrics.totalRequests++;

        if (success) {
            this.performanceMetrics.successfulRequests++;
            // 평균 응답 시간 업데이트
            const totalTime = this.performanceMetrics.averageResponseTime * (this.performanceMetrics.successfulRequests - 1) + responseTime;
            this.performanceMetrics.averageResponseTime = totalTime / this.performanceMetrics.successfulRequests;
        } else {
            this.performanceMetrics.failedRequests++;
        }
    }

    /**
     * 성능 통계 반환
     * @returns {Object} 성능 통계
     */
    getPerformanceStats() {
        const successRate = this.performanceMetrics.totalRequests > 0
            ? (this.performanceMetrics.successfulRequests / this.performanceMetrics.totalRequests * 100).toFixed(2)
            : 0;

        const cacheHitRate = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses > 0
            ? (this.performanceMetrics.cacheHits / (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses) * 100).toFixed(2)
            : 0;

        return {
            totalRequests: this.performanceMetrics.totalRequests,
            successfulRequests: this.performanceMetrics.successfulRequests,
            failedRequests: this.performanceMetrics.failedRequests,
            successRate: `${successRate}%`,
            averageResponseTime: Math.round(this.performanceMetrics.averageResponseTime),
            cacheHitRate: `${cacheHitRate}%`,
            cacheHits: this.performanceMetrics.cacheHits,
            cacheMisses: this.performanceMetrics.cacheMisses,
            activeRequests: this.activeRequests,
            queueLength: this.requestQueue.length,
            cacheSize: this.responseCache.size
        };
    }

    /**
     * 설정 업데이트
     * @param {Object} newConfig - 새로운 설정
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        if (process.env.LOG_LEVEL !== 'error' && process.env.OPENAI_LOG_LEVEL !== 'error') {
            console.log('OpenAI Analyzer configuration updated:', this.config);
        }
    }

    /**
     * 캐시 초기화
     */
    clearCache() {
        this.responseCache.clear();
        if (process.env.LOG_LEVEL !== 'error' && process.env.OPENAI_LOG_LEVEL !== 'error') {
            console.log('OpenAI Analyzer cache cleared');
        }
    }

    /**
     * 분석 프롬프트 생성
     * @param {string} content - 원본 콘텐츠
     * @param {string} sourceType - 소스 타입
     * @returns {string} 생성된 프롬프트
     */
    buildAnalysisPrompt(content, sourceType) {
        const basePrompt = `
다음 ${this.getSourceTypeDescription(sourceType)} 콘텐츠를 분석하여 다음 정보를 JSON 형태로 제공해주세요:

콘텐츠:
${content}

다음 형태의 JSON으로 응답해주세요:
{
  "title": "콘텐츠의 핵심 제목 (한국어)",
  "summary": "3-4문장의 핵심 요약 (한국어, 일반인 이해 가능)",
  "keyPoints": ["핵심 포인트 1", "핵심 포인트 2", "핵심 포인트 3"],
  "nutritionFacts": {
    "nutrients": ["관련 영양소들"],
    "benefits": ["건강상 이점들"],
    "recommendations": ["권장사항들"]
  },
  "tags": ["태그1", "태그2", "태그3"],
  "category": "건강 카테고리 중 하나 (brain_health, cancer, cardiovascular, blood_sugar, ent, energy_fatigue, eye_health, fat_loss, gut_health, anti_aging, immunity, bone_joint, kidney_urinary, liver_health, lung_respiratory, mens_health, womens_health, mental_health, muscle_exercise, oral_health, pain, pregnancy_parenting, skin_hair, sleep)",
  "targetAudience": ["대상 독자층"],
  "credibilityIndicators": ["신뢰성 지표들"]
}
`;
        return basePrompt;
    }

    /**
     * 소스 타입 설명 반환
     * @param {string} sourceType - 소스 타입
     * @returns {string} 소스 타입 설명
     */
    getSourceTypeDescription(sourceType) {
        const descriptions = {
            'paper': '학술 논문',
            'youtube': '유튜브 영상',
            'news': '뉴스 기사',
            'general': '일반'
        };
        return descriptions[sourceType] || '일반';
    }

    /**
     * OpenAI 응답 파싱
     * @param {string} responseText - OpenAI 응답 텍스트
     * @returns {Object} 파싱된 분석 결과
     */
    parseAnalysisResponse(responseText) {
        try {
            // JSON 블록 추출 시도
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            // JSON 파싱 실패 시 기본 구조 반환
            return {
                title: "분석 결과",
                summary: responseText.substring(0, 200) + "...",
                keyPoints: [],
                nutritionFacts: {
                    nutrients: [],
                    benefits: [],
                    recommendations: []
                },
                tags: [],
                category: "general",
                targetAudience: [],
                credibilityIndicators: []
            };
        } catch (error) {
            console.error('Response parsing error:', error);
            return {
                title: "분석 오류",
                summary: "콘텐츠 분석 중 오류가 발생했습니다.",
                keyPoints: [],
                nutritionFacts: {
                    nutrients: [],
                    benefits: [],
                    recommendations: []
                },
                tags: [],
                category: "general",
                targetAudience: [],
                credibilityIndicators: []
            };
        }
    }
}

module.exports = OpenAIAnalyzer;
