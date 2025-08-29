/**
 * 상품 관리 관리자 API 라우터
 * Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 4.1, 4.2, 9.1, 9.2, 10.1, 10.2
 */

const express = require('express');
const multer = require('multer');
const router = express.Router();
const ProductManager = require('../utils/productManager');
const CategoryManager = require('../utils/categoryManager');
const ImageUploadHandler = require('../utils/imageUploadHandler');
const ProductErrorHandler = require('../utils/productErrorHandler');

// Multer 설정 (메모리 저장)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 1
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('지원되지 않는 파일 형식입니다.'), false);
        }
    }
});

// 인스턴스 생성
const productManager = new ProductManager();
const categoryManager = new CategoryManager();
const imageUploadHandler = new ImageUploadHandler();

// Admin authentication middleware
const adminAuth = (req, res, next) => {
    console.log('Admin auth check:', {
        hasSession: !!req.session,
        hasUser: !!(req.session && req.session.user),
        user: req.session?.user
    });
    
    if (!req.session || !req.session.user) {
        console.log('No session or user found');
        return res.status(401).json({ 
            success: false, 
            error: '로그인이 필요합니다.' 
        });
    }
    
    // 관리자 권한 확인 (다양한 방식 지원)
    const isAdmin = req.session.user.username === 'admin' ||
        req.session.user.id === '1' ||
        req.session.user.isAdmin === true ||
        req.session.user.role === 'admin';
    
    console.log('Admin check result:', {
        username: req.session.user.username,
        id: req.session.user.id,
        isAdmin: req.session.user.isAdmin,
        role: req.session.user.role,
        isAdmin: isAdmin
    });
    
    if (!isAdmin) {
        console.log('User is not admin');
        return res.status(403).json({ 
            success: false, 
            error: '관리자 권한이 필요합니다.' 
        });
    }
    
    console.log('Admin auth passed');
    next();
};

// Apply admin authentication to all routes
router.use(adminAuth);

// GET /api/admin/products - List products with pagination/filtering
router.get('/', async (req, res) => {
    try {
        console.log('GET /api/admin/products - 요청 파라미터:', req.query);
        
        const { 
            page = 1, 
            limit = 20, 
            category, 
            status, 
            search,
            startDate,
            endDate,
            sort = 'created_at',
            order = 'desc'
        } = req.query;

        const filters = {
            category,
            status,
            search,
            startDate,
            endDate
        };

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sortBy: sort,
            sortOrder: order
        };

        console.log('필터:', filters);
        console.log('옵션:', options);

        const result = await productManager.getProducts(filters, options);
        
        console.log('결과:', { 
            productsCount: result.products?.length, 
            total: result.total,
            page: result.page 
        });
        
        res.json({
            success: true,
            data: result.products,
            pagination: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: result.totalPages
            }
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'GET_PRODUCTS');
    }
});

// POST /api/admin/products - Create new product
router.post('/', async (req, res) => {
    try {
        // Input sanitization and validation
        if (!req.body || Object.keys(req.body).length === 0) {
            const error = new Error('요청 데이터가 없습니다.');
            error.type = 'VALIDATION_ERROR';
            throw error;
        }

        const productData = {
            ...req.body,
            created_by: req.session.user.id
        };

        // Additional server-side validation
        if (!productData.name || typeof productData.name !== 'string') {
            const error = new Error('상품명은 필수이며 문자열이어야 합니다.');
            error.type = 'VALIDATION_ERROR';
            throw error;
        }

        if (!productData.price || isNaN(parseInt(productData.price))) {
            const error = new Error('유효한 가격을 입력해주세요.');
            error.type = 'VALIDATION_ERROR';
            throw error;
        }

        const product = await productManager.createProduct(productData);
        
        res.status(201).json({
            success: true,
            data: product,
            message: '상품이 성공적으로 생성되었습니다.'
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'CREATE_PRODUCT');
    }
});

// GET /api/admin/products/stats - Get product statistics for dashboard
router.get('/stats', async (req, res) => {
    try {
        const stats = await productManager.getProductStats();
        
        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        console.error('상품 통계 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '상품 통계를 조회할 수 없습니다.',
            stats: {
                totalProducts: 0,
                activeProducts: 0,
                inactiveProducts: 0,
                totalCategories: 0,
                totalViews: 0,
                todayViews: 0
            }
        });
    }
});

