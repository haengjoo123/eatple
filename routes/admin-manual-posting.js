/**
 * 관리자 수동 포스팅 API 라우터
 * Requirements: 2.1, 2.2, 3.1, 5.1, 5.2, 5.3
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const SupabaseNutritionDataManager = require('../utils/supabaseNutritionDataManager');
const CategoryTagManager = require('../utils/categoryTagManager');
const SupabaseImageManager = require('../utils/supabaseImageManager');

// 서비스 인스턴스 생성
const nutritionDataManager = new SupabaseNutritionDataManager();
const categoryTagManager = new CategoryTagManager();
const imageManager = new SupabaseImageManager();

// Multer 설정 (메모리 저장)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('지원하지 않는 파일 형식입니다.'), false);
        }
    }
});

// 관리자 권한 확인 미들웨어
function requireAdmin(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            error: '로그인이 필요합니다.'
        });
    }

    // 관리자 권한 확인
    const isAdmin = req.session.user.username === 'admin' ||
        req.session.user.id === '1' ||
        req.session.user.isAdmin === true ||
        req.session.user.role === 'admin';

    if (!isAdmin) {
        return res.status(403).json({
            success: false,
            error: '관리자 권한이 필요합니다.'
        });
    }

    next();
}

// 로그용 데이터 정리 헬퍼 함수 (긴 base64 데이터 등을 간략화)
function sanitizeForLog(data, maxLength = 100) {
    if (!data) return data;
    
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
            // base64 이미지 데이터 감지 (data:image로 시작하거나 매우 긴 문자열)
            if (value.startsWith('data:image/') || value.length > 1000) {
                sanitized[key] = `[${value.substring(0, 20)}...] (${value.length} chars)`;
            } else if (value.length > maxLength) {
                sanitized[key] = value.substring(0, maxLength) + `... (${value.length} chars)`;
            } else {
                sanitized[key] = value;
            }
        } else if (typeof value === 'object' && value !== null) {
            // 재귀적으로 객체 처리
            sanitized[key] = sanitizeForLog(value, maxLength);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

// ==================== 포스팅 CRUD API ====================

/**
 * 포스팅 생성 API
 * POST /api/admin/manual-posting/posts
 */
