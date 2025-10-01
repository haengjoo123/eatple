/**
 * 영양 정보 API 라우터 (로컬 데이터 기반)
 * Requirements: 6.1, 6.2, 6.3, 6.4, 7.1
 */

const express = require('express');
const router = express.Router();
const SupabaseNutritionDataManager = require('../utils/supabaseNutritionDataManager');

module.exports = (nutritionDataManager, contentAggregator, aiContentProcessor, recommendationService) => {
    // Supabase 기반 데이터 매니저 초기화
    const supabaseDataManager = new SupabaseNutritionDataManager();

    // 헬퍼 함수들
    const parseFiltersAndPagination = (query) => {
        const filters = {};
        const pagination = {};
        
        if (query.page) {
            pagination.page = parseInt(query.page);
            if (pagination.page < 1) pagination.page = 1;
        }
        if (query.limit) {
            pagination.limit = parseInt(query.limit);
            if (pagination.limit < 1) pagination.limit = 20;
            if (pagination.limit > 50) pagination.limit = 50;
        }
        if (query.query || query.search) filters.search = query.query || query.search;
        if (query.category) filters.category = query.category;
        if (query.sourceType) filters.sourceType = [query.sourceType];
        if (query.tags) filters.tags = query.tags.split(',').map(tag => tag.trim());
        if (query.minTrustScore) filters.minTrustScore = parseInt(query.minTrustScore);
        if (query.dateFrom) filters.dateFrom = query.dateFrom;
        if (query.dateTo) filters.dateTo = query.dateTo;
        if (query.sortBy) filters.sortBy = query.sortBy;
        if (query.sortOrder) filters.sortOrder = query.sortOrder;
        
        return { filters, pagination };
    };

    const safeToJSON = (item) => {
        return item && typeof item.toJSON === 'function' ? item.toJSON() : item;
    };

    const parseBodyFiltersAndPagination = (body) => {
        const filters = {};
        const pagination = {};
        
        if (body.query) filters.search = body.query;
        if (body.categories && Array.isArray(body.categories) && body.categories.length > 0) {
            filters.category = body.categories;
        }
        if (body.sourceTypes && Array.isArray(body.sourceTypes) && body.sourceTypes.length > 0) {
            filters.sourceType = body.sourceTypes;
        }
        if (body.tags && Array.isArray(body.tags) && body.tags.length > 0) {
            filters.tags = body.tags;
        }
        if (body.minTrustScore !== undefined) filters.minTrustScore = parseInt(body.minTrustScore);
        if (body.maxTrustScore !== undefined) filters.maxTrustScore = parseInt(body.maxTrustScore);
        if (body.dateFrom) filters.dateFrom = body.dateFrom;
        if (body.dateTo) filters.dateTo = body.dateTo;
        if (body.sortBy) filters.sortBy = body.sortBy;
        if (body.sortOrder) filters.sortOrder = body.sortOrder;
        if (body.page) pagination.page = parseInt(body.page);
        if (body.limit) pagination.limit = parseInt(body.limit);
        
        return { filters, pagination };
    };

    /**
     * 영양 정보 목록 조회 (로컬 데이터)
     * GET /api/nutrition-info
     * Requirements: 6.1, 7.1
     */
    router.get('/', async (req, res) => {
        try {
            const { filters, pagination } = parseFiltersAndPagination(req.query);
            
            // 일반 사용자는 임시저장된 포스팅을 볼 수 없음
            filters.excludeDrafts = true;
            
            // Supabase 데이터에서 조회
            const result = await supabaseDataManager.getNutritionInfoList(filters, pagination);
            const data = result && result.data ? result.data : [];
            const paginationData = result && result.pagination ? result.pagination : {};
            
            // 응답 데이터 크기 로깅
            const responseData = {
                success: true,
                data: data.map(safeToJSON),
                pagination: paginationData,
                cached: false
            };
            
            const responseSize = JSON.stringify(responseData).length;
            console.log(`[PERFORMANCE] 영양정보 API 응답 크기: ${(responseSize / 1024 / 1024).toFixed(2)}MB (${data.length}개 항목)`);
            
            // HTTP 캐시 헤더 설정
            try {
                res.setHeader('Cache-Control', 'public, max-age=180, stale-while-revalidate=60');
            } catch (e) {
                // 헤더 설정 실패는 무시
            }
            
            res.json(responseData);
        } catch (error) {
            console.error('영양 정보 목록 조회 오류:', error);
            res.status(500).json({
                error: '영양 정보 목록을 조회하는 중 오류가 발생했습니다.',
                details: error.message
            });
        }
    });

    /**
     * 영양 정보 목록 스트리밍 조회 (점진적 로딩)
     * GET /api/nutrition-info/stream
     * Requirements: 6.1, 7.1
     */
    router.get('/stream', async (req, res) => {
        try {
            const { filters, pagination } = parseFiltersAndPagination(req.query);
            
            // 스트리밍용 limit 조정
            if (pagination.limit > 100) pagination.limit = 100;

            // SSE (Server-Sent Events) 헤더 설정
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control'
            });

            // 스트리밍 데이터 전송 함수
            const sendData = (eventType, data) => {
                res.write(`event: ${eventType}\n`);
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            };

            // 시작 이벤트 전송
            sendData('start', { message: '데이터 로딩을 시작합니다...' });

            // 배치 크기 설정 (한번에 몇개씩 전송할지)
            const batchSize = 4;
            const totalLimit = pagination.limit || 20;
            
            let processedCount = 0;
            let currentBatch = 1;

            // 일반 사용자는 임시저장된 포스팅을 볼 수 없음
            filters.excludeDrafts = true;
            
            // 먼저 해당 페이지의 전체 데이터를 조회
            const fullPageResult = await supabaseDataManager.getNutritionInfoList(filters, pagination);
            const fullPageData = fullPageResult && fullPageResult.data ? fullPageResult.data : [];
            
            // 전체 데이터를 배치로 나누어 전송
            const totalItems = fullPageData.length;
            const actualBatches = Math.max(1, Math.ceil(totalItems / batchSize));
            
            // 데이터가 없는 경우에도 진행 상황 전송
            if (totalItems === 0) {
                sendData('progress', {
                    batch: 1,
                    totalBatches: 1,
                    processed: 0,
                    total: 0,
                    message: '검색 결과가 없습니다.'
                });
            }
            
            const loopCount = totalItems > 0 ? Math.ceil(totalItems / batchSize) : 1;
            for (let i = 0; i < loopCount; i++) {
                try {
                    const startIndex = i * batchSize;
                    const endIndex = Math.min(startIndex + batchSize, totalItems);
                    const batchData = fullPageData.slice(startIndex, endIndex);

                    // 진행 상황 전송
                    sendData('progress', {
                        batch: currentBatch,
                        totalBatches: actualBatches,
                        processed: endIndex,
                        total: totalItems,
                        message: `배치 ${currentBatch}/${actualBatches} 로딩 중..`
                    });

                    processedCount = endIndex;

                    if (batchData.length > 0) {
                        // 배치 데이터 전송
                        sendData('batch', {
                            batch: currentBatch,
                            data: batchData.map(safeToJSON),
                            isLastBatch: currentBatch === actualBatches
                        });
                    }

                    // 첫번째 배치가 아닌 경우 간격을 지연을 추가하여 스트리밍 효과를 보여줌
                    if (i > 0) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }

                    currentBatch++;

                } catch (batchError) {
                    console.error(`배치 ${currentBatch} 처리 오류:`, batchError);
                    sendData('error', {
                        batch: currentBatch,
                        error: '일부 데이터를 불러오는 중 오류가 발생했습니다.',
                        details: batchError.message
                    });
                    continue; // 다음 배치 계속 처리
                }
            }

            // 완료 이벤트 전송 (페이지네이션 정보 포함)
            const paginationData = fullPageResult && fullPageResult.pagination ? fullPageResult.pagination : {
                page: pagination.page || 1,
                limit: pagination.limit || 20,
                total: 0,
                totalPages: 0
            };
            
            sendData('complete', {
                message: '모든 데이터 로딩이 완료되었습니다',
                totalProcessed: processedCount,
                pagination: paginationData
            });

            // 연결 종료
            res.end();

        } catch (error) {
            console.error('스트리밍 영양 정보 목록 조회 오류:', error);
            
            // 에러 이벤트 전송
            if (!res.headersSent) {
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                });
            }
            
            res.write(`event: error\n`);
            res.write(`data: ${JSON.stringify({
                error: '영양 정보 목록을 조회하는 중 오류가 발생했습니다.',
                details: error.message
            })}\n\n`);
            
            res.end();
        }
    });

    /**
     * 영양 정보 검색 (GET 방식)
     * GET /api/nutrition-info/search
     * Requirements: 6.3
     */
    router.get('/search', async (req, res) => {
        try {
            const { q: query } = req.query;
            
            if (!query) {
                return res.status(400).json({
                    error: '검색어가 필요합니다'
                });
            }

            const { filters, pagination } = parseFiltersAndPagination({ ...req.query, search: query });

            // 일반 사용자는 임시저장된 포스팅을 볼 수 없음
            filters.excludeDrafts = true;

            // 로컬 데이터에서 검색
            const result = await supabaseDataManager.searchNutritionInfo(query, filters);
            
            // 안전하게 데이터 처리
            const data = result && result.data ? result.data : [];
            const paginationData = result && result.pagination ? result.pagination : {};
            
            res.json({
                success: true,
                data: data.map(safeToJSON),
                pagination: paginationData,
                searchQuery: query,
                appliedFilters: filters
            });
        } catch (error) {
            console.error('영양 정보 검색 오류:', error);
            res.status(500).json({
                error: '영양 정보 검색 중 오류가 발생했습니다.',
                details: error.message
            });
        }
    });

    /**
     * 영양 정보 검색 (POST 방식, 고급 필터링)
     * POST /api/nutrition-info/search
     * Requirements: 6.3
     */
    router.post('/search', async (req, res) => {
        try {
            const { query } = req.body;
            
            if (!query) {
                return res.status(400).json({
                    error: '검색어가 필요합니다'
                });
            }

            const { filters, pagination } = parseBodyFiltersAndPagination(req.body);

            // 일반 사용자는 임시저장된 포스팅을 볼 수 없음
            filters.excludeDrafts = true;

            // 로컬 데이터에서 검색
            const result = await supabaseDataManager.searchNutritionInfo(query, filters);
            
            // 안전하게 데이터 처리
            const data = result && result.data ? result.data : [];
            const paginationData = result && result.pagination ? result.pagination : {};
            
            res.json({
                success: true,
                data: data.map(safeToJSON),
                pagination: paginationData,
                searchQuery: query,
                appliedFilters: filters
            });
        } catch (error) {
            console.error('영양 정보 고급 검색 오류:', error);
            res.status(500).json({
                error: '영양 정보 검색 중 오류가 발생했습니다.',
                details: error.message
            });
        }
    });

    /**
     * 사용자 북마크 목록 조회
     * GET /api/nutrition-info/bookmarks
     */
    router.get('/bookmarks', async (req, res) => {
        try {
            console.log('[BOOKMARK API] 북마크 목록 조회 시작');
            
            if (!req.session.user) {
                console.log('[BOOKMARK API] 로그인되지 않은 사용자');
                return res.status(401).json({
                    success: false,
                    error: '로그인이 필요합니다'
                });
            }

            const userId = req.session.user.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;

            console.log(`[BOOKMARK API] 사용자 ID: ${userId}, 페이지: ${page}, 제한: ${limit}`);

            // 사용자 선호도 가져오기 (에러 처리 강화)
            let userPrefs;
            try {
                userPrefs = await recommendationService.getUserPreferences(userId);
                console.log('[BOOKMARK API] 사용자 선호도 조회 성공:', userPrefs);
            } catch (prefError) {
                console.error('[BOOKMARK API] 사용자 선호도 조회 실패:', prefError);
                return res.status(500).json({
                    success: false,
                    error: '사용자 선호도를 조회하는 중 오류가 발생했습니다.',
                    details: prefError.message
                });
            }

            // interactions의 bookmarks 속성 안전하게 접근
            const bookmarkIds = userPrefs?.interactions?.bookmarks || [];
            console.log(`[BOOKMARK API] 북마크 ID 목록: ${JSON.stringify(bookmarkIds)}`);

            if (bookmarkIds.length === 0) {
                console.log('[BOOKMARK API] 북마크가 없음');
                return res.json({
                    success: true,
                    data: [],
                    pagination: {
                        currentPage: page,
                        totalPages: 0,
                        totalCount: 0,
                        hasNext: false,
                        hasPrev: false
                    }
                });
            }

            // 실제 조회 가능한 북마크 정보들을 한번에 처리
            const validBookmarkedInfo = [];
            
            for (const id of bookmarkIds) {
                try {
                    console.log(`[BOOKMARK API] 북마크 정보 조회 중 ${id}`);
                    const info = await supabaseDataManager.getNutritionInfoById(id);
                    if (info && info.isActive) {
                        validBookmarkedInfo.push(info.toJSON());
                        console.log(`[BOOKMARK API] 북마크 정보 추가됨 ${id}`);
                    } else {
                        console.log(`[BOOKMARK API] 비활성이거나 없는 정보: ${id}`);
                    }
                } catch (error) {
                    console.log(`[BOOKMARK API] 북마크된 정보 ID ${id}를 찾을 수 없습니다:`, error.message);
                }
            }

            const actualBookmarkedCount = validBookmarkedInfo.length;
            console.log(`[BOOKMARK API] 실제 북마크 정보 개수: ${actualBookmarkedCount}`);

            // 실제 개수로 페이지네이션 계산
            const totalCount = actualBookmarkedCount;
            const totalPages = Math.ceil(totalCount / limit);
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            
            // 페이지네이션 적용
            const paginatedBookmarkedInfo = validBookmarkedInfo.slice(startIndex, endIndex);

            console.log(`[BOOKMARK API] 페이지네이션된 북마크 정보 개수: ${paginatedBookmarkedInfo.length}`);

            res.json({
                success: true,
                data: paginatedBookmarkedInfo,
                pagination: {
                    currentPage: page,
                    totalPages: totalPages,
                    totalCount: totalCount,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            });
        } catch (error) {
            console.error('[BOOKMARK API] 북마크 목록 조회 오류:', error);
            res.status(500).json({
                success: false,
                error: '북마크 목록을 조회하는 중 오류가 발생했습니다.',
                details: error.message
            });
        }
    });

    /**
     * 사용자 북마크 개수 조회 (마이페이지용)
     * GET /api/nutrition-info/bookmarks/count
     */
    router.get('/bookmarks/count', async (req, res) => {
        try {
            console.log('[BOOKMARK COUNT API] 북마크 개수 조회 시작');
            
            if (!req.session.user) {
                console.log('[BOOKMARK COUNT API] 로그인되지 않은 사용자');
                return res.status(401).json({
                    success: false,
                    error: '로그인이 필요합니다'
                });
            }

            const userId = req.session.user.id;
            console.log(`[BOOKMARK COUNT API] 사용자 ID: ${userId}`);

            // 사용자 선호도 가져오기
            let userPrefs;
            try {
                userPrefs = await recommendationService.getUserPreferences(userId);
                console.log('[BOOKMARK COUNT API] 사용자 선호도 조회 성공');
            } catch (prefError) {
                console.error('[BOOKMARK COUNT API] 사용자 선호도 조회 실패:', prefError);
                return res.status(500).json({
                    success: false,
                    error: '사용자 선호도를 조회하는 중 오류가 발생했습니다.',
                    details: prefError.message
                });
            }

            // 북마크 ID 목록 가져오기
            const bookmarkIds = userPrefs?.interactions?.bookmarks || [];
            console.log(`[BOOKMARK COUNT API] 북마크 ID 목록: ${JSON.stringify(bookmarkIds)}`);

            if (bookmarkIds.length === 0) {
                console.log('[BOOKMARK COUNT API] 북마크가 없음');
                return res.json({
                    success: true,
                    count: 0
                });
            }

            // 실제 조회 가능한 북마크 개수를 계산
            let actualCount = 0;
            for (const id of bookmarkIds) {
                try {
                    const info = await supabaseDataManager.getNutritionInfoById(id);
                    if (info && info.isActive) {
                        actualCount++;
                    }
                } catch (error) {
                    console.log(`[BOOKMARK COUNT API] 북마크된 정보 ID ${id}를 찾을 수 없습니다:`, error.message);
                }
            }

            console.log(`[BOOKMARK COUNT API] 실제 북마크 개수: ${actualCount}`);

            res.json({
                success: true,
                count: actualCount
            });
        } catch (error) {
            console.error('[BOOKMARK COUNT API] 북마크 개수 조회 오류:', error);
            res.status(500).json({
                success: false,
                error: '북마크 개수를 조회하는 중 오류가 발생했습니다.',
                details: error.message
            });
        }
    });

    /**
     * 특정 영양 정보의 사용자 상호작용 상태 확인
     * GET /api/nutrition-info/:id/interaction-status
     */
    router.get('/:id/interaction-status', async (req, res) => {
        try {
            const nutritionInfoId = req.params.id;
            // 사용자별 데이터는 캐시 금지 (세션/쿠키에 의존)
            try {
                res.setHeader('Cache-Control', 'private, no-store');
            } catch (_) {}

            // 영양 정보 존재 여부 확인
            const nutritionInfo = await supabaseDataManager.getNutritionInfoById(nutritionInfoId);
            if (!nutritionInfo) {
                return res.status(404).json({
                    success: false,
                    error: '해당 영양 정보를 찾을 수 없습니다.'
                });
            }

            let status = {
                isBookmarked: false,
                isLiked: false,
                isViewed: false
            };

            // 로그인한 사용자인 경우에만 실제 상호작용 상태 조회
            if (req.session && req.session.user) {
                const userId = req.session.user.id;
                
                try {
                    const userPrefs = await recommendationService.getUserPreferences(userId);
                    const bookmarks = userPrefs?.interactions?.bookmarks || [];
                    const likes = userPrefs?.interactions?.likes || [];
                    
                    status = {
                        isBookmarked: bookmarks.includes(nutritionInfoId),
                        isLiked: likes.includes(nutritionInfoId),
                        isViewed: false // 조회는 별도로 관리
                    };
                    
                } catch (prefError) {
                    console.error('[INTERACTION STATUS API] 사용자 선호도 조회 실패:', prefError);
                    // 에러가 발생해도 기본값 반환
                    status = {
                        isBookmarked: false,
                        isLiked: false,
                        isViewed: false
                    };
                }
            }

            res.json({
                success: true,
                data: status
            });
        } catch (error) {
            console.error('상호작용 상태 확인 오류:', error);
            res.status(500).json({
                success: false,
                error: '상호작용 상태를 확인하는 중 오류가 발생했습니다.',
                details: error.message
            });
        }
    });

    /**
     * 영양 정보 상세 조회 스트리밍 (섹션별 점진적 로딩)
     * GET /api/nutrition-info/:id/stream
     * Requirements: 6.2
     */
    router.get('/:id/stream', async (req, res) => {
        try {
            const nutritionInfoId = req.params.id;

            // SSE (Server-Sent Events) 헤더 설정
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control'
            });

            // 스트리밍 데이터 전송 함수
            const sendData = (eventType, data) => {
                res.write(`event: ${eventType}\n`);
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            };

            // 시작 이벤트
            sendData('start', { message: '상세 정보를 불러오는 중입니다...' });

            // 전체 영양 정보 조회 (기존 방식 사용)
            const fullData = await supabaseDataManager.getNutritionInfoById(nutritionInfoId);
            
            if (!fullData) {
                throw new Error('영양 정보를 찾을 수 없습니다.');
            }

            // 1단계: 기본 정보 (제목, 요약, 메타 데이터)
            sendData('progress', { section: 'basic', message: '기본 정보 로딩 중..' });
            
            const basicInfo = {
                id: fullData.id,
                title: fullData.title,
                summary: fullData.summary,
                sourceType: fullData.sourceType,
                sourceName: fullData.sourceName,
                sourceUrl: fullData.sourceUrl,
                publishedDate: fullData.publishedDate,
                collectedDate: fullData.collectedDate,
                trustScore: fullData.trustScore,
                viewCount: fullData.viewCount,
                thumbnailUrl: fullData.thumbnailUrl,
                imageUrl: fullData.imageUrl,
                category: fullData.category,
                tags: fullData.tags
            };

            sendData('section', {
                type: 'basic',
                data: basicInfo,
                message: '기본 정보 로딩 완료'
            });

            await new Promise(resolve => setTimeout(resolve, 200));

            // 2단계: 본문 내용
            sendData('progress', { section: 'content', message: '본문 내용 로딩 중..' });
            
            const contentInfo = {
                content: fullData.content,
                originalContent: fullData.originalContent
            };

            sendData('section', {
                type: 'content',
                data: contentInfo,
                message: '본문 내용 로딩 완료'
            });

            await new Promise(resolve => setTimeout(resolve, 150));

            // 3단계: 관련 상품 (배치 처리)
            if (fullData.related_products && fullData.related_products.length > 0) {
                sendData('progress', { section: 'products', message: '관련 상품 로딩 중..' });
                
                // 관련 상품을 2개씩 배치로 나누어 전송
                const batchSize = 2;
                const products = fullData.related_products;
                const batches = [];
                
                for (let i = 0; i < products.length; i += batchSize) {
                    batches.push(products.slice(i, i + batchSize));
                }

                for (let i = 0; i < batches.length; i++) {
                    sendData('section', {
                        type: 'products_batch',
                        data: batches[i],
                        batch: i + 1,
                        totalBatches: batches.length,
                        isLastBatch: i === batches.length - 1,
                        message: `관련 상품 배치 ${i + 1}/${batches.length} 로딩 완료`
                    });

                    // 배치 간 지연
                    if (i < batches.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 250));
                    }
                }
            } else {
                sendData('section', {
                    type: 'products_empty',
                    data: [],
                    message: '관련 상품이 없습니다'
                });
            }

            // 완료 이벤트
            sendData('complete', {
                message: '모든 정보 로딩이 완료되었습니다',
                nutritionInfoId: nutritionInfoId
            });

            // 연결 종료
            res.end();

        } catch (error) {
            console.error('스트리밍 영양 정보 상세 조회 오류:', error);
            
            // 에러 이벤트 전송
            if (!res.headersSent) {
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                });
            }
            
            res.write(`event: error\n`);
            res.write(`data: ${JSON.stringify({
                error: '영양 정보를 조회하는 중 오류가 발생했습니다.',
                details: error.message
            })}\n\n`);
            
            res.end();
        }
    });

    /**
     * 특정 영양 정보 조회 (로컬 데이터)
     * GET /api/nutrition-info/:id
     * Requirements: 6.2, 6.4
     */
    router.get('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            // 로컬 데이터에서 조회
            const nutritionInfo = await supabaseDataManager.getNutritionInfoById(id);
            
            if (!nutritionInfo) {
                console.error(`[ERROR] 영양정보 ${id}를 로컬에서 찾을 수 없음`);
                return res.status(404).json({
                    success: false,
                    error: '해당 영양 정보를 찾을 수 없습니다.'
                });
            }

            // 조회수 증가
            try {
                await supabaseDataManager.incrementViewCount(id);
            } catch (viewError) {
                console.error('조회수 증가 오류:', viewError);
            }

            // 안전하게 toJSON 처리
            const responseData = safeToJSON(nutritionInfo);

            // 관련 정보 추천 기능 통합 (Requirements: 6.4)
            let recommendedItems = [];
            try {
                if (recommendationService && typeof recommendationService.getRecommendedNutritionInfo === 'function') {
                    // 로그인한 사용자인 경우 개인화 추천
                    if (req.session && req.session.user) {
                        recommendedItems = await recommendationService.getRecommendedNutritionInfo(
                            req.session.user.id, 
                            5
                        );
                    } else {
                        // 비로그인 사용자는 카테고리/태그 기반 추천
                        const categoryFilter = { category: responseData.category };
                        const categoryResult = await supabaseDataManager.getNutritionInfoList(
                            categoryFilter, 
                            { limit: 3 }
                        );
                        
                        const tagFilter = responseData.tags && responseData.tags.length > 0 ? 
                            { tags: responseData.tags.slice(0, 2) } : {};
                        const tagResult = await supabaseDataManager.getNutritionInfoList(
                            tagFilter, 
                            { limit: 2 }
                        );
                        
                        // 현재 것을 제외하고 중복 제거
                        const combined = [...(categoryResult.data || []), ...(tagResult.data || [])];
                        const unique = combined.filter((item, index, self) => 
                            item.id !== id && index === self.findIndex(t => t.id === item.id)
                        );
                        
                        recommendedItems = unique.slice(0, 5);
                    }
                }
            } catch (recommendError) {
                console.error('추천 기능 오류:', recommendError);
            }

            // HTTP 캐시 헤더 설정
            try {
                const etag = `W/"ni-${responseData.id}-${new Date(responseData.collectedDate || responseData.publishedDate || 0).getTime()}-${responseData.viewCount || 0}"`;
                res.setHeader('ETag', etag);
                res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
                
                const ifNoneMatch = req.headers['if-none-match'];
                if (ifNoneMatch && ifNoneMatch === etag) {
                    return res.status(304).end();
                }
            } catch (e) {
                // 헤더 설정 실패는 무시
            }

            res.json({
                success: true,
                data: responseData,
                recommended: recommendedItems.map(item => 
                    safeToJSON(item)
                ),
                cached: false
            });
        } catch (error) {
            console.error('영양 정보 조회 오류:', error);
            res.status(500).json({
                error: '영양 정보를 조회하는 중 오류가 발생했습니다.',
                details: error.message
            });
        }
    });

    /**
     * 카테고리 목록 조회 (로컬 데이터)
     * GET /api/nutrition-info/meta/categories
     * Requirements: 6.1, 6.3
     */
    router.get('/meta/categories', async (req, res) => {
        try {
            // 로컬 데이터에서 카테고리 조회
            const categories = await supabaseDataManager.getCategories();

            res.json({
                success: true,
                data: categories
            });
        } catch (error) {
            console.error('카테고리 목록 조회 오류:', error);
            res.status(500).json({
                success: false,
                error: '카테고리 목록을 조회하는 중 오류가 발생했습니다.',
                details: error.message
            });
        }
    });

    /**
     * 북마크 추가/제거
     * POST /api/nutrition-info/bookmark
     */
    router.post('/bookmark', async (req, res) => {
        try {
            if (!req.session.user) {
                return res.status(401).json({
                    success: false,
                    error: '로그인이 필요합니다'
                });
            }

            const userId = req.session.user.id;
            const { nutritionInfoId, action } = req.body;

            if (!nutritionInfoId || !action) {
                return res.status(400).json({
                    success: false,
                    error: 'nutritionInfoId와 action이 필요합니다'
                });
            }

            if (!['add', 'remove'].includes(action)) {
                return res.status(400).json({
                    success: false,
                    error: 'action은 add 또는 remove여야 합니다'
                });
            }

            const nutritionInfo = await supabaseDataManager.getNutritionInfoById(nutritionInfoId);
            if (!nutritionInfo) {
                return res.status(404).json({
                    success: false,
                    error: '해당 영양 정보를 찾을 수 없습니다.'
                });
            }

            let result;
            if (action === 'add') {
                result = await recommendationService.recordUserInteraction(userId, nutritionInfoId, 'bookmarks');
                await supabaseDataManager.updateNutritionInfo(nutritionInfoId, {
                    bookmarkCount: (nutritionInfo.bookmarkCount || 0) + 1
                });
            } else {
                result = await recommendationService.removeUserInteraction(userId, nutritionInfoId, 'bookmarks');
                await supabaseDataManager.updateNutritionInfo(nutritionInfoId, {
                    bookmarkCount: Math.max(0, (nutritionInfo.bookmarkCount || 0) - 1)
                });
            }

            res.json({
                success: true,
                data: result,
                action: action
            });
        } catch (error) {
            console.error('북마크 처리 오류:', error);
            res.status(500).json({
                success: false,
                error: '북마크를 처리하는 중 오류가 발생했습니다.',
                details: error.message
            });
        }
    });

    /**
     * 좋아요 추가/제거
     * POST /api/nutrition-info/like
     */
    router.post('/like', async (req, res) => {
        try {
            if (!req.session.user) {
                return res.status(401).json({
                    success: false,
                    error: '로그인이 필요합니다'
                });
            }

            const userId = req.session.user.id;
            const { nutritionInfoId, action } = req.body;

            if (!nutritionInfoId || !action) {
                return res.status(400).json({
                    success: false,
                    error: 'nutritionInfoId와 action이 필요합니다'
                });
            }

            if (!['add', 'remove'].includes(action)) {
                return res.status(400).json({
                    success: false,
                    error: 'action은 add 또는 remove여야 합니다'
                });
            }

            const nutritionInfo = await supabaseDataManager.getNutritionInfoById(nutritionInfoId);
            if (!nutritionInfo) {
                return res.status(404).json({
                    success: false,
                    error: '해당 영양 정보를 찾을 수 없습니다.'
                });
            }

            let result;
            if (action === 'add') {
                result = await recommendationService.recordUserInteraction(userId, nutritionInfoId, 'likes');
                await supabaseDataManager.updateNutritionInfo(nutritionInfoId, {
                    likeCount: (nutritionInfo.likeCount || 0) + 1
                });
            } else {
                result = await recommendationService.removeUserInteraction(userId, nutritionInfoId, 'likes');
                await supabaseDataManager.updateNutritionInfo(nutritionInfoId, {
                    likeCount: Math.max(0, (nutritionInfo.likeCount || 0) - 1)
                });
            }

            res.json({
                success: true,
                data: result,
                action: action
            });
        } catch (error) {
            console.error('좋아요 처리 오류:', error);
            res.status(500).json({
                success: false,
                error: '좋아요를 처리하는 중 오류가 발생했습니다.',
                details: error.message
            });
        }
    });

    return router;
};