// GET /api/admin/products/category-stats - Get category-wise statistics
router.get('/category-stats', async (req, res) => {
    try {
        console.log('GET /api/admin/products/category-stats - 요청 시작');
        const categoryStats = await productManager.getCategoryStats();
        console.log('카테고리 통계 결과:', categoryStats);
        
        res.json({
            success: true,
            data: categoryStats
        });
    } catch (error) {
        console.error('카테고리 통계 조회 오류:', error);
        ProductErrorHandler.handle(error, req, res, 'GET_CATEGORY_STATS');
    }
});

// GET /api/admin/products/storage-usage - Get storage usage statistics
router.get('/storage-usage', async (req, res) => {
    try {
        const result = await imageUploadHandler.getStorageUsage();
        
        if (!result || !result.success) {
            return res.status(500).json({
                success: false,
                error: '스토리지 사용량을 조회할 수 없습니다.'
            });
        }
        
        res.json(result);
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'GET_STORAGE_USAGE');
    }
});

// GET /api/admin/products/analytics/overview - Get analytics overview
router.get('/analytics/overview', async (req, res) => {
    try {
        const overview = await productManager.getAnalyticsOverview();
        
        res.json({
            success: true,
            data: overview
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'GET_ANALYTICS_OVERVIEW');
    }
});

// GET /api/admin/products/analytics/trends - Get analytics trends
router.get('/analytics/trends', async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const trends = await productManager.getAnalyticsTrends(parseInt(days));
        
        res.json({
            success: true,
            trends: trends
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'GET_ANALYTICS_TRENDS');
    }
});

// GET /api/admin/products/analytics/date-range - Get analytics by date range
router.get('/analytics/date-range', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                error: '시작일과 종료일이 필요합니다.'
            });
        }

        const analytics = await productManager.getAnalyticsByDateRange(startDate, endDate);
        
        res.json({
            success: true,
            data: analytics
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'GET_DATE_RANGE_ANALYTICS');
    }
});

// GET /api/admin/products/today-views-detail - Get today's views detail by product
// 이 라우트는 /:id 라우트보다 먼저 정의되어야 합니다
router.get('/today-views-detail', async (req, res) => {
    try {
        console.log('오늘 조회수 상세 API 호출됨');
        
        const todayViewsDetail = await productManager.getTodayViewsDetail();
        
        res.json({
            success: true,
            data: todayViewsDetail
        });
    } catch (error) {
        console.error('오늘 조회수 상세 조회 오류:', error);
        ProductErrorHandler.handle(error, req, res, 'GET_TODAY_VIEWS_DETAIL');
    }
});

// GET /api/admin/products/image/:id/metadata - Get image metadata
router.get('/image/:id/metadata', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await imageUploadHandler.getImageMetadata(id);
        
        if (!result || !result.success) {
            return res.status(404).json({
                success: false,
                error: '이미지 메타데이터를 찾을 수 없습니다.'
            });
        }
        
        res.json(result);
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'GET_IMAGE_METADATA');
    }
});

// GET /api/admin/products/:id - Get single product
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const product = await productManager.getProductById(id);
        
        if (!product) {
            return res.status(404).json({
                success: false,
                error: '상품을 찾을 수 없습니다.'
            });
        }
        
        res.json({
            success: true,
            data: product
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'GET_PRODUCT');
    }
});

