/**
 * 영양 정보 API 라우터 (Supabase 통합)
 * Requirements: 6.1, 6.2, 6.3, 6.4, 7.1
 */

const express = require('express');
const router = express.Router();
const NutritionInfo = require('../models/NutritionInfo');
const SupabaseNutritionDataManager = require('../utils/supabaseNutritionDataManager');

module.exports = (nutritionDataManager, contentAggregator, aiContentProcessor, recommendationService) => {
    // Supabase 기반 데이터 매니저 초기화
    const supabaseDataManager = new SupabaseNutritionDataManager();
/**
 * 영양 정보 목록 조회 (Supabase 통합)
 * GET /api/nutrition-info
 * Requirements: 6.1, 7.1
 */
router.get('/', async (req, res) => {
        console.log('[ROUTE] GET /api/nutrition-info (Supabase 통합)', { query: req.query });
    try {
        const filters = {};
        const pagination = {};
        if (req.query.page) {
            pagination.page = parseInt(req.query.page);
            if (pagination.page < 1) pagination.page = 1;
        }
        if (req.query.limit) {
            pagination.limit = parseInt(req.query.limit);
            if (pagination.limit < 1) pagination.limit = 20;
            if (pagination.limit > 100) pagination.limit = 100;
        }
        if (req.query.query) filters.search = req.query.query;
        if (req.query.category) filters.category = req.query.category;
        if (req.query.sourceType) {
            // 프론트엔드 필터와 데이터 매핑
            const sourceTypeMapping = {
                'paper': ['pubmed', 'paper'],
                'youtube': ['youtube'],
                'news': ['news'],
                'manual': ['manual']
            };
            const mappedSourceTypes = sourceTypeMapping[req.query.sourceType] || [req.query.sourceType];
            filters.sourceType = mappedSourceTypes;
        }
        if (req.query.tags) filters.tags = req.query.tags.split(',').map(tag => tag.trim());
        if (req.query.minTrustScore) filters.minTrustScore = parseInt(req.query.minTrustScore);
        if (req.query.dateFrom) filters.dateFrom = req.query.dateFrom;
        if (req.query.dateTo) filters.dateTo = req.query.dateTo;
        if (req.query.sortBy) filters.sortBy = req.query.sortBy;
        if (req.query.sortOrder) filters.sortOrder = req.query.sortOrder;
        
        // Supabase 통합 데이터 매니저 사용
        const result = await supabaseDataManager.getNutritionInfoList(filters, pagination);
        const data = result && result.data ? result.data : [];
        const paginationData = result && result.pagination ? result.pagination : {};
        
        res.json({
            success: true,
            data: data.map(item => item && typeof item.toJSON === 'function' ? item.toJSON() : item),
            pagination: paginationData
        });
    } catch (error) {
        console.error('영양 정보 목록 조회 오류:', error);
        res.status(500).json({
            error: '영양 정보 목록을 조회하는 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

    /**
     * 영양 정보 목록 조회 (페이지네이션, Supabase 통합)
     * GET /api/nutrition-info/list
     * Requirements: 6.1, 7.1
     */
    router.get('/list', async (req, res) => {
        console.log('[ROUTE] GET /api/nutrition-info/list (Supabase 통합)', { query: req.query });
        try {
            const filters = {};
            const pagination = {};
            if (req.query.page) {
                pagination.page = parseInt(req.query.page);
                if (pagination.page < 1) pagination.page = 1;
            }
            if (req.query.limit) {
                pagination.limit = parseInt(req.query.limit);
                if (pagination.limit < 1) pagination.limit = 20;
                if (pagination.limit > 100) pagination.limit = 100;
            }
            if (req.query.search) filters.search = req.query.search;
            if (req.query.category) filters.category = req.query.category;
            if (req.query.sourceType) {
                // 수동 포스팅 포함 매핑
                const sourceTypeMapping = {
                    'paper': ['pubmed', 'paper'],
                    'youtube': ['youtube'],
                    'news': ['news'],
                    'manual': ['manual']
                };
                const mappedSourceTypes = sourceTypeMapping[req.query.sourceType] || [req.query.sourceType];
                filters.sourceType = mappedSourceTypes;
            }
            
            // Supabase 통합 데이터 매니저 사용
            const result = await supabaseDataManager.getNutritionInfoList(filters, pagination);
            const data = result && result.data ? result.data : [];
            const paginationData = result && result.pagination ? result.pagination : {};
            
        res.json({
                success: true,
                data: data.map(item => item && typeof item.toJSON === 'function' ? item.toJSON() : item),
                pagination: paginationData
        });
    } catch (error) {
        console.error('영양 정보 목록 조회 오료:', error);
        res.status(500).json({
            error: '영양 정보 목록을 조회하는 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

    /**
     * 영양 정보 검색 (Supabase 전문 검색)
     * GET /api/nutrition-info/search
     * Requirements: 6.3
     */
    router.get('/search', async (req, res) => {
        console.log('[ROUTE] GET /api/nutrition-info/search (Supabase 전문 검색)', { query: req.query });
        try {
            const { q: query, category, sourceType, minTrustScore, tags, page, limit } = req.query;
            
            if (!query) {
                return res.status(400).json({
                    error: '검색어가 필요합니다.'
                });
            }

            const filters = { search: query };
            const pagination = {};
            
            if (category) filters.category = category;
            if (sourceType) {
                // 프론트엔드 필터와 데이터 매핑 (수동 포스팅 포함)
                const sourceTypeMapping = {
                    'paper': ['pubmed', 'paper'],
                    'youtube': ['youtube'],
                    'news': ['news'],
                    'manual': ['manual']
                };
                const mappedSourceTypes = sourceTypeMapping[sourceType] || [sourceType];
                filters.sourceType = mappedSourceTypes;
            }
            if (minTrustScore) filters.minTrustScore = parseInt(minTrustScore);
            if (tags) filters.tags = tags.split(',').map(tag => tag.trim());
            if (page) pagination.page = parseInt(page);
            if (limit) pagination.limit = parseInt(limit);

            // Supabase 통합 검색 사용
            const result = await supabaseDataManager.searchNutritionInfo(query, filters);
            
            // 안전하게 데이터 처리
            const data = result && result.data ? result.data : [];
            const paginationData = result && result.pagination ? result.pagination : {};
            
            res.json({
                success: true,
                data: data.map(item => item && typeof item.toJSON === 'function' ? item.toJSON() : item),
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
        console.log('[ROUTE] POST /api/nutrition-info/search (Supabase 고급 검색)', { body: req.body });
        try {
            const { 
                query, 
                categories, 
                sourceTypes, 
                tags, 
                minTrustScore, 
                maxTrustScore,
                dateFrom, 
                dateTo,
                sortBy,
                sortOrder,
                page, 
                limit 
            } = req.body;
            
            if (!query) {
                return res.status(400).json({
                    error: '검색어가 필요합니다.'
                });
            }

            const filters = { search: query };
            const pagination = {};
            
            // 고급 필터링 옵션
            if (categories && Array.isArray(categories) && categories.length > 0) {
                filters.category = categories; // 다중 카테고리 지원
            }
            if (sourceTypes && Array.isArray(sourceTypes) && sourceTypes.length > 0) {
                // 수동 포스팅 포함한 소스 타입 매핑
                const allSourceTypes = [];
                sourceTypes.forEach(type => {
                    const sourceTypeMapping = {
                        'paper': ['pubmed', 'paper'],
                        'youtube': ['youtube'],
                        'news': ['news'],
                        'manual': ['manual']
                    };
                    const mapped = sourceTypeMapping[type] || [type];
                    allSourceTypes.push(...mapped);
                });
                filters.sourceType = [...new Set(allSourceTypes)]; // 중복 제거
            }
            if (tags && Array.isArray(tags) && tags.length > 0) {
                filters.tags = tags;
            }
            if (minTrustScore !== undefined) filters.minTrustScore = parseInt(minTrustScore);
            if (maxTrustScore !== undefined) filters.maxTrustScore = parseInt(maxTrustScore);
            if (dateFrom) filters.dateFrom = dateFrom;
            if (dateTo) filters.dateTo = dateTo;
            if (sortBy) filters.sortBy = sortBy;
            if (sortOrder) filters.sortOrder = sortOrder;
            if (page) pagination.page = parseInt(page);
            if (limit) pagination.limit = parseInt(limit);

            // Supabase 통합 검색 사용
            const result = await supabaseDataManager.searchNutritionInfo(query, filters);
            
            // 안전하게 데이터 처리
            const data = result && result.data ? result.data : [];
            const paginationData = result && result.pagination ? result.pagination : {};
            
            res.json({
                success: true,
                data: data.map(item => item && typeof item.toJSON === 'function' ? item.toJSON() : item),
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
     * 카테고리별 영양 정보 조회
     * GET /api/nutrition-info/category/:category
     */
    router.get('/category/:category', async (req, res) => {
        console.log('[ROUTE] GET /api/nutrition-info/category/:category', { params: req.params, query: req.query });
        try {
            const { category } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;

            const result = await nutritionDataManager.getNutritionInfoList({ category }, { page, limit });
            
            // 안전하게 데이터 처리
            const data = result && result.data ? result.data : [];
            const pagination = result && result.pagination ? result.pagination : {};
            
            res.json({
                success: true,
                data: data.map(item => item && typeof item.toJSON === 'function' ? item.toJSON() : item),
                pagination: pagination
            });
        } catch (error) {
            console.error('카테고리별 영양 정보 조회 오류:', error);
            res.status(500).json({
                error: '카테고리별 영양 정보를 조회하는 중 오류가 발생했습니다.',
                details: error.message
            });
        }
    });

    /**
     * 트렌딩 토픽 조회
     * GET /api/nutrition-info/trending/topics
     */
    router.get('/trending/topics', async (req, res) => {
        console.log('[ROUTE] GET /api/nutrition-info/trending/topics');
        try {
            // 임시로 기본 트렌딩 토픽 반환
            const trendingTopics = {
                pubmed: ['비타민D', '오메가3'],
                youtube: ['다이어트', '운동'],
                news: ['건강', '영양'],
                combined: [
                    { topic: '비타민D', count: 2 },
                    { topic: '다이어트', count: 1 }
                ]
            };
            res.json(trendingTopics);
        } catch (error) {
            console.error('트렌딩 토픽 조회 오류:', error);
            res.status(500).json({
                error: '트렌딩 토픽을 조회하는 중 오류가 발생했습니다.',
                details: error.message
            });
        }
    });

    /**
     * 통계 정보 조회
     * GET /api/nutrition-info/statistics
     */
    router.get('/statistics', async (req, res) => {
        console.log('[ROUTE] GET /api/nutrition-info/statistics');
        try {
            const statistics = await nutritionDataManager.getStatistics();
            
            // 통계 데이터가 없으면 기본값 반환
            if (!statistics) {
                return res.json({
                    totalItems: 0,
                    categoryDistribution: {},
                    averageTrustScore: 0,
                    sourceTypeDistribution: {}
                });
            }
            
            res.json(statistics);
        } catch (error) {
            console.error('통계 정보 조회 오류:', error);
            res.status(500).json({
                error: '통계 정보를 조회하는 중 오류가 발생했습니다.',
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
                    error: '로그인이 필요합니다.'
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

            // interactions와 bookmarks 속성 안전하게 접근
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

            // 실제 조회 가능한 북마크 정보를 한 번에 처리
            const validBookmarkedInfo = [];
            
            for (const id of bookmarkIds) {
                try {
                    console.log(`[BOOKMARK API] 북마크 정보 조회 중: ${id}`);
                    const info = await supabaseDataManager.getNutritionInfoById(id);
                    if (info && info.isActive) {
                        validBookmarkedInfo.push(info.toJSON());
                        console.log(`[BOOKMARK API] 북마크 정보 추가됨: ${id}`);
                    } else {
                        console.log(`[BOOKMARK API] 비활성 또는 없는 정보: ${id}`);
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
                    error: '로그인이 필요합니다.'
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

            // 실제 조회 가능한 북마크 개수만 계산
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
                console.log(`[INTERACTION STATUS API] 사용자 ${userId}의 영양정보 ${nutritionInfoId} 상호작용 상태 조회`);
                
                try {
                    const userPrefs = await recommendationService.getUserPreferences(userId);
                    const bookmarks = userPrefs?.interactions?.bookmarks || [];
                    const likes = userPrefs?.interactions?.likes || [];
                    
                    status = {
                        isBookmarked: bookmarks.includes(nutritionInfoId),
                        isLiked: likes.includes(nutritionInfoId),
                        isViewed: false // 조회수는 별도로 관리
                    };
                    
                    console.log(`[INTERACTION STATUS API] 조회 결과: ${JSON.stringify(status)}`);
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
     * 특정 영양 정보 조회 (Supabase 통합 + 추천 기능)
     * GET /api/nutrition-info/:id
     * Requirements: 6.2, 6.4
     */
    router.get('/:id', async (req, res) => {
        console.log('[ROUTE] GET /api/nutrition-info/:id (Supabase 통합)', { params: req.params });
        try {
            const { id } = req.params;
            
            // Supabase 통합 데이터 매니저 사용
            const nutritionInfo = await supabaseDataManager.getNutritionInfoById(id);
            
            if (!nutritionInfo) {
                return res.status(404).json({
                    error: '해당 영양 정보를 찾을 수 없습니다.'
                });
            }

            // 조회수 증가
            try {
                await supabaseDataManager.incrementViewCount(id);
            } catch (viewError) {
                console.error('조회수 증가 오류:', viewError);
                // 조회수 증가 실패해도 메인 응답은 계속 진행
            }

            // 안전하게 toJSON 처리
            const responseData = nutritionInfo && typeof nutritionInfo.toJSON === 'function' 
                ? nutritionInfo.toJSON() 
                : nutritionInfo;

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
                        
                        // 현재 항목 제외하고 중복 제거
                        const combined = [...(categoryResult.data || []), ...(tagResult.data || [])];
                        const unique = combined.filter((item, index, self) => 
                            item.id !== id && index === self.findIndex(t => t.id === item.id)
                        );
                        
                        recommendedItems = unique.slice(0, 5);
                    }
                }
            } catch (recommendError) {
                console.error('추천 기능 오류:', recommendError);
                // 추천 실패해도 메인 응답은 계속 진행
            }

            res.json({
                success: true,
                data: responseData,
                recommended: recommendedItems.map(item => 
                    item && typeof item.toJSON === 'function' ? item.toJSON() : item
                )
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
     * 새로운 영양 정보 생성
     * POST /api/nutrition-info
     */
    router.post('/', async (req, res) => {
        console.log('[ROUTE] POST /api/nutrition-info', { body: req.body });
        try {
            // 권한 체크 (테스트를 위해 임시 주석)
            // if (!req.session.user || req.session.user.role !== 'admin') {
            //     return res.status(403).json({
            //         error: '관리자 권한이 필요합니다.'
            //     });
            // }

            const { title, content, category, sourceType, sourceUrl, trustScore } = req.body;
            
            // 필수 필드 검증
            if (!title || !content) {
                return res.status(400).json({
                    error: '제목과 내용은 필수입니다.'
                });
            }

            // NutritionInfo 인스턴스 생성
            const nutritionInfo = new NutritionInfo({
                title,
                content,
                category: category || 'general',
                sourceType: sourceType || 'manual',
                sourceUrl,
                trustScore: trustScore || 80
            });

            const savedInfo = await nutritionDataManager.saveNutritionInfo(nutritionInfo);

            // 안전하게 toJSON 처리
            const responseData = savedInfo && typeof savedInfo.toJSON === 'function' 
                ? savedInfo.toJSON() 
                : (savedInfo || { id: 'temp-id', title, content });

            res.status(201).json(responseData);
        } catch (error) {
            console.error('영양 정보 생성 오류:', error);
            res.status(500).json({
                error: '영양 정보를 생성하는 중 오류가 발생했습니다.',
                details: error.message
            });
        }
    });

    /**
     * 영양 정보 업데이트
     * PUT /api/nutrition-info/:id
     */
    router.put('/:id', async (req, res) => {
        console.log('[ROUTE] PUT /api/nutrition-info/:id', { params: req.params, body: req.body });
        try {
            // 권한 체크 (테스트를 위해 임시 주석)
            // if (!req.session.user || req.session.user.role !== 'admin') {
            //     return res.status(403).json({
            //         error: '관리자 권한이 필요합니다.'
            //     });
            // }

            const { id } = req.params;
            const updateData = req.body;

            const updatedInfo = await nutritionDataManager.updateNutritionInfo(id, updateData);
            
            if (!updatedInfo) {
                return res.status(404).json({
                    error: '해당 영양 정보를 찾을 수 없습니다.'
                });
            }

            // 안전하게 toJSON 처리
            const responseData = updatedInfo && typeof updatedInfo.toJSON === 'function' 
                ? updatedInfo.toJSON() 
                : updatedInfo;

            res.json(responseData);
        } catch (error) {
            console.error('영양 정보 업데이트 오류:', error);
            res.status(500).json({
                error: '영양 정보를 업데이트하는 중 오류가 발생했습니다.',
                details: error.message
            });
        }
    });

    /**
     * 영양 정보 삭제
     * DELETE /api/nutrition-info/:id
     */
    router.delete('/:id', async (req, res) => {
        console.log('[ROUTE] DELETE /api/nutrition-info/:id', { params: req.params });
        try {
            // 권한 체크 (테스트를 위해 임시 주석)
            // if (!req.session.user || req.session.user.role !== 'admin') {
            //     return res.status(403).json({
            //         error: '관리자 권한이 필요합니다.'
            //     });
            // }

            const { id } = req.params;
            const deleted = await nutritionDataManager.deleteNutritionInfo(id);
            
            if (!deleted) {
                return res.status(404).json({
                    error: '해당 영양 정보를 찾을 수 없습니다.'
                });
            }

            res.json({
                message: '영양 정보가 성공적으로 삭제되었습니다.'
            });
        } catch (error) {
            console.error('영양 정보 삭제 오류:', error);
            res.status(500).json({
                error: '영양 정보를 삭제하는 중 오류가 발생했습니다.',
                details: error.message
            });
        }
    });

    /**
     * 트렌딩 토픽 조회
     * GET /api/nutrition-info/trending/topics
     */
    router.get('/trending/topics', async (req, res) => {
        console.log('[ROUTE] GET /api/nutrition-info/trending/topics');
        try {
            // 임시로 기본 트렌딩 토픽 반환
            const trendingTopics = {
                pubmed: ['비타민D', '오메가3'],
                youtube: ['다이어트', '운동'],
                news: ['건강', '영양'],
                combined: [
                    { topic: '비타민D', count: 2 },
                    { topic: '다이어트', count: 1 }
                ]
            };
            res.json(trendingTopics);
        } catch (error) {
            console.error('트렌딩 토픽 조회 오류:', error);
            res.status(500).json({
                error: '트렌딩 토픽을 조회하는 중 오류가 발생했습니다.',
                details: error.message
            });
        }
    });

    /**
     * 통계 정보 조회
     * GET /api/nutrition-info/statistics
     */
    router.get('/statistics', async (req, res) => {
        console.log('[ROUTE] GET /api/nutrition-info/statistics');
        try {
            const statistics = await nutritionDataManager.getStatistics();
            
            // 통계 데이터가 없으면 기본값 반환
            if (!statistics) {
                return res.json({
                    totalItems: 0,
                    categoryDistribution: {},
                    averageTrustScore: 0,
                    sourceTypeDistribution: {}
                });
            }
            
            res.json(statistics);
        } catch (error) {
            console.error('통계 정보 조회 오류:', error);
            res.status(500).json({
                error: '통계 정보를 조회하는 중 오류가 발생했습니다.',
                details: error.message
            });
        }
    });

    /**
     * 콘텐츠 수집
     * POST /api/nutrition-info/collect
     */
    router.post('/collect', async (req, res) => {
        try {
            // 권한 체크 (테스트를 위해 임시 주석)
            // if (!req.session.user || req.session.user.role !== 'admin') {
            //     return res.status(403).json({
            //         error: '관리자 권한이 필요합니다.'
            //     });
            // }

            // 콘텐츠 수집
            const collectedContent = await contentAggregator.collectAllContent();
            
            // 수집된 콘텐츠를 배열로 변환
            const allContents = [
                ...collectedContent.papers,
                ...collectedContent.videos,
                ...collectedContent.articles
            ];
            
            // 수집된 콘텐츠 처리
            const processedContent = await aiContentProcessor.processBatch(allContents);

            res.json({
                message: '콘텐츠 수집이 완료되었습니다.',
                summary: {
                    collected: collectedContent,
                    processed: processedContent
                }
            });
        } catch (error) {
            console.error('콘텐츠 수집 오류:', error);
            res.status(500).json({
                error: '콘텐츠 수집 중 오류가 발생했습니다.',
                details: error.message
            });
        }
    });

/**
 * 사용자 좋아요 목록 조회
 * GET /api/nutrition-info/likes
 */
router.get('/likes', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                error: '로그인이 필요합니다.'
            });
        }

        const userId = req.session.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const userPrefs = await recommendationService.getUserPreferences(userId);
        const likeIds = userPrefs.interactions.likes;

        const totalCount = likeIds.length;
        const totalPages = Math.ceil(totalCount / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedIds = likeIds.slice(startIndex, endIndex);

        const likedInfo = [];
        for (const id of paginatedIds) {
            try {
                const info = await nutritionDataManager.getNutritionInfoById(id);
                if (info && info.isActive) {
                    likedInfo.push(info.toJSON());
                }
            } catch (error) {
                console.log(`좋아요한 정보 ID ${id}를 찾을 수 없습니다:`, error.message);
            }
        }

        res.json({
            success: true,
            data: likedInfo,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalCount: totalCount,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('좋아요 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '좋아요 목록을 조회하는 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 사용자 상호작용 통계 조회
 * GET /api/nutrition-info/user-stats
 */
router.get('/user-stats', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                error: '로그인이 필요합니다.'
            });
        }

        const userId = req.session.user.id;
        const userPrefs = await recommendationService.getUserPreferences(userId);
        const interactions = userPrefs.interactions;

        const stats = {
            bookmarks: {
                total: interactions.bookmarks.length,
                recent: interactions.bookmarks.slice(-10)
            },
            likes: {
                total: interactions.likes.length,
                recent: interactions.likes.slice(-10)
            },
            views: {
                total: interactions.views.length,
                recent: interactions.views.slice(-20)
            }
        };

        const categoryInterest = {};
        const allInteractedIds = [...interactions.bookmarks, ...interactions.likes];
        
        for (const id of allInteractedIds) {
            try {
                const info = await nutritionDataManager.getNutritionInfoById(id);
                if (info) {
                    categoryInterest[info.category] = (categoryInterest[info.category] || 0) + 1;
                }
            } catch (error) {
                console.log(`정보 ID ${id}를 찾을 수 없습니다:`, error.message);
            }
        }

        stats.categoryInterest = categoryInterest;

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('사용자 통계 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '사용자 통계를 조회하는 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 카테고리 목록 조회 (Supabase 통합)
 * GET /api/nutrition-info/meta/categories
 * Requirements: 6.1, 6.3
 */
router.get('/meta/categories', async (req, res) => {
    try {
        // Supabase 통합 카테고리 조회
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
 * 소스 타입 목록 조회 (Supabase 통합)
 * GET /api/nutrition-info/meta/source-types
 * Requirements: 6.1, 6.3
 */
router.get('/meta/source-types', async (req, res) => {
    try {
        // Supabase 통합 통계에서 소스 타입 정보 조회
        const stats = await supabaseDataManager.getStatistics();
        
        const sourceTypes = Object.entries(stats.bySourceType).map(([name, count]) => ({
            name,
            count,
            displayName: {
                'manual': '수동 포스팅',
                'paper': '논문',
                'pubmed': '논문',
                'youtube': '유튜브',
                'news': '뉴스'
            }[name] || name
        }));

        res.json({
            success: true,
            data: sourceTypes
        });
    } catch (error) {
        console.error('소스 타입 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '소스 타입 목록을 조회하는 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 영양 정보 통계 조회 (Supabase 통합)
 * GET /api/nutrition-info/meta/stats
 * Requirements: 6.1, 6.3
 */
router.get('/meta/stats', async (req, res) => {
    try {
        // Supabase 통합 통계 조회
        const stats = await supabaseDataManager.getStatistics();
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('영양 정보 통계 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '영양 정보 통계를 조회하는 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 태그 통계 및 관련 정보 조회 (Supabase 통합)
 * GET /api/nutrition-info/meta/tags
 * Requirements: 6.3
 */
router.get('/meta/tags', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const minCount = parseInt(req.query.minCount) || 1;
        
        // Supabase 통합 태그 통계 조회
        const tagStats = await supabaseDataManager.getTagStats();
        
        // 필터링 및 제한
        const filteredTags = tagStats
            .filter(tag => tag.count >= minCount)
            .slice(0, limit);
        
        res.json({
            success: true,
            data: filteredTags,
            total: tagStats.length,
            filtered: filteredTags.length
        });
    } catch (error) {
        console.error('태그 통계 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '태그 통계를 조회하는 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 개인화 추천 영양 정보 조회
 * GET /api/nutrition-info/recommended
 */
router.get('/recommended', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const type = req.query.type || 'mixed';
        let recommendations = [];

        // 로그인한 사용자인 경우 개인화 추천 제공
        if (req.session && req.session.user) {
            const userId = req.session.user.id;

            if (type === 'personal' || type === 'mixed') {
                const personalRecs = await recommendationService.getRecommendedNutritionInfo(
                    userId, 
                    type === 'mixed' ? Math.ceil(limit * 0.7) : limit
                );
                recommendations = recommendations.concat(personalRecs);
            }

            if (type === 'collaborative' || type === 'mixed') {
                const collaborativeRecs = await recommendationService.getCollaborativeRecommendations(
                    userId,
                    type === 'mixed' ? Math.floor(limit * 0.3) : limit
                );
                recommendations = recommendations.concat(collaborativeRecs);
            }

            // 관심사 자동 업데이트 (비동기)
            recommendationService.updateUserInterestsFromInteractions(userId)
                .catch(error => console.error('관심사 자동 업데이트 오류:', error));
        } else {
            // 로그인하지 않은 사용자에게는 일반 추천 제공 (신뢰도 높은 순)
            const generalRecommendations = await nutritionDataManager.getNutritionInfoList({
                limit: limit,
                sortBy: 'trustScore',
                sortOrder: 'desc'
            });
            recommendations = generalRecommendations.data || [];
        }

        const uniqueRecommendations = recommendations
            .filter((item, index, self) => 
                index === self.findIndex(t => t.id === item.id)
            )
            .slice(0, limit);

        res.json({
            success: true,
            data: uniqueRecommendations,
            type: req.session && req.session.user ? type : 'general',
            count: uniqueRecommendations.length
        });
    } catch (error) {
        console.error('개인화 추천 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '개인화 추천을 생성하는 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 사용자 선호도 조회
 * GET /api/nutrition-info/preferences
 */
router.get('/preferences', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                error: '로그인이 필요합니다.'
            });
        }

        const userId = req.session.user.id;
        const preferences = await recommendationService.getUserPreferences(userId);

        res.json({
            success: true,
            data: preferences
        });
    } catch (error) {
        console.error('사용자 선호도 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '사용자 선호도를 조회하는 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 사용자 선호도 업데이트
 * PUT /api/nutrition-info/preferences
 */
router.put('/preferences', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                error: '로그인이 필요합니다.'
            });
        }

        const userId = req.session.user.id;
        const { categories, sourceTypes, keywords, minTrustScore, language } = req.body;

        const updateData = {};
        if (categories) updateData.categories = categories;
        if (sourceTypes) updateData.sourceTypes = sourceTypes;
        if (keywords) updateData.keywords = keywords;
        if (minTrustScore !== undefined) updateData.minTrustScore = minTrustScore;
        if (language) updateData.language = language;

        const updatedPreferences = await recommendationService.updateUserPreferences(userId, updateData);

        res.json({
            success: true,
            data: updatedPreferences
        });
    } catch (error) {
        console.error('사용자 선호도 업데이트 오류:', error);
        res.status(500).json({
            success: false,
            error: '사용자 선호도를 업데이트하는 중 오류가 발생했습니다.',
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
                error: '로그인이 필요합니다.'
            });
        }

        const userId = req.session.user.id;
        const { nutritionInfoId, action } = req.body;

        if (!nutritionInfoId || !action) {
            return res.status(400).json({
                success: false,
                error: 'nutritionInfoId와 action이 필요합니다.'
            });
        }

        if (!['add', 'remove'].includes(action)) {
            return res.status(400).json({
                success: false,
                error: 'action은 add 또는 remove여야 합니다.'
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
                bookmarkCount: nutritionInfo.bookmarkCount + 1
            });
        } else {
            result = await recommendationService.removeUserInteraction(userId, nutritionInfoId, 'bookmarks');
            await supabaseDataManager.updateNutritionInfo(nutritionInfoId, {
                bookmarkCount: Math.max(0, nutritionInfo.bookmarkCount - 1)
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
                error: '로그인이 필요합니다.'
            });
        }

        const userId = req.session.user.id;
        const { nutritionInfoId, action } = req.body;

        if (!nutritionInfoId || !action) {
            return res.status(400).json({
                success: false,
                error: 'nutritionInfoId와 action이 필요합니다.'
            });
        }

        if (!['add', 'remove'].includes(action)) {
            return res.status(400).json({
                success: false,
                error: 'action은 add 또는 remove여야 합니다.'
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
                likeCount: nutritionInfo.likeCount + 1
            });
        } else {
            result = await recommendationService.removeUserInteraction(userId, nutritionInfoId, 'likes');
            await supabaseDataManager.updateNutritionInfo(nutritionInfoId, {
                likeCount: Math.max(0, nutritionInfo.likeCount - 1)
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

/**
 * 조회 기록 추가 (자동 호출)
 * POST /api/nutrition-info/view
 */
router.post('/view', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                error: '로그인이 필요합니다.'
            });
        }

        const userId = req.session.user.id;
        const { nutritionInfoId } = req.body;

        if (!nutritionInfoId) {
            return res.status(400).json({
                success: false,
                error: 'nutritionInfoId가 필요합니다.'
            });
        }

        const nutritionInfo = await nutritionDataManager.getNutritionInfoById(nutritionInfoId);
        if (!nutritionInfo) {
            return res.status(404).json({
                success: false,
                error: '해당 영양 정보를 찾을 수 없습니다.'
            });
        }

        const result = await recommendationService.recordUserInteraction(userId, nutritionInfoId, 'views');

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('조회 기록 추가 오류:', error);
        res.status(500).json({
            success: false,
            error: '조회 기록을 추가하는 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 북마크 일괄 관리
 * POST /api/nutrition-info/bookmarks/bulk
 * Body: { nutritionInfoIds: string[], action: 'add' | 'remove' }
 */
router.post('/bookmarks/bulk', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                error: '로그인이 필요합니다.'
            });
        }

        const userId = req.session.user.id;
        const { nutritionInfoIds, action } = req.body;

        if (!nutritionInfoIds || !Array.isArray(nutritionInfoIds) || nutritionInfoIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'nutritionInfoIds 배열이 필요합니다.'
            });
        }

        if (!action || !['add', 'remove'].includes(action)) {
            return res.status(400).json({
                success: false,
                error: 'action은 add 또는 remove여야 합니다.'
            });
        }

        const results = [];
        const errorList = [];

        for (const nutritionInfoId of nutritionInfoIds) {
            try {
                const nutritionInfo = await nutritionDataManager.getNutritionInfoById(nutritionInfoId);
                if (!nutritionInfo) {
                    errorList.push({
                        id: nutritionInfoId,
                        error: '해당 영양 정보를 찾을 수 없습니다.'
                    });
                    continue;
                }

                let result;
                if (action === 'add') {
                    result = await recommendationService.recordUserInteraction(userId, nutritionInfoId, 'bookmarks');
                    await nutritionDataManager.updateNutritionInfo(nutritionInfoId, {
                        bookmarkCount: nutritionInfo.bookmarkCount + 1
                    });
                } else {
                    result = await recommendationService.removeUserInteraction(userId, nutritionInfoId, 'bookmarks');
                    await nutritionDataManager.updateNutritionInfo(nutritionInfoId, {
                        bookmarkCount: Math.max(0, nutritionInfo.bookmarkCount - 1)
                    });
                }

                results.push({
                    id: nutritionInfoId,
                    success: true,
                    data: result
                });
            } catch (error) {
                errorList.push({
                    id: nutritionInfoId,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            action: action,
            processed: results.length,
            errorCount: errorList.length,
            results: results,
            errors: errorList
        });
    } catch (error) {
        console.error('북마크 일괄 처리 오류:', error);
        res.status(500).json({
            success: false,
            error: '북마크 일괄 처리 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 좋아요 일괄 관리
 * POST /api/nutrition-info/likes/bulk
 * Body: { nutritionInfoIds: string[], action: 'add' | 'remove' }
 */
router.post('/likes/bulk', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                error: '로그인이 필요합니다.'
            });
        }

        const userId = req.session.user.id;
        const { nutritionInfoIds, action } = req.body;

        if (!nutritionInfoIds || !Array.isArray(nutritionInfoIds) || nutritionInfoIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'nutritionInfoIds 배열이 필요합니다.'
            });
        }

        if (!action || !['add', 'remove'].includes(action)) {
            return res.status(400).json({
                success: false,
                error: 'action은 add 또는 remove여야 합니다.'
            });
        }

        const results = [];
        const errorList = [];

        for (const nutritionInfoId of nutritionInfoIds) {
            try {
                const nutritionInfo = await nutritionDataManager.getNutritionInfoById(nutritionInfoId);
                if (!nutritionInfo) {
                    errorList.push({
                        id: nutritionInfoId,
                        error: '해당 영양 정보를 찾을 수 없습니다.'
                    });
                    continue;
                }

                let result;
                if (action === 'add') {
                    result = await recommendationService.recordUserInteraction(userId, nutritionInfoId, 'likes');
                    await nutritionDataManager.updateNutritionInfo(nutritionInfoId, {
                        likeCount: nutritionInfo.likeCount + 1
                    });
                } else {
                    result = await recommendationService.removeUserInteraction(userId, nutritionInfoId, 'likes');
                    await nutritionDataManager.updateNutritionInfo(nutritionInfoId, {
                        likeCount: Math.max(0, nutritionInfo.likeCount - 1)
                    });
                }

                results.push({
                    id: nutritionInfoId,
                    success: true,
                    data: result
                });
            } catch (error) {
                errorList.push({
                    id: nutritionInfoId,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            action: action,
            processed: results.length,
            errorCount: errorList.length,
            results: results,
            errors: errorList
        });
    } catch (error) {
        console.error('좋아요 일괄 처리 오류:', error);
        res.status(500).json({
            success: false,
            error: '좋아요 일괄 처리 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// Admin routes (require admin privileges)

/**
 * 영양 정보 생성 (관리자용)
 * POST /api/nutrition-info
 */
router.post('/', async (req, res) => {
        console.log('[ROUTE] POST /api/nutrition-info', { body: req.body });
    try {
        if (!req.session.user || !req.session.user.isAdmin) {
            return res.status(403).json({
                success: false,
                error: '관리자 권한이 필요합니다.'
            });
        }

        const nutritionInfo = new NutritionInfo(req.body);
        const savedInfo = await nutritionDataManager.saveNutritionInfo(nutritionInfo);
        
        res.status(201).json({
            success: true,
            data: savedInfo.toJSON()
        });
    } catch (error) {
        console.error('영양 정보 생성 오류:', error);
        res.status(400).json({
            success: false,
            error: '영양 정보를 생성하는 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 영양 정보 수정 (관리자용)
 * PUT /api/nutrition-info/:id
 */
router.put('/:id', async (req, res) => {
        console.log('[ROUTE] PUT /api/nutrition-info/:id', { params: req.params, body: req.body });
    try {
        if (!req.session.user || !req.session.user.isAdmin) {
            return res.status(403).json({
                success: false,
                error: '관리자 권한이 필요합니다.'
            });
        }

        const updatedInfo = await nutritionDataManager.updateNutritionInfo(req.params.id, req.body);
        
        res.json({
            success: true,
            data: updatedInfo.toJSON()
        });
    } catch (error) {
        console.error('영양 정보 수정 오류:', error);
        
        if (error.message.includes('찾을 수 없습니다')) {
            res.status(404).json({
                success: false,
                error: error.message
            });
        } else {
            res.status(400).json({
                success: false,
                error: '영양 정보를 수정하는 중 오류가 발생했습니다.',
                details: error.message
            });
        }
    }
});

/**
 * 영양 정보 삭제 (관리자용)
 * DELETE /api/nutrition-info/:id
 */
router.delete('/:id', async (req, res) => {
        console.log('[ROUTE] DELETE /api/nutrition-info/:id', { params: req.params });
    try {
        if (!req.session.user || !req.session.user.isAdmin) {
            return res.status(403).json({
                success: false,
                error: '관리자 권한이 필요합니다.'
            });
        }

        await nutritionDataManager.deleteNutritionInfo(req.params.id);
        
        res.json({
            success: true,
            message: '영양 정보가 삭제되었습니다.'
        });
    } catch (error) {
        console.error('영양 정보 삭제 오류:', error);
        
        if (error.message.includes('찾을 수 없습니다')) {
            res.status(404).json({
                success: false,
                error: error.message
            });
        } else {
            res.status(500).json({
                success: false,
                error: '영양 정보를 삭제하는 중 오류가 발생했습니다.',
                details: error.message
            });
        }
    }
});

    /**
     * PubMed 논문 검색
     * GET /api/nutrition-info/pubmed
     */
    router.get('/pubmed', async (req, res) => {
        console.log('[ROUTE] GET /api/nutrition-info/pubmed', { query: req.query });
        try {
            const PubMedApiService = require('../utils/pubmedApiService');
            const pubmedService = new PubMedApiService();
            
            const keywords = req.query.keywords ? req.query.keywords.split(',').map(k => k.trim()) : ['nutrition', 'diet'];
            const maxResults = parseInt(req.query.maxResults) || 3;
            const dateRange = req.query.dateRange || '30d';
            
            const papers = await pubmedService.searchPapers(keywords, maxResults, dateRange);
            
            res.json({
                success: true,
                count: papers.length,
                papers: papers
            });
        } catch (error) {
            console.error('PubMed 논문 검색 오류:', error);
            res.status(500).json({
                success: false,
                error: 'PubMed 논문 검색 중 오류가 발생했습니다.',
                details: error.message
            });
        }
    });

    return router;
};