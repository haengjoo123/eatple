const express = require('express');
const router = express.Router();
const CSVFoodSearch = require('../utils/csvFoodSearch');

// CSV 검색 인스턴스 생성
const csvSearch = new CSVFoodSearch();

/**
 * CSV 파일을 활용한 식품명 기반 영양정보 검색 (부분일치 지원)
 * GET /api/food-nutrition-external/search?productName=제품명&limit=50
 */
router.get('/search', async (req, res) => {
    const { productName, limit } = req.query;
    
    if (!productName || typeof productName !== 'string') {
        return res.status(400).json({ 
            success: false, 
            error: 'productName 파라미터가 필요합니다.' 
        });
    }
    
    if (productName.trim().length < 1) {
        return res.status(400).json({ 
            success: false, 
            error: '검색어를 입력해주세요.' 
        });
    }
    
    try {
        console.log(`[food-nutrition-external] CSV 검색 요청: ${productName}`);
        
        const searchLimit = limit ? parseInt(limit) : 200;
        const result = await csvSearch.search(productName.trim(), { 
            limit: searchLimit,
            exactMatch: false,
            includePartial: true
        });
        
        if (result.length === 0) {
            return res.json({ 
                success: false, 
                error: '검색 결과가 없습니다. 다른 제품명으로 시도해보세요.' 
            });
        }
        
        console.log(`[food-nutrition-external] CSV에서 ${result.length}개 결과 반환`);
        res.json({ success: true, data: result, source: 'csv' });
    } catch (error) {
        console.error('[food-nutrition-external] CSV 검색 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: 'CSV 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' 
        });
    }
});

/**
 * CSV 파일을 활용한 정확일치 검색
 * GET /api/food-nutrition-external/exact-search?productName=제품명
 */
router.get('/exact-search', async (req, res) => {
    const { productName } = req.query;
    
    if (!productName || typeof productName !== 'string') {
        return res.status(400).json({ 
            success: false, 
            error: 'productName 파라미터가 필요합니다.' 
        });
    }
    
    if (productName.trim().length < 1) {
        return res.status(400).json({ 
            success: false, 
            error: '검색어를 입력해주세요.' 
        });
    }
    
    try {
        console.log(`[food-nutrition-external] CSV 정확일치 검색 요청: ${productName}`);
        
        const result = await csvSearch.search(productName.trim(), { 
            limit: 100,
            exactMatch: true,
            includePartial: false
        });
        
        if (result.length === 0) {
            return res.json({ 
                success: false, 
                error: '정확한 일치 결과가 없습니다. 부분 검색을 시도해보세요.' 
            });
        }
        
        console.log(`[food-nutrition-external] CSV 정확일치에서 ${result.length}개 결과 반환`);
        res.json({ success: true, data: result, source: 'csv-exact' });
    } catch (error) {
        console.error('[food-nutrition-external] CSV 정확일치 검색 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: 'CSV 정확일치 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' 
        });
    }
});

/**
 * CSV 파일을 활용한 상세 정보 조회
 * GET /api/food-nutrition-external/detail?foodCode=식품코드&foodName=식품명&manufacturer=제조사명
 */
router.get('/detail', async (req, res) => {
    const { foodCode, foodName, manufacturer } = req.query;
    
    if (!foodCode && !foodName) {
        return res.status(400).json({ 
            success: false, 
            error: 'foodCode 또는 foodName 파라미터가 필요합니다.' 
        });
    }
    
    try {
        console.log(`[food-nutrition-external] CSV 상세정보 요청: ${foodName || foodCode}, 제조사: ${manufacturer || '없음'}`);
        
        const result = await csvSearch.getDetail(foodCode, foodName, manufacturer);
        
        if (!result) {
            return res.status(404).json({ 
                success: false, 
                error: '해당 제품의 상세 정보를 찾을 수 없습니다.' 
            });
        }
        
        console.log(`[food-nutrition-external] CSV 상세정보 반환: ${result.식품명} (${result.제조사명})`);
        res.json({ success: true, data: result, source: 'csv' });
    } catch (error) {
        console.error('[food-nutrition-external] CSV 상세정보 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: 'CSV 상세정보 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' 
        });
    }
});

/**
 * CSV 파일 통계 정보 조회
 * GET /api/food-nutrition-external/stats
 */
router.get('/stats', async (req, res) => {
    try {
        console.log('[food-nutrition-external] CSV 통계 정보 요청');
        
        const stats = await csvSearch.getStats();
        
        console.log('[food-nutrition-external] CSV 통계 정보 반환');
        res.json({ success: true, data: stats, source: 'csv' });
    } catch (error) {
        console.error('[food-nutrition-external] CSV 통계 정보 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: 'CSV 통계 정보 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' 
        });
    }
});

/**
 * 검색 통계 정보 조회
 * GET /api/food-nutrition-external/search-stats?keyword=검색어
 */
router.get('/search-stats', async (req, res) => {
    const { keyword } = req.query;
    
    if (!keyword || typeof keyword !== 'string') {
        return res.status(400).json({ 
            success: false, 
            error: 'keyword 파라미터가 필요합니다.' 
        });
    }
    
    try {
        console.log(`[food-nutrition-external] 검색 통계 요청: ${keyword}`);
        
        const stats = await csvSearch.getSearchStats(keyword.trim());
        
        console.log(`[food-nutrition-external] 검색 통계 반환: ${stats.totalMatches}개 결과`);
        res.json({ success: true, data: stats, source: 'csv' });
    } catch (error) {
        console.error('[food-nutrition-external] 검색 통계 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: '검색 통계 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' 
        });
    }
});

module.exports = router;