// PUT /api/admin/products/:id - Update product
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Validate product ID
        if (!id || typeof id !== 'string') {
            const error = new Error('유효하지 않은 상품 ID입니다.');
            error.type = 'VALIDATION_ERROR';
            throw error;
        }

        // Validate update data
        if (!updateData || Object.keys(updateData).length === 0) {
            const error = new Error('수정할 데이터가 없습니다.');
            error.type = 'VALIDATION_ERROR';
            throw error;
        }

        // Additional validation for critical fields
        if (updateData.price !== undefined && isNaN(parseInt(updateData.price))) {
            const error = new Error('유효한 가격을 입력해주세요.');
            error.type = 'VALIDATION_ERROR';
            throw error;
        }

        const product = await productManager.updateProduct(id, updateData);
        
        if (!product) {
            const error = new Error('상품을 찾을 수 없습니다.');
            error.type = 'NOT_FOUND_ERROR';
            throw error;
        }
        
        res.json({
            success: true,
            data: product,
            message: '상품이 성공적으로 수정되었습니다.'
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'UPDATE_PRODUCT');
    }
});

// DELETE /api/admin/products/:id - Delete product
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const deleted = await productManager.deleteProduct(id);
        
        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: '상품을 찾을 수 없습니다.'
            });
        }
        
        res.json({
            success: true,
            message: '상품이 성공적으로 삭제되었습니다.'
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'DELETE_PRODUCT');
    }
});

// POST /api/admin/products/bulk - Bulk operations
router.post('/bulk', async (req, res) => {
    try {
        const { action, productIds } = req.body;
        
        if (!action || !productIds || !Array.isArray(productIds)) {
            return res.status(400).json({
                success: false,
                error: '작업 유형과 상품 ID 목록이 필요합니다.'
            });
        }

        let result;
        switch (action) {
            case 'activate':
                result = await productManager.bulkUpdateStatus(productIds, 'active');
                break;
            case 'deactivate':
                result = await productManager.bulkUpdateStatus(productIds, 'inactive');
                break;
            case 'delete':
                result = await productManager.bulkDelete(productIds);
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: '지원하지 않는 작업입니다.'
                });
        }
        
        res.json({
            success: true,
            data: result,
            message: `${productIds.length}개 상품에 대한 ${action} 작업이 완료되었습니다.`
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'BULK_OPERATION');
    }
});

// POST /api/admin/products/upload-image - Upload product image
router.post('/upload-image', (req, res, next) => {
    // Enhanced multer error handling
    upload.single('image')(req, res, (err) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    const error = new Error('파일 크기가 5MB를 초과합니다.');
                    error.type = 'IMAGE_ERROR';
                    return ProductErrorHandler.handle(error, req, res, 'IMAGE_UPLOAD');
                }
                if (err.code === 'LIMIT_FILE_COUNT') {
                    const error = new Error('한 번에 하나의 파일만 업로드할 수 있습니다.');
                    error.type = 'IMAGE_ERROR';
                    return ProductErrorHandler.handle(error, req, res, 'IMAGE_UPLOAD');
                }
                if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                    const error = new Error('예상하지 못한 파일 필드입니다.');
                    error.type = 'IMAGE_ERROR';
                    return ProductErrorHandler.handle(error, req, res, 'IMAGE_UPLOAD');
                }
            }
            
            // File type validation error
            if (err.message.includes('지원되지 않는 파일 형식')) {
                const error = new Error('JPG, PNG, WebP, GIF 파일만 업로드 가능합니다.');
                error.type = 'IMAGE_ERROR';
                return ProductErrorHandler.handle(error, req, res, 'IMAGE_UPLOAD');
            }
            
            const error = new Error('파일 업로드 중 오류가 발생했습니다.');
            error.type = 'IMAGE_ERROR';
            return ProductErrorHandler.handle(error, req, res, 'IMAGE_UPLOAD');
        }
        next();
    });
}, async (req, res) => {
    try {
        // Validate file exists
        if (!req.file) {
            const error = new Error('업로드할 이미지 파일을 선택해주세요.');
            error.type = 'VALIDATION_ERROR';
            throw error;
        }

        // Additional file validation
        const file = req.file;
        
        // Check file size (additional check)
        if (file.size > 5 * 1024 * 1024) {
            const error = new Error('파일 크기는 5MB 이하여야 합니다.');
            error.type = 'IMAGE_ERROR';
            throw error;
        }

        // Check file type (additional check)
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.mimetype)) {
            const error = new Error('JPG, PNG, WebP, GIF 파일만 업로드 가능합니다.');
            error.type = 'IMAGE_ERROR';
            throw error;
        }

        // Check if file buffer is valid
        if (!file.buffer || file.buffer.length === 0) {
            const error = new Error('유효하지 않은 이미지 파일입니다.');
            error.type = 'IMAGE_ERROR';
            throw error;
        }

        const result = await imageUploadHandler.handleUpload(req, res);
        
        res.json({
            success: true,
            data: result,
            message: '이미지가 성공적으로 업로드되었습니다.'
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'IMAGE_UPLOAD');
    }
});