router.post('/posts', requireAdmin, async (req, res) => {
    console.log('🔥 포스팅 생성 요청 받음:', {
        url: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
        body: sanitizeForLog(req.body)
    });
    try {
        const {
            title,
            summary,
            content,
            category,
            categoryId,
            tags,
            sourceUrl,
            sourceName,
            imageUrl,
            thumbnailUrl,
            isDraft = false,
            productName1,
            productLink1,
            productName2,
            productLink2,
            productName3,
            productLink3
        } = req.body;

        // 입력 검증
        if (!title || !summary || !content) {
            return res.status(400).json({
                success: false,
                error: '제목, 요약, 내용은 필수 입력 항목입니다.'
            });
        }

        // 카테고리 처리 - 이름으로 받은 경우 ID로 변환
        let finalCategoryId = categoryId;
        if (!finalCategoryId && category) {
            // 카테고리 이름으로 ID 찾기 또는 새 카테고리 생성
            const existingCategory = await categoryTagManager.getCategoryByName(category);
            if (existingCategory) {
                finalCategoryId = existingCategory.id;
            } else {
                // 새 카테고리 생성
                const newCategory = await categoryTagManager.addCategory({
                    name: category,
                    description: `${category} 관련 영양 정보`
                });
                finalCategoryId = newCategory.id;
            }
        }

        if (!finalCategoryId) {
            return res.status(400).json({
                success: false,
                error: '카테고리를 선택해야 합니다.'
            });
        }

        // 관리자 정보
        const adminInfo = {
            id: req.session.user.id,
            name: req.session.user.username || req.session.user.name || 'Admin'
        };

        // 관련 상품 정보 처리
        console.log('🔗 관련상품 데이터 수신:', {
            productName1, productLink1,
            productName2, productLink2,
            productName3, productLink3
        });
        
        const relatedProducts = [];
        if (productName1 && productName1.trim()) {
            relatedProducts.push({
                name: productName1.trim(),
                link: productLink1 ? productLink1.trim() : null
            });
        }
        if (productName2 && productName2.trim()) {
            relatedProducts.push({
                name: productName2.trim(),
                link: productLink2 ? productLink2.trim() : null
            });
        }
        if (productName3 && productName3.trim()) {
            relatedProducts.push({
                name: productName3.trim(),
                link: productLink3 ? productLink3.trim() : null
            });
        }
        
        console.log(`🔗 처리된 관련상품 수: ${relatedProducts.length}`, relatedProducts);

        // 포스팅 데이터 준비
        const postData = {
            title: title.trim(),
            summary: summary.trim(),
            content: content.trim(),
            categoryId: finalCategoryId,
            tags: Array.isArray(tags) ? tags.filter(tag => tag.trim()) : (tags ? tags.split(',').map(t => t.trim()).filter(t => t) : []),
            sourceUrl: sourceUrl ? sourceUrl.trim() : null,
            sourceName: sourceName ? sourceName.trim() : null,
            imageUrl: imageUrl ? imageUrl.trim() : null,
            thumbnailUrl: thumbnailUrl ? thumbnailUrl.trim() : null,
            relatedProducts: relatedProducts,
            isDraft
        };

        // 포스팅 생성
        console.log('📝 포스팅 생성 시작:', {
            title: postData.title,
            relatedProductsCount: postData.relatedProducts.length,
            adminInfo
        });
        const newPost = await nutritionDataManager.createPost(postData, adminInfo);
        console.log('📝 포스팅 생성 완료:', newPost.id);

        // 카테고리 포스팅 수 업데이트 (로컬 환경에서만)
        // Supabase 환경에서는 데이터베이스에서 직접 집계하므로 별도 업데이트 불필요
        if (!isDraft && !process.env.SUPABASE_URL) {
            console.log(`📊 새 포스팅 카테고리 포스팅 수 업데이트 시작 - 카테고리 ID: ${finalCategoryId}`);
            try {
                await categoryTagManager.updateCategoryPostCount(finalCategoryId);
                console.log(`📊 새 포스팅 카테고리 포스팅 수 업데이트 완료 - 카테고리 ID: ${finalCategoryId}`);
            } catch (error) {
                console.warn(`⚠️ 카테고리 포스팅 수 업데이트 실패 (무시): ${error.message}`);
            }
        }

        console.log(`✅ 새 포스팅 생성: ${newPost.id} (by ${adminInfo.name})`);

        res.status(201).json({
            success: true,
            data: newPost,
            message: isDraft ? '임시저장되었습니다.' : '포스팅이 생성되었습니다.'
        });

    } catch (error) {
        console.error('❌ 포스팅 생성 오류:', error);
        console.error('❌ 오류 스택:', error.stack);
        res.status(500).json({
            success: false,
            error: '포스팅 생성 중 오류가 발생했습니다.',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * 포스팅 수정 API
 * PUT /api/admin/manual-posting/posts/:id
 */
router.put('/posts/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            summary,
            content,
            category,
            categoryId,
            tags,
            sourceUrl,
            sourceName,
            imageUrl,
            thumbnailUrl,
            isDraft,
            isActive,
            // 관련 상품 정보
            productName1,
            productLink1,
            productName2,
            productLink2,
            productName3,
            productLink3
        } = req.body;

        // 포스팅 존재 확인
        const existingPost = await nutritionDataManager.getNutritionInfoById(id);
        if (!existingPost) {
            return res.status(404).json({
                success: false,
                error: '해당 포스팅을 찾을 수 없습니다.'
            });
        }

        // 관리자 정보
        const adminInfo = {
            id: req.session.user.id,
            name: req.session.user.username || req.session.user.name || 'Admin'
        };

        // 카테고리 처리
        let finalCategoryId = categoryId;
        if (!finalCategoryId && category) {
            const existingCategory = await categoryTagManager.getCategoryByName(category);
            if (existingCategory) {
                finalCategoryId = existingCategory.id;
            } else {
                const newCategory = await categoryTagManager.addCategory({
                    name: category,
                    description: `${category} 관련 영양 정보`
                });
                finalCategoryId = newCategory.id;
            }
        }

        // 업데이트할 데이터 준비
        const updates = {};
        if (title !== undefined) updates.title = title.trim();
        if (summary !== undefined) updates.summary = summary.trim();
        if (content !== undefined) updates.content = content.trim();
        if (finalCategoryId !== undefined) updates.category_id = finalCategoryId;
        if (sourceUrl !== undefined) updates.source_url = sourceUrl ? sourceUrl.trim() : null;
        if (sourceName !== undefined) updates.source_name = sourceName ? sourceName.trim() : null;
        if (imageUrl !== undefined) updates.image_url = imageUrl ? imageUrl.trim() : null;
        if (thumbnailUrl !== undefined) updates.thumbnail_url = thumbnailUrl ? thumbnailUrl.trim() : null;
        if (isDraft !== undefined) updates.is_draft = isDraft;
        if (isActive !== undefined) updates.is_active = isActive;

        // 태그 업데이트 (별도 처리)
        let tagNames = [];
        if (tags !== undefined) {
            tagNames = Array.isArray(tags) ? tags.filter(tag => tag.trim()) : (tags ? tags.split(',').map(t => t.trim()).filter(t => t) : []);
        }

        // 관련 상품 정보 처리
        console.log('🔗 포스팅 수정 - 관련상품 데이터 수신:', {
            productName1, productLink1,
            productName2, productLink2,
            productName3, productLink3
        });
        
        const relatedProducts = [];
        if (productName1 && productName1.trim()) {
            relatedProducts.push({
                name: productName1.trim(),
                link: productLink1 ? productLink1.trim() : null
            });
        }
        if (productName2 && productName2.trim()) {
            relatedProducts.push({
                name: productName2.trim(),
                link: productLink2 ? productLink2.trim() : null
            });
        }
        if (productName3 && productName3.trim()) {
            relatedProducts.push({
                name: productName3.trim(),
                link: productLink3 ? productLink3.trim() : null
            });
        }
        
        console.log(`🔗 포스팅 수정 - 처리된 관련상품 수: ${relatedProducts.length}`, relatedProducts);
        
        // 포스팅 수정 (로컬 데이터 매니저 사용)
        console.log(`🔄 포스팅 업데이트 시작 - ID: ${id}`);
        console.log('업데이트할 데이터:', sanitizeForLog(updates));
        
        const updateResult = await nutritionDataManager.updateNutritionInfo(id, updates);
        console.log(`🔄 포스팅 업데이트 결과: ${updateResult}`);
        
        if (!updateResult) {
            console.error(`❌ 포스팅 업데이트 실패 - ID: ${id}`);
            return res.status(500).json({
                success: false,
                error: '포스팅 업데이트에 실패했습니다.'
            });
        }

        // 태그 업데이트가 있는 경우 별도 처리 (tags가 명시적으로 전달된 경우에만)
        if (tags !== undefined) {
            console.log(`🏷️ 태그 업데이트 시작 - ID: ${id}`, tagNames);
            try {
                await nutritionDataManager.saveTags(id, tagNames);
                console.log(`🏷️ 태그 업데이트 완료 - ID: ${id}`);
            } catch (error) {
                console.error(`❌ 태그 업데이트 오류 - ID: ${id}:`, error);
                throw error;
            }
        }

        // 관련 상품 정보가 제공된 경우 별도 처리
        if (productName1 !== undefined || productName2 !== undefined || productName3 !== undefined) {
            console.log(`🔗 포스팅 수정 - 관련상품 저장 시작: ${id}`, relatedProducts);
            try {
                await nutritionDataManager.saveRelatedProducts(id, relatedProducts);
                console.log(`🔗 포스팅 수정 - 관련상품 저장 완료: ${id}`);
            } catch (error) {
                console.error(`❌ 관련상품 저장 오류 - ID: ${id}:`, error);
                throw error;
            }
        }

        // 카테고리 포스팅 수 업데이트 (카테고리가 변경된 경우, 로컬 환경에서만)
        // Supabase 환경에서는 데이터베이스에서 직접 집계하므로 별도 업데이트 불필요
        if (finalCategoryId !== undefined && !process.env.SUPABASE_URL) {
            console.log(`📊 카테고리 포스팅 수 업데이트 시작 - 카테고리 ID: ${finalCategoryId}`);
            try {
                await categoryTagManager.updateCategoryPostCount(finalCategoryId);
                console.log(`📊 카테고리 포스팅 수 업데이트 완료 - 카테고리 ID: ${finalCategoryId}`);
                
                if (existingPost.category_id !== finalCategoryId) {
                    console.log(`📊 이전 카테고리 포스팅 수 업데이트 시작 - 카테고리 ID: ${existingPost.category_id}`);
                    await categoryTagManager.updateCategoryPostCount(existingPost.category_id);
                    console.log(`📊 이전 카테고리 포스팅 수 업데이트 완료 - 카테고리 ID: ${existingPost.category_id}`);
                }
            } catch (error) {
                console.warn(`⚠️ 카테고리 포스팅 수 업데이트 실패 (무시): ${error.message}`);
            }
        }

        // 업데이트된 포스트 정보 가져오기
        console.log(`📖 업데이트된 포스트 정보 조회 시작 - ID: ${id}`);
        const updatedPost = await nutritionDataManager.getNutritionInfoById(id);
        console.log(`📖 업데이트된 포스트 정보 조회 완료 - ID: ${id}`);

        console.log(`✅ 포스팅 수정: ${id} (by ${adminInfo.name})`);

        res.json({
            success: true,
            data: updatedPost ? (typeof updatedPost.toJSON === 'function' ? updatedPost.toJSON() : updatedPost) : null,
            message: '포스팅이 수정되었습니다.'
        });

    } catch (error) {
        console.error('❌ 포스팅 수정 오류:', error);
        console.error('❌ 오류 스택:', error.stack);
        res.status(500).json({
            success: false,
            error: '포스팅 수정 중 오류가 발생했습니다.',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * 포스팅 삭제 API
 * DELETE /api/admin/manual-posting/posts/:id
 */
router.delete('/posts/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // 포스팅 존재 확인
        const existingPost = await nutritionDataManager.getNutritionInfoById(id);
        if (!existingPost) {
            return res.status(404).json({
                success: false,
                error: '해당 포스팅을 찾을 수 없습니다.'
            });
        }

        // 포스팅 삭제
        const deleteResult = await nutritionDataManager.deleteNutritionInfo(id);
        
        if (!deleteResult) {
            return res.status(500).json({
                success: false,
                error: '포스팅 삭제에 실패했습니다.'
            });
        }

        console.log(`🗑️ 포스팅 삭제: ${id} (by ${req.session.user.username || req.session.user.name})`);

        res.json({
            success: true,
            message: '포스팅이 삭제되었습니다.'
        });

    } catch (error) {
        console.error('포스팅 삭제 오류:', error);
        res.status(500).json({
            success: false,
            error: '포스팅 삭제 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 포스팅 상태 토글 API
 * PUT /api/admin/manual-posting/posts/:id/toggle
 */
router.put('/posts/:id/toggle', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // 포스팅 존재 확인
        const existingPost = await nutritionDataManager.getNutritionInfoById(id);
        if (!existingPost) {
            return res.status(404).json({
                success: false,
                error: '해당 포스팅을 찾을 수 없습니다.'
            });
        }

        const existingData = typeof existingPost.toJSON === 'function' ? existingPost.toJSON() : existingPost;

        // 임시저장 상태인 경우 토글 불가 (로컬 데이터에서는 일반적으로 is_draft가 없으므로 스킵)
        // if (existingData.is_draft) {
        //     return res.status(400).json({
        //         success: false,
        //         error: '임시저장 상태의 포스팅은 상태를 변경할 수 없습니다. 먼저 게시해주세요.'
        //     });
        // }

        // 관리자 정보
        const adminInfo = {
            id: req.session.user.id,
            name: req.session.user.username || req.session.user.name || 'Admin'
        };

        // 상태 토글
        const newStatus = !existingData.isActive;
        const updates = {
            is_active: newStatus
        };

        const updateResult = await nutritionDataManager.updateNutritionInfo(id, updates);
        
        if (!updateResult) {
            return res.status(500).json({
                success: false,
                error: '포스팅 상태 변경에 실패했습니다.'
            });
        }

        // 업데이트된 포스트 정보 가져오기
        const updatedPost = await nutritionDataManager.getNutritionInfoById(id);

        const statusText = newStatus ? '활성화' : '비활성화';
        console.log(`🔄 포스팅 상태 변경: ${id} -> ${statusText} (by ${adminInfo.name})`);

        res.json({
            success: true,
            data: updatedPost ? (typeof updatedPost.toJSON === 'function' ? updatedPost.toJSON() : updatedPost) : null,
            message: `포스팅이 ${statusText}되었습니다.`
        });

    } catch (error) {
        console.error('포스팅 상태 토글 오류:', error);
        res.status(500).json({
            success: false,
            error: '포스팅 상태 변경 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 포스팅 상세 조회 API (관리자용)
 * GET /api/admin/manual-posting/posts/:id
 */
router.get('/posts/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const post = await nutritionDataManager.getNutritionInfoById(id);
        if (!post) {
            return res.status(404).json({
                success: false,
                error: '해당 포스팅을 찾을 수 없습니다.'
            });
        }

        // 관리자용 형식으로 변환 (프론트엔드 호환성 고려)
        const postData = typeof post.toJSON === 'function' ? post.toJSON() : post;
        const isActive = postData.isActive !== false && postData.is_active !== false;
        
        // 카테고리 한국어 이름 변환
        const categoryMap = {
            'eye_health': '눈 건강',
            'research': '연구',
            'diet': '다이어트',
            'trends': '트렌드',
            'supplements': '보충제',
            'omega': '오메가',
            'brain_health': '뇌 건강',
            'heart_health': '심장 건강',
            'bone_health': '뼈 건강',
            'immunity': '면역력',
            'cancer': '암 예방',
            'cardiovascular': '심혈관',
            'diabetes': '당뇨',
            'weight_management': '체중 관리',
            'vitamins': '비타민',
            'minerals': '미네랄',
            'protein': '단백질',
            'carbs': '탄수화물',
            'fats': '지방',
            'news': '뉴스',
            'calcium': '칼슘',
            'iron': '철분',
            'probiotics': '프로바이오틱스',
            'exercise_nutrition': '운동 영양',
            'general': '일반'
        };
        const categoryKorean = postData.category ? (categoryMap[postData.category] || postData.category) : '미분류';
        
        // 태그 데이터를 프론트엔드가 기대하는 형식으로 변환
        const tags = postData.tags || [];
        console.log(`📝 포스팅 조회 - 태그 데이터:`, tags);
        const postTags = tags.map(tag => ({
            tags: {
                name: tag
            }
        }));
        console.log(`📝 포스팅 조회 - 변환된 post_tags:`, postTags);
        console.log(`📝 포스팅 조회 - 관련상품 데이터:`, postData.related_products);

        const formattedPost = {
            id: postData.id,
            title: postData.title,
            summary: postData.summary,
            content: postData.content,
            category: categoryKorean,
            category_name: categoryKorean,
            categories: {
                name: categoryKorean
            },
            tags: tags,
            post_tags: postTags, // 프론트엔드가 기대하는 형식
            related_products: postData.related_products || [], // 관련상품 데이터
            source_type: postData.sourceType || postData.source_type,
            source_name: postData.sourceName || postData.source_name,
            source_url: postData.sourceUrl || postData.source_url,
            trust_score: postData.trustScore || postData.trust_score,
            view_count: postData.viewCount || postData.view_count || 0,
            thumbnail_url: postData.thumbnailUrl || postData.thumbnail_url,
            image_url: postData.imageUrl || postData.image_url,
            published_date: postData.publishedDate || postData.published_date,
            collected_date: postData.collectedDate || postData.collected_date,
            created_at: postData.createdAt || postData.created_at || postData.publishedDate || postData.published_date,
            updated_at: postData.updatedAt || postData.updated_at || postData.collectedDate || postData.collected_date,
            is_active: isActive,
            is_draft: false,
            status: isActive ? 'active' : 'inactive'
        };

        // 관리자만 자신의 포스팅을 조회할 수 있도록 제한 (선택사항)
        // if (post.admin_id !== req.session.user.id) {
        //     return res.status(403).json({
        //         success: false,
        //         error: '해당 포스팅에 접근할 권한이 없습니다.'
        //     });
        // }

        res.json({
            success: true,
            data: formattedPost
        });

    } catch (error) {
        console.error('포스팅 상세 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '포스팅 조회 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 관리자 포스팅 목록 조회 API
 * GET /api/admin/manual-posting/posts
 */
router.get('/posts', requireAdmin, async (req, res) => {
    try {
        const {
            status,
            categoryId,
            search,
            page = 1,
            limit = 20
        } = req.query;

        const adminId = req.session.user.id;

        // 필터 옵션 준비
        const filters = {};
        if (status) filters.status = status;
        if (categoryId) filters.categoryId = categoryId;
        if (search) filters.search = search;

        // 로컬 데이터에서 영양정보 목록 조회
        const nutritionFilters = {};
        if (search) nutritionFilters.search = search;
        if (categoryId) {
            // categoryId를 카테고리 이름으로 변환 (필요시)
            nutritionFilters.category = categoryId;
        }
        
        // 임시저장이 아닌 포스팅만 조회 (관리자 포스팅 목록용)
        nutritionFilters.excludeDrafts = true;
        
        const pagination = {
            page: parseInt(page),
            limit: parseInt(limit)
        };

        const result = await nutritionDataManager.getNutritionInfoList(nutritionFilters, pagination);
        const posts = result && result.data ? result.data : [];
        const paginationData = result && result.pagination ? result.pagination : {};
        
        console.log('🔍 관리자 포스팅 목록 조회 결과:', {
            totalPosts: posts.length,
            filters: nutritionFilters,
            pagination: paginationData,
            firstPost: posts[0] ? { id: posts[0].id, title: posts[0].title } : null
        });

        // 카테고리 정보 로드 (한국어 이름 변환용)
        const categoryMap = {
            'eye_health': '눈 건강',
            'research': '연구',
            'diet': '다이어트',
            'trends': '트렌드',
            'supplements': '보충제',
            'omega': '오메가',
            'brain_health': '뇌 건강',
            'heart_health': '심장 건강',
            'bone_health': '뼈 건강',
            'immunity': '면역력',
            'cancer': '암 예방',
            'cardiovascular': '심혈관',
            'diabetes': '당뇨',
            'weight_management': '체중 관리',
            'vitamins': '비타민',
            'minerals': '미네랄',
            'protein': '단백질',
            'carbs': '탄수화물',
            'fats': '지방',
            'news': '뉴스',
            'calcium': '칼슘',
            'iron': '철분',
            'probiotics': '프로바이오틱스',
            'exercise_nutrition': '운동 영양',
            'general': '일반'
        };

        // 관리자용 형식으로 변환 (프론트엔드 호환성 고려)
        const paginatedPosts = posts.map(item => {
            const itemData = typeof item.toJSON === 'function' ? item.toJSON() : item;
            const isActive = itemData.isActive !== false && itemData.is_active !== false;
            const categoryKorean = itemData.category ? (categoryMap[itemData.category] || itemData.category) : '미분류';
            
            return {
                id: itemData.id,
                title: itemData.title,
                summary: itemData.summary,
                content: itemData.content,
                category: categoryKorean,
                category_name: categoryKorean,
                categories: {
                    name: categoryKorean
                },
                tags: itemData.tags || [],
                source_type: itemData.sourceType || itemData.source_type,
                source_name: itemData.sourceName || itemData.source_name,
                source_url: itemData.sourceUrl || itemData.source_url,
                trust_score: itemData.trustScore || itemData.trust_score,
                view_count: itemData.viewCount || itemData.view_count || 0,
                thumbnail_url: itemData.thumbnailUrl || itemData.thumbnail_url,
                image_url: itemData.imageUrl || itemData.image_url,
                published_date: itemData.publishedDate || itemData.published_date,
                collected_date: itemData.collectedDate || itemData.collected_date,
                created_at: itemData.createdAt || itemData.created_at || itemData.publishedDate || itemData.published_date,
                updated_at: itemData.updatedAt || itemData.updated_at || itemData.collectedDate || itemData.collected_date,
                is_active: isActive,
                is_draft: false,
                status: isActive ? 'active' : 'inactive'
            };
        });

        res.json({
            success: true,
            data: {
                posts: paginatedPosts,
                pagination: {
                    currentPage: paginationData.page || parseInt(page),
                    totalPages: paginationData.totalPages || 0,
                    totalItems: paginationData.totalCount || 0,
                    itemsPerPage: paginationData.limit || parseInt(limit)
                }
            }
        });

    } catch (error) {
        console.error('포스팅 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '포스팅 목록 조회 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// ==================== 임시저장 관리 API ====================

/**
 * 임시저장 API
 * POST /api/admin/manual-posting/drafts
 */
router.post('/drafts', requireAdmin, async (req, res) => {
    try {
        // 임시저장은 포스팅 생성과 동일하지만 isDraft = true
        req.body.isDraft = true;
        
        // 포스팅 생성 로직 재사용
        return router.handle({ method: 'POST', url: '/posts', ...req }, res);

    } catch (error) {
        console.error('임시저장 오류:', error);
        res.status(500).json({
            success: false,
            error: '임시저장 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 임시저장 목록 조회 API
 * GET /api/admin/manual-posting/drafts
 */
router.get('/drafts', requireAdmin, async (req, res) => {
    try {
        const adminId = req.session.user.id;

        // 임시저장 목록 조회
        const drafts = await nutritionDataManager.getDrafts(adminId);

        res.json({
            success: true,
            data: drafts
        });

    } catch (error) {
        console.error('임시저장 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '임시저장 목록 조회 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 임시저장 삭제 API
 * DELETE /api/admin/manual-posting/drafts/:id
 */
router.delete('/drafts/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // 임시저장 포스팅인지 확인
        const post = await nutritionDataManager.getPostById(id);
        if (!post) {
            return res.status(404).json({
                success: false,
                error: '해당 임시저장을 찾을 수 없습니다.'
            });
        }

        if (!post.is_draft) {
            return res.status(400).json({
                success: false,
                error: '임시저장 상태의 포스팅만 삭제할 수 있습니다.'
            });
        }

        // 임시저장 삭제
        await nutritionDataManager.deletePost(id);

        console.log(`🗑️ 임시저장 삭제: ${id} (by ${req.session.user.username || req.session.user.name})`);

        res.json({
            success: true,
            message: '임시저장이 삭제되었습니다.'
        });

    } catch (error) {
        console.error('임시저장 삭제 오류:', error);
        res.status(500).json({
            success: false,
            error: '임시저장 삭제 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// ==================== 카테고리 및 태그 관리 API ====================

/**
 * 카테고리 목록 조회 API
 * GET /api/admin/manual-posting/categories
 */
router.get('/categories', requireAdmin, async (req, res) => {
    try {
        const categories = await categoryTagManager.getCategories();

        res.json({
            success: true,
            data: categories
        });

    } catch (error) {
        console.error('카테고리 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '카테고리 목록 조회 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 카테고리 생성 API
 * POST /api/admin/manual-posting/categories
 */
router.post('/categories', requireAdmin, async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                error: '카테고리 이름은 필수입니다.'
            });
        }

        const categoryData = {
            name: name.trim(),
            description: description ? description.trim() : null
        };

        const newCategory = await categoryTagManager.addCategory(categoryData);

        console.log(`✅ 새 카테고리 생성: ${newCategory.name} (by ${req.session.user.username || req.session.user.name})`);

        res.status(201).json({
            success: true,
            data: newCategory,
            message: '카테고리가 생성되었습니다.'
        });

    } catch (error) {
        console.error('카테고리 생성 오류:', error);
        res.status(500).json({
            success: false,
            error: '카테고리 생성 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 카테고리 수정 API
 * PUT /api/admin/manual-posting/categories/:id
 */
router.put('/categories/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        const updates = {};
        if (name !== undefined) updates.name = name.trim();
        if (description !== undefined) updates.description = description ? description.trim() : null;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                error: '수정할 내용이 없습니다.'
            });
        }

        const updatedCategory = await categoryTagManager.updateCategory(id, updates);

        console.log(`✅ 카테고리 수정: ${id} (by ${req.session.user.username || req.session.user.name})`);

        res.json({
            success: true,
            data: updatedCategory,
            message: '카테고리가 수정되었습니다.'
        });

    } catch (error) {
        console.error('카테고리 수정 오류:', error);
        res.status(500).json({
            success: false,
            error: '카테고리 수정 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 카테고리 삭제 API
 * DELETE /api/admin/manual-posting/categories/:id
 */
router.delete('/categories/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        await categoryTagManager.deleteCategory(id);

        console.log(`🗑️ 카테고리 삭제: ${id} (by ${req.session.user.username || req.session.user.name})`);

        res.json({
            success: true,
            message: '카테고리가 삭제되었습니다.'
        });

    } catch (error) {
        console.error('카테고리 삭제 오류:', error);
        res.status(500).json({
            success: false,
            error: '카테고리 삭제 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 태그 목록 조회 API
 * GET /api/admin/manual-posting/tags
 */
router.get('/tags', requireAdmin, async (req, res) => {
    try {
        const { search, limit, sortBy } = req.query;

        const options = {};
        if (search) options.search = search;
        if (limit) options.limit = parseInt(limit);
        if (sortBy) options.sortBy = sortBy;

        const tags = await categoryTagManager.getTags(options);

        res.json({
            success: true,
            data: tags
        });

    } catch (error) {
        console.error('태그 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '태그 목록 조회 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 태그 자동 완성 API
 * GET /api/admin/manual-posting/tags/suggestions
 */
router.get('/tags/suggestions', requireAdmin, async (req, res) => {
    try {
        const { q, limit = 10 } = req.query;

        if (!q || q.trim().length === 0) {
            return res.json({
                success: true,
                data: []
            });
        }

        const suggestions = await categoryTagManager.getTagSuggestions(q.trim(), parseInt(limit));

        res.json({
            success: true,
            data: suggestions
        });

    } catch (error) {
        console.error('태그 자동 완성 오류:', error);
        res.status(500).json({
            success: false,
            error: '태그 자동 완성 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 관련 태그 추천 API
 * POST /api/admin/manual-posting/tags/related
 */
router.post('/tags/related', requireAdmin, async (req, res) => {
    try {
        const { tags, limit = 5 } = req.body;

        if (!Array.isArray(tags) || tags.length === 0) {
            return res.json({
                success: true,
                data: []
            });
        }

        const relatedTags = await categoryTagManager.getRelatedTags(tags, parseInt(limit));

        res.json({
            success: true,
            data: relatedTags
        });

    } catch (error) {
        console.error('관련 태그 추천 오류:', error);
        res.status(500).json({
            success: false,
            error: '관련 태그 추천 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// ==================== 이미지 업로드 및 URL 검증 API ====================

/**
 * 이미지 업로드 API
 * POST /api/admin/manual-posting/upload-image
 */
router.post('/upload-image', requireAdmin, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: '이미지 파일이 필요합니다.'
            });
        }

        // 이미지 업로드
        const uploadResult = await imageManager.uploadImage(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
        );

        if (!uploadResult.success) {
            return res.status(400).json({
                success: false,
                error: uploadResult.error
            });
        }

        console.log(`📷 이미지 업로드: ${uploadResult.fileName} (by ${req.session.user.username || req.session.user.name})`);

        res.json({
            success: true,
            data: {
                url: uploadResult.url,
                fileName: uploadResult.fileName,
                filePath: uploadResult.filePath
            },
            message: '이미지가 업로드되었습니다.'
        });

    } catch (error) {
        console.error('이미지 업로드 오류:', error);
        res.status(500).json({
            success: false,
            error: '이미지 업로드 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 썸네일 이미지 업로드 API
 * POST /api/admin/manual-posting/upload-thumbnail
 */
router.post('/upload-thumbnail', requireAdmin, upload.single('thumbnail'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: '썸네일 이미지 파일이 필요합니다.'
            });
        }

        // 썸네일 이미지 업로드 (nutrition-thumbnail 폴더에 저장)
        const uploadResult = await imageManager.uploadImage(
            req.file.buffer,
            `thumbnail_${Date.now()}_${req.file.originalname}`,
            req.file.mimetype,
            'nutrition-thumbnails' // 썸네일 전용 폴더
        );

        if (!uploadResult.success) {
            return res.status(400).json({
                success: false,
                error: uploadResult.error
            });
        }

        console.log(`🖼️ 썸네일 업로드: ${uploadResult.fileName} (by ${req.session.user.username || req.session.user.name})`);

        res.json({
            success: true,
            data: {
                url: uploadResult.url,
                fileName: uploadResult.fileName,
                filePath: uploadResult.filePath
            },
            message: '썸네일 이미지가 업로드되었습니다.'
        });

    } catch (error) {
        console.error('썸네일 업로드 오류:', error);
        res.status(500).json({
            success: false,
            error: '썸네일 업로드 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * URL 검증 API
 * POST /api/admin/manual-posting/validate-url
 */
router.post('/validate-url', requireAdmin, async (req, res) => {
    try {
        const { url } = req.body;

        if (!url || !url.trim()) {
            return res.status(400).json({
                success: false,
                error: 'URL이 필요합니다.'
            });
        }

        const trimmedUrl = url.trim();

        // URL 형식 검증
        try {
            new URL(trimmedUrl);
        } catch (urlError) {
            return res.json({
                success: false,
                valid: false,
                error: '유효하지 않은 URL 형식입니다.'
            });
        }

        // HTTP/HTTPS 프로토콜 확인
        if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
            return res.json({
                success: false,
                valid: false,
                error: 'HTTP 또는 HTTPS 프로토콜만 지원됩니다.'
            });
        }

        // URL 접근 가능성 확인
        try {
            const response = await axios.head(trimmedUrl, {
                timeout: 10000,
                maxRedirects: 5,
                validateStatus: (status) => status < 500 // 5xx 에러만 실패로 처리
            });

            const isAccessible = response.status >= 200 && response.status < 400;

            res.json({
                success: true,
                valid: isAccessible,
                data: {
                    url: trimmedUrl,
                    statusCode: response.status,
                    accessible: isAccessible,
                    contentType: response.headers['content-type'] || null,
                    lastModified: response.headers['last-modified'] || null
                },
                message: isAccessible ? 'URL이 유효합니다.' : 'URL에 접근할 수 없습니다.'
            });

        } catch (error) {
            // 네트워크 오류나 타임아웃의 경우
            res.json({
                success: true,
                valid: false,
                data: {
                    url: trimmedUrl,
                    accessible: false,
                    error: error.message
                },
                message: 'URL에 접근할 수 없습니다.'
            });
        }

    } catch (error) {
        console.error('URL 검증 오류:', error);
        res.status(500).json({
            success: false,
            error: 'URL 검증 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 포스팅 통계 조회 API
 * GET /api/admin/manual-posting/stats
 */
router.get('/stats', requireAdmin, async (req, res) => {
    try {
        console.log('📊 포스팅 통계 조회 시작...');
        
        // 전체 포스팅 수 조회 (모든 상태 포함)
        const allPosts = await nutritionDataManager.getNutritionInfoList({}, { page: 1, limit: 1000 });
        const totalPosts = allPosts && allPosts.data ? allPosts.data.length : 0;
        console.log('📊 전체 포스팅 수:', totalPosts);
        
        // 게시된 포스팅 수 (활성화되고 임시저장이 아닌 포스팅)
        const publishedPosts = await nutritionDataManager.getNutritionInfoList(
            { excludeDrafts: true, activeOnly: true }, 
            { page: 1, limit: 1000 }
        );
        const publishedCount = publishedPosts && publishedPosts.data ? publishedPosts.data.length : 0;
        console.log('📊 게시된 포스팅 수:', publishedCount);
        
        // 임시저장 포스팅 수 (draft 상태)
        const draftPosts = await nutritionDataManager.getNutritionInfoList(
            { draftsOnly: true }, 
            { page: 1, limit: 1000 }
        );
        const draftCount = draftPosts && draftPosts.data ? draftPosts.data.length : 0;
        console.log('📊 임시저장 포스팅 수:', draftCount);
        
        // 비활성 포스팅 수 (비활성화된 포스팅, 임시저장 제외)
        const inactivePosts = await nutritionDataManager.getNutritionInfoList(
            { excludeDrafts: true, inactiveOnly: true }, 
            { page: 1, limit: 1000 }
        );
        const inactiveCount = inactivePosts && inactivePosts.data ? inactivePosts.data.length : 0;
        console.log('📊 비활성 포스팅 수:', inactiveCount);

        // 데이터베이스에서 직접 조회하는 방법으로 변경
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
        
        // 전체 포스팅 수
        const { count: totalCount } = await supabase
            .from('nutrition_posts')
            .select('*', { count: 'exact', head: true });
        
        // 게시된 포스팅 수 (is_draft = false, is_active = true)
        const { count: publishedCountDB } = await supabase
            .from('nutrition_posts')
            .select('*', { count: 'exact', head: true })
            .eq('is_draft', false)
            .eq('is_active', true);
        
        // 임시저장 포스팅 수 (is_draft = true)
        const { count: draftCountDB } = await supabase
            .from('nutrition_posts')
            .select('*', { count: 'exact', head: true })
            .eq('is_draft', true);
        
        // 비활성 포스팅 수 (is_draft = false, is_active = false)
        const { count: inactiveCountDB } = await supabase
            .from('nutrition_posts')
            .select('*', { count: 'exact', head: true })
            .eq('is_draft', false)
            .eq('is_active', false);

        // 오늘 조회수 집계
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];
        
        const { data: todayViewsData } = await supabase
            .from('nutrition_post_views')
            .select('view_count')
            .gte('viewed_at', todayStr);
        
        const todayViews = todayViewsData?.reduce((sum, item) => sum + (item.view_count || 1), 0) || 0;

        const stats = {
            totalPosts: totalCount || 0,
            publishedPosts: publishedCountDB || 0,
            draftPosts: draftCountDB || 0,
            inactivePosts: inactiveCountDB || 0,
            todayViews: todayViews
        };

        console.log('📊 최종 통계:', stats);

        res.json({
            success: true,
            stats: stats
        });

    } catch (error) {
        console.error('포스팅 통계 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '포스팅 통계를 조회하는 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 조회수 분석 데이터 조회 API (최근 7일)
 * GET /api/admin/manual-posting/views-analytics?days=7
 */
router.get('/views-analytics', requireAdmin, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        console.log(`📊 조회수 분석 데이터 조회 시작 (최근 ${days}일)...`);

        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

        // 최근 N일 날짜 범위 계산 (오늘 포함, 한국 시간 기준)
        // 한국 시간으로 오늘 날짜 계산
        const now = new Date();
        const kstOffset = 9 * 60 * 60 * 1000; // 9시간을 밀리초로
        const kstNow = new Date(now.getTime() + kstOffset);
        
        // 한국 시간 기준 오늘 00:00:00
        const kstToday = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate());
        
        // N일 전 날짜 (한국 시간 기준)
        const kstStartDate = new Date(kstToday);
        kstStartDate.setDate(kstStartDate.getDate() - (days - 1));

        console.log(`📊 조회 기간 (KST): ${kstStartDate.toISOString().split('T')[0]} ~ ${kstToday.toISOString().split('T')[0]}`);

        // 최근 N일 일별 조회수 집계 (오늘 포함)
        const chartData = [];
        for (let i = 0; i < days; i++) {
            // 한국 시간 기준 해당 날짜
            const kstDate = new Date(kstStartDate);
            kstDate.setDate(kstDate.getDate() + i);
            
            // UTC로 변환 (한국 시간 00:00:00 -> UTC)
            const utcStartOfDay = new Date(kstDate.getTime() - kstOffset);
            const utcEndOfDay = new Date(utcStartOfDay.getTime() + 24 * 60 * 60 * 1000);
            
            // 마지막 날(오늘)인 경우 현재 시각까지만
            const isToday = i === days - 1;
            const endTime = isToday ? now.toISOString() : utcEndOfDay.toISOString();
            
            const dateStr = kstDate.toISOString().split('T')[0];

            console.log(`📅 날짜 (KST): ${dateStr}, UTC 범위: ${utcStartOfDay.toISOString()} ~ ${endTime}`);

            // 해당 날짜의 조회수 집계
            const { data: viewsData } = await supabase
                .from('nutrition_post_views')
                .select('view_count')
                .gte('viewed_at', utcStartOfDay.toISOString())
                .lt('viewed_at', endTime);

            const totalViews = viewsData?.reduce((sum, item) => sum + (item.view_count || 1), 0) || 0;

            console.log(`📊 ${dateStr} (KST): ${totalViews}회 (레코드 ${viewsData?.length || 0}개)`);

            chartData.push({
                date: dateStr,
                views: totalViews
            });
        }

        // TOP 10 조회수 포스팅 조회 (전체 기간)
        const { data: topPostsData } = await supabase
            .from('nutrition_posts')
            .select(`
                id,
                title,
                view_count,
                categories:category_id (
                    name
                )
            `)
            .eq('is_active', true)
            .eq('is_draft', false)
            .order('view_count', { ascending: false })
            .limit(10);

        const topPosts = topPostsData?.map(post => ({
            id: post.id,
            title: post.title,
            view_count: post.view_count || 0,
            category: post.categories?.name || '미분류'
        })) || [];

        console.log('📊 조회수 분석 데이터 조회 완료');

        res.json({
            success: true,
            chartData: chartData,
            topPosts: topPosts
        });

    } catch (error) {
        console.error('❌ 조회수 분석 데이터 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '조회수 분석 데이터를 조회하는 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 오늘 조회수 상세 데이터 조회 API
 * GET /api/admin/manual-posting/today-views-detail
 */
router.get('/today-views-detail', requireAdmin, async (req, res) => {
    try {
        console.log('📊 오늘 조회수 상세 데이터 조회 시작...');

        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

        // 오늘 날짜 범위 계산
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        // 오늘 조회된 포스팅별 조회수 집계
        const { data: viewsData } = await supabase
            .from('nutrition_post_views')
            .select(`
                post_id,
                view_count,
                nutrition_posts:post_id (
                    id,
                    title,
                    categories:category_id (
                        name
                    )
                )
            `)
            .gte('viewed_at', todayStr)
            .lt('viewed_at', tomorrowStr);

        // 포스팅별 조회수 합산
        const postsMap = new Map();
        viewsData?.forEach(view => {
            const post = view.nutrition_posts;
            if (!post) return;

            const postId = post.id;
            if (!postsMap.has(postId)) {
                postsMap.set(postId, {
                    id: postId,
                    title: post.title,
                    category: post.categories?.name || '미분류',
                    todayViews: 0
                });
            }
            postsMap.get(postId).todayViews += (view.view_count || 1);
        });

        // Map을 배열로 변환하고 조회수로 정렬
        const posts = Array.from(postsMap.values()).sort((a, b) => b.todayViews - a.todayViews);
        const totalViews = posts.reduce((sum, post) => sum + post.todayViews, 0);

        console.log('📊 오늘 조회수 상세 데이터 조회 완료:', {
            totalViews,
            postsCount: posts.length
        });

        res.json({
            success: true,
            data: {
                totalViews: totalViews,
                posts: posts
            }
        });

    } catch (error) {
        console.error('❌ 오늘 조회수 상세 데이터 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '오늘 조회수 상세 데이터를 조회하는 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

module.exports = router;