// DELETE /api/admin/products/image/:id - Delete product image
router.delete('/image/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await imageUploadHandler.deleteImage(id);
        
        if (!result) {
            return res.status(404).json({
                success: false,
                error: '이미지를 찾을 수 없습니다.'
            });
        }
        
        res.json({
            success: true,
            message: '이미지가 성공적으로 삭제되었습니다.'
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'IMAGE_DELETE');
    }
});

// GET /api/admin/products/categories - List categories
router.get('/categories', async (req, res) => {
    try {
        const categories = await categoryManager.getCategories();
        
        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'GET_CATEGORIES');
    }
});

// POST /api/admin/products/categories - Create category
router.post('/categories', async (req, res) => {
    try {
        const categoryData = req.body;
        const category = await categoryManager.createCategory(categoryData);
        
        res.status(201).json({
            success: true,
            data: category,
            message: '카테고리가 성공적으로 생성되었습니다.'
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'CREATE_CATEGORY');
    }
});

// PUT /api/admin/products/categories/:id - Update category
router.put('/categories/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        const category = await categoryManager.updateCategory(id, updateData);
        
        if (!category) {
            return res.status(404).json({
                success: false,
                error: '카테고리를 찾을 수 없습니다.'
            });
        }
        
        res.json({
            success: true,
            data: category,
            message: '카테고리가 성공적으로 수정되었습니다.'
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'UPDATE_CATEGORY');
    }
});

// DELETE /api/admin/products/categories/:id - Delete category
router.delete('/categories/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const deleted = await categoryManager.deleteCategory(id);
        
        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: '카테고리를 찾을 수 없습니다.'
            });
        }
        
        res.json({
            success: true,
            message: '카테고리가 성공적으로 삭제되었습니다.'
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'DELETE_CATEGORY');
    }
});

// GET /api/admin/products/:id/analytics - Get product analytics
router.get('/:id/analytics', async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;
        
        const analytics = await productManager.getProductAnalytics(id, {
            startDate,
            endDate
        });
        
        res.json({
            success: true,
            data: analytics
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'GET_ANALYTICS');
    }
});

// GET /api/admin/products/popular - Get popular products
router.get('/popular', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const popularProducts = await productManager.getPopularProducts(parseInt(limit));
        
        res.json({
            success: true,
            data: popularProducts
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'GET_POPULAR_PRODUCTS');
    }
});





// GET /api/admin/products/:id/analytics/export - Export product analytics
router.get('/:id/analytics/export', async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;
        
        const csvData = await productManager.exportProductAnalytics(id, {
            startDate,
            endDate
        });
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="product-analytics-${id}.csv"`);
        res.send(csvData);
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'EXPORT_PRODUCT_ANALYTICS');
    }
});

// GET /api/admin/products/analytics/export-all - Export all products analytics
router.get('/analytics/export-all', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        const csvData = await productManager.exportAllAnalytics({
            startDate,
            endDate
        });
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="all-products-analytics.csv"`);
        res.send(csvData);
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'EXPORT_ALL_ANALYTICS');
    }
});

module.exports = router;

// Performance monitoring endpoints

// GET /api/admin/products/performance/cache-stats - Get cache performance statistics
router.get('/performance/cache-stats', async (req, res) => {
    try {
        const { getCacheManager } = require('../utils/cacheManager');
        const cacheManager = getCacheManager();
        const stats = cacheManager.getStats();
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'GET_CACHE_STATS');
    }
});

// GET /api/admin/products/performance/db-stats - Get database performance statistics
router.get('/performance/db-stats', async (req, res) => {
    try {
        const { getDatabaseOptimizer } = require('../utils/databaseOptimizer');
        const dbOptimizer = getDatabaseOptimizer();
        const stats = await dbOptimizer.getDatabaseStats();
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'GET_DB_STATS');
    }
});

// GET /api/admin/products/performance/image-stats - Get image optimization statistics
router.get('/performance/image-stats', async (req, res) => {
    try {
        const { getImageOptimizer } = require('../utils/imageOptimizer');
        const imageOptimizer = getImageOptimizer();
        const healthCheck = await imageOptimizer.healthCheck();
        
        res.json({
            success: true,
            data: healthCheck
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'GET_IMAGE_STATS');
    }
});

// POST /api/admin/products/performance/optimize-cache - Optimize cache performance
router.post('/performance/optimize-cache', async (req, res) => {
    try {
        const { getCacheManager } = require('../utils/cacheManager');
        const cacheManager = getCacheManager();
        
        const { maxKeys = 1000 } = req.body;
        const removedKeys = cacheManager.optimizeMemory(maxKeys);
        
        res.json({
            success: true,
            data: {
                removedKeys,
                message: `Optimized cache: removed ${removedKeys} keys`
            }
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'OPTIMIZE_CACHE');
    }
});

// POST /api/admin/products/performance/clear-cache - Clear cache
router.post('/performance/clear-cache', async (req, res) => {
    try {
        const { getCacheManager } = require('../utils/cacheManager');
        const cacheManager = getCacheManager();
        
        const { namespace } = req.body;
        
        let clearedKeys;
        if (namespace) {
            clearedKeys = cacheManager.clearNamespace(namespace);
        } else {
            clearedKeys = cacheManager.clearAll();
        }
        
        res.json({
            success: true,
            data: {
                clearedKeys,
                message: `Cleared ${clearedKeys} cache entries`
            }
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'CLEAR_CACHE');
    }
});

// GET /api/admin/products/performance/health - Overall performance health check
router.get('/performance/health', async (req, res) => {
    try {
        const { getCacheManager } = require('../utils/cacheManager');
        const { getDatabaseOptimizer } = require('../utils/databaseOptimizer');
        const { getImageOptimizer } = require('../utils/imageOptimizer');
        
        const cacheManager = getCacheManager();
        const dbOptimizer = getDatabaseOptimizer();
        const imageOptimizer = getImageOptimizer();
        
        const [cacheHealth, dbHealth, imageHealth] = await Promise.all([
            cacheManager.healthCheck(),
            dbOptimizer.healthCheck(),
            imageOptimizer.healthCheck()
        ]);
        
        const overallStatus = [cacheHealth.status, dbHealth.status, imageHealth.status]
            .includes('error') ? 'error' : 
            [cacheHealth.status, dbHealth.status, imageHealth.status]
            .includes('warning') ? 'warning' : 'healthy';
        
        res.json({
            success: true,
            data: {
                overall: overallStatus,
                cache: cacheHealth,
                database: dbHealth,
                images: imageHealth,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'PERFORMANCE_HEALTH');
    }
});

// POST /api/admin/products/performance/create-indexes - Create database indexes
router.post('/performance/create-indexes', async (req, res) => {
    try {
        const { getDatabaseOptimizer } = require('../utils/databaseOptimizer');
        const dbOptimizer = getDatabaseOptimizer();
        
        const results = await dbOptimizer.createOptimalIndexes();
        
        res.json({
            success: true,
            data: {
                results,
                message: 'Database indexes creation completed'
            }
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'CREATE_INDEXES');
    }
});

// GET /api/admin/products/performance/query-analysis - Analyze query performance
router.get('/performance/query-analysis', async (req, res) => {
    try {
        const { getDatabaseOptimizer } = require('../utils/databaseOptimizer');
        const dbOptimizer = getDatabaseOptimizer();
        
        const analysis = await dbOptimizer.analyzeQueryPerformance();
        
        res.json({
            success: true,
            data: analysis
        });
    } catch (error) {
        ProductErrorHandler.handle(error, req, res, 'QUERY_ANALYSIS');
    }
});

