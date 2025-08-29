/**
 * 영양 정보 관리자 API 라우터
 * Requirements: 7.1, 7.2, 7.3
 */

const express = require('express');
const router = express.Router();
const SupabaseNutritionDataManager = require('../utils/supabaseNutritionDataManager');
const { supabase } = require('../utils/supabaseClient');
const PermanentStorageManager = require('../utils/permanentStorageManager');

// Supabase 영양 정보 데이터 매니저 인스턴스
const nutritionDataManager = new SupabaseNutritionDataManager();

// 영구 저장소 관리자 인스턴스
const permanentStorageManager = new PermanentStorageManager();

// 관리자 권한 확인 미들웨어
function requireAdmin(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            error: '로그인이 필요합니다.'
        });
    }

    // 관리자 권한 확인 (임시로 특정 사용자 ID나 username으로 확인)
    const isAdmin = req.session.user.username === 'admin' ||
        req.session.user.id === '1' ||
        req.session.user.isAdmin === true;

    if (!isAdmin) {
        return res.status(403).json({
            success: false,
            error: '관리자 권한이 필요합니다.'
        });
    }

    next();
}

/**
 * 수집 통계 조회 API
 * GET /api/admin/nutrition-info/stats
 */
router.get('/stats', requireAdmin, async (req, res) => {
    try {
        // 기본 통계 정보 수집
        const basicStats = await nutritionDataManager.getStatistics();

        // 최근 수집 활동 정보
        const recentActivity = await getRecentCollectionActivity();

        // 품질 지표 계산
        const qualityMetrics = await calculateQualityMetrics();

        // 소스별 성능 지표
        const sourcePerformance = await getSourcePerformanceMetrics();

        // 시스템 상태 정보
        const systemStatus = await getSystemStatus();

        const stats = {
            // 기본 통계
            totalItems: basicStats.totalItems,
            activeItems: basicStats.activeItems,
            inactiveItems: basicStats.totalItems - basicStats.activeItems,

            // 카테고리별 분포
            byCategory: basicStats.byCategory,

            // 소스별 분포
            bySourceType: basicStats.bySourceType,

            // 최근 활동
            recentActivity: {
                lastCollection: recentActivity.lastCollection,
                collectionsToday: recentActivity.collectionsToday,
                collectionsThisWeek: recentActivity.collectionsThisWeek,
                recentErrors: recentActivity.recentErrors
            },

            // 품질 지표
            quality: {
                averageTrustScore: qualityMetrics.averageTrustScore,
                highQualityItems: qualityMetrics.highQualityItems,
                lowQualityItems: qualityMetrics.lowQualityItems,
                duplicatesDetected: qualityMetrics.duplicatesDetected
            },

            // 소스별 성능
            sourcePerformance: sourcePerformance,

            // 시스템 상태
            systemStatus: systemStatus,

            // 생성 시간
            generatedAt: new Date().toISOString()
        };

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('수집 통계 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '수집 통계를 조회하는 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 수동 수집 트리거 API
 * POST /api/admin/nutrition-info/collect
 */
router.post('/collect', requireAdmin, async (req, res) => {
    try {
        const {
            sources = ['pubmed', 'youtube', 'news'],
            keywords = [],
            maxResults = 20,
            immediate = true
        } = req.body;

        // 입력 검증
        if (!Array.isArray(sources) || sources.length === 0) {
            return res.status(400).json({
                success: false,
                error: '수집할 소스를 지정해야 합니다.'
            });
        }

        const validSources = ['pubmed', 'youtube', 'news'];
        const invalidSources = sources.filter(source => !validSources.includes(source));
        if (invalidSources.length > 0) {
            return res.status(400).json({
                success: false,
                error: `유효하지 않은 소스: ${invalidSources.join(', ')}`
            });
        }

        // Content Aggregator 초기화 (필요시)
        if (!contentAggregator) {
            contentAggregator = new ContentAggregator({
                youtube: process.env.YOUTUBE_API_KEY,
                news: process.env.NEWS_API_KEY
            });
        }

        const collectionId = `manual_${Date.now()}`;
        const startTime = Date.now();

        console.log(`🚀 수동 수집 시작 (ID: ${collectionId})`);
        console.log(`   소스: ${sources.join(', ')}`);
        console.log(`   키워드: ${Array.isArray(keywords) && keywords.length > 0 ? keywords.join(', ') : '기본 키워드 사용'}`);

        if (immediate) {
            // 즉시 실행
            const result = await executeManualCollection(sources, keywords, maxResults, collectionId);
            const duration = Date.now() - startTime;

            res.json({
                success: true,
                data: {
                    collectionId,
                    duration,
                    ...result
                }
            });
        } else {
            // 백그라운드에서 실행
            executeManualCollection(sources, keywords, maxResults, collectionId)
                .then(result => {
                    console.log(`✅ 백그라운드 수집 완료 (ID: ${collectionId}):`, result);
                })
                .catch(error => {
                    console.error(`❌ 백그라운드 수집 실패 (ID: ${collectionId}):`, error);
                });

            res.json({
                success: true,
                data: {
                    collectionId,
                    status: 'started',
                    message: '수집이 백그라운드에서 시작되었습니다.'
                }
            });
        }

    } catch (error) {
        console.error('수동 수집 트리거 오류:', error);
        res.status(500).json({
            success: false,
            error: '수동 수집을 시작하는 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 콘텐츠 상태 변경 API - Supabase 버전
 * PUT /api/admin/nutrition-info/:id/status
 */
router.put('/:id/status', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;

        // 입력 검증
        if (!status) {
            return res.status(400).json({
                success: false,
                error: 'status 필드가 필요합니다.'
            });
        }

        const validStatuses = ['active', 'inactive', 'pending', 'rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `유효하지 않은 상태: ${status}. 가능한 값: ${validStatuses.join(', ')}`
            });
        }

        // Supabase에서 영양 정보 존재 확인
        const { data: nutritionInfo, error: fetchError } = await supabase
            .from('nutrition_posts')
            .select('id, title, is_active')
            .eq('id', id)
            .single();

        if (fetchError || !nutritionInfo) {
            return res.status(404).json({
                success: false,
                error: '해당 영양 정보를 찾을 수 없습니다.'
            });
        }

        // 상태 업데이트
        const updateData = {
            is_active: status === 'active',
            updated_at: new Date().toISOString()
        };

        const { error: updateError } = await supabase
            .from('nutrition_posts')
            .update(updateData)
            .eq('id', id);

        if (updateError) {
            console.error('상태 업데이트 오류:', updateError);
            throw updateError;
        }

        // 모든 관련 캐시 무효화
        await invalidateAllNutritionCaches();

        // 로그 기록
        console.log(`📝 영양 정보 상태 변경: ${id} -> ${status} (by ${req.session.user.username || req.session.user.id})`);
        if (reason) {
            console.log(`   사유: ${reason}`);
        }

        res.json({
            success: true,
            data: {
                id: id,
                previousStatus: nutritionInfo.is_active ? 'active' : 'inactive',
                newStatus: status,
                reason: reason,
                modifiedBy: req.session.user.username || req.session.user.id,
                modifiedAt: updateData.updated_at
            }
        });

    } catch (error) {
        console.error('콘텐츠 상태 변경 오류:', error);
        res.status(500).json({
            success: false,
            error: '콘텐츠 상태를 변경하는 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 영양 정보 삭제 API (관리자용) - Supabase 버전
 * DELETE /api/admin/nutrition-info/:id
 */
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { permanent = false } = req.body;

        console.log(`🔍 영양 정보 삭제 요청: ID=${id}, permanent=${permanent}`);

        // Supabase에서 영양 정보 존재 확인
        const { data: nutritionInfo, error: fetchError } = await supabase
            .from('nutrition_posts')
            .select('id, title, is_active')
            .eq('id', id)
            .single();

        if (fetchError || !nutritionInfo) {
            console.log(`❌ 영양 정보를 찾을 수 없음: ${id}`, fetchError);
            
            // 디버깅을 위해 현재 존재하는 데이터 확인
            const { data: allItems, error: listError } = await supabase
                .from('nutrition_posts')
                .select('id, title')
                .limit(10);
            
            console.log(`📊 현재 영양 정보 총 개수: ${allItems ? allItems.length : 0}`);
            
            if (allItems && allItems.length > 0) {
                console.log('📋 현재 존재하는 영양 정보 ID들:', allItems.map(item => item.id).slice(0, 5));
            }
            
            return res.status(404).json({
                success: false,
                error: '해당 영양 정보를 찾을 수 없습니다.',
                debug: {
                    requestedId: id,
                    totalItems: allItems ? allItems.length : 0,
                    availableIds: allItems ? allItems.map(item => item.id).slice(0, 5) : [],
                    fetchError: fetchError?.message
                }
            });
        }

        console.log(`✅ 영양 정보 찾음: ${nutritionInfo.title || 'No title'}`);

        if (permanent) {
            // 영구 삭제 - Supabase에서 실제 삭제
            const { error: deleteError } = await supabase
                .from('nutrition_posts')
                .delete()
                .eq('id', id);

            if (deleteError) {
                console.error('영구 삭제 오류:', deleteError);
                throw deleteError;
            }

            console.log(`🗑️ 영양 정보 영구 삭제: ${id} (by ${req.session.user.username || req.session.user.id})`);
        } else {
            // 비활성화 (소프트 삭제) - is_active를 false로 설정
            const { error: updateError } = await supabase
                .from('nutrition_posts')
                .update({
                    is_active: false,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (updateError) {
                console.error('비활성화 오류:', updateError);
                throw updateError;
            }

            console.log(`🗑️ 영양 정보 비활성화: ${id} (by ${req.session.user.username || req.session.user.id})`);
        }

        // 모든 관련 캐시 무효화
        await invalidateAllNutritionCaches();
        
        console.log('✅ 모든 영양 정보 캐시 무효화 완료');

        res.json({
            success: true,
            data: {
                id: id,
                action: permanent ? 'permanently_deleted' : 'deactivated',
                deletedBy: req.session.user.username || req.session.user.id,
                deletedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('영양 정보 삭제 오류:', error);
        res.status(500).json({
            success: false,
            error: '영양 정보를 삭제하는 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 수집 로그 조회 API
 * GET /api/admin/nutrition-info/logs
 */
router.get('/logs', requireAdmin, async (req, res) => {
    try {
        const {
            limit = 50,
            offset = 0,
            level = 'all',
            dateFrom,
            dateTo
        } = req.query;

        const logs = await getCollectionLogs({
            limit: parseInt(limit),
            offset: parseInt(offset),
            level,
            dateFrom,
            dateTo
        });

        res.json({
            success: true,
            data: logs
        });

    } catch (error) {
        console.error('수집 로그 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '수집 로그를 조회하는 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 영양 정보 편집 API - Supabase 버전
 * PUT /api/admin/nutrition-info/:id/edit
 */
router.put('/:id/edit', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, summary, category, tags, trustScore } = req.body;

        // 입력 검증
        if (!title && !summary && !category && !tags && trustScore === undefined) {
            return res.status(400).json({
                success: false,
                error: '수정할 필드를 지정해야 합니다.'
            });
        }

        // Supabase에서 영양 정보 존재 확인
        const { data: nutritionInfo, error: fetchError } = await supabase
            .from('nutrition_posts')
            .select('id, title')
            .eq('id', id)
            .single();

        if (fetchError || !nutritionInfo) {
            return res.status(404).json({
                success: false,
                error: '해당 영양 정보를 찾을 수 없습니다.'
            });
        }

        // 업데이트할 데이터 준비
        const updateData = {
            updated_at: new Date().toISOString()
        };

        if (title) updateData.title = title.trim();
        if (summary) updateData.summary = summary.trim();
        if (trustScore !== undefined) {
            const score = parseInt(trustScore);
            if (score >= 0 && score <= 100) {
                updateData.trust_score = score;
            } else {
                return res.status(400).json({
                    success: false,
                    error: '신뢰도 점수는 0-100 사이여야 합니다.'
                });
            }
        }

        // Supabase 업데이트
        const { error: updateError } = await supabase
            .from('nutrition_posts')
            .update(updateData)
            .eq('id', id);

        if (updateError) {
            console.error('편집 업데이트 오류:', updateError);
            throw updateError;
        }

        // 카테고리 및 태그 업데이트는 별도 처리 필요 (관계형 테이블)
        if (category) {
            // 카테고리 업데이트 로직 (실제 구현에서는 categories 테이블과 연동)
            console.log(`카테고리 업데이트 필요: ${category}`);
        }

        if (tags && Array.isArray(tags)) {
            // 태그 업데이트 로직 (실제 구현에서는 post_tags 테이블과 연동)
            console.log(`태그 업데이트 필요: ${tags.join(', ')}`);
        }

        // 모든 관련 캐시 무효화
        await invalidateAllNutritionCaches();

        console.log(`📝 영양 정보 편집: ${id} (by ${req.session.user.username || req.session.user.id})`);

        res.json({
            success: true,
            data: {
                id: id,
                updatedFields: Object.keys(updateData).filter(key => key !== 'updated_at'),
                modifiedBy: req.session.user.username || req.session.user.id,
                modifiedAt: updateData.updated_at
            }
        });

    } catch (error) {
        console.error('영양 정보 편집 오류:', error);
        res.status(500).json({
            success: false,
            error: '영양 정보를 편집하는 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 소스 차단 API
 * POST /api/admin/nutrition-info/block-source
 */
router.post('/block-source', requireAdmin, async (req, res) => {
    try {
        const { sourceUrl, sourceName, reason } = req.body;

        // 입력 검증
        if (!sourceUrl && !sourceName) {
            return res.status(400).json({
                success: false,
                error: 'sourceUrl 또는 sourceName 중 하나는 필수입니다.'
            });
        }

        // 차단된 소스 목록 관리 (실제 구현에서는 별도 파일이나 DB에 저장)
        const blockedSources = await getBlockedSources();

        const blockEntry = {
            id: `block_${Date.now()}`,
            sourceUrl: sourceUrl || null,
            sourceName: sourceName || null,
            reason: reason || '관리자에 의한 차단',
            blockedAt: new Date().toISOString(),
            blockedBy: req.session.user.username || req.session.user.id
        };

        blockedSources.push(blockEntry);
        await saveBlockedSources(blockedSources);

        // 해당 소스의 기존 영양 정보들을 비활성화
        const deactivatedCount = await deactivateNutritionInfoBySource(sourceUrl, sourceName);

        console.log(`🚫 소스 차단: ${sourceUrl || sourceName} (by ${req.session.user.username || req.session.user.id})`);
        console.log(`   비활성화된 영양 정보: ${deactivatedCount}개`);

        res.json({
            success: true,
            data: {
                blockId: blockEntry.id,
                sourceUrl: sourceUrl,
                sourceName: sourceName,
                reason: reason,
                deactivatedCount: deactivatedCount,
                blockedBy: req.session.user.username || req.session.user.id,
                blockedAt: blockEntry.blockedAt
            }
        });

    } catch (error) {
        console.error('소스 차단 오류:', error);
        res.status(500).json({
            success: false,
            error: '소스를 차단하는 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 차단된 소스 목록 조회 API
 * GET /api/admin/nutrition-info/blocked-sources
 */
router.get('/blocked-sources', requireAdmin, async (req, res) => {
    try {
        const blockedSources = await getBlockedSources();

        res.json({
            success: true,
            data: {
                blockedSources: blockedSources,
                total: blockedSources.length
            }
        });

    } catch (error) {
        console.error('차단된 소스 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '차단된 소스 목록을 조회하는 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 소스 차단 해제 API
 * DELETE /api/admin/nutrition-info/blocked-sources/:blockId
 */
router.delete('/blocked-sources/:blockId', requireAdmin, async (req, res) => {
    try {
        const { blockId } = req.params;

        const blockedSources = await getBlockedSources();
        const blockIndex = blockedSources.findIndex(block => block.id === blockId);

        if (blockIndex === -1) {
            return res.status(404).json({
                success: false,
                error: '해당 차단 항목을 찾을 수 없습니다.'
            });
        }

        const removedBlock = blockedSources.splice(blockIndex, 1)[0];
        await saveBlockedSources(blockedSources);

        console.log(`✅ 소스 차단 해제: ${removedBlock.sourceUrl || removedBlock.sourceName} (by ${req.session.user.username || req.session.user.id})`);

        res.json({
            success: true,
            data: {
                blockId: blockId,
                sourceUrl: removedBlock.sourceUrl,
                sourceName: removedBlock.sourceName,
                unblockedBy: req.session.user.username || req.session.user.id,
                unblockedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('소스 차단 해제 오류:', error);
        res.status(500).json({
            success: false,
            error: '소스 차단을 해제하는 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * 품질 관리 - 일괄 처리 API
 * POST /api/admin/nutrition-info/bulk-action
 */
router.post('/bulk-action', requireAdmin, async (req, res) => {
    try {
        const { action, ids, criteria } = req.body;

        // 입력 검증
        if (!action) {
            return res.status(400).json({
                success: false,
                error: 'action 필드가 필요합니다.'
            });
        }

        const validActions = ['activate', 'deactivate', 'delete', 'update_trust_score'];
        if (!validActions.includes(action)) {
            return res.status(400).json({
                success: false,
                error: `유효하지 않은 액션: ${action}. 가능한 값: ${validActions.join(', ')}`
            });
        }

        let targetIds = [];

        if (ids && Array.isArray(ids)) {
            targetIds = ids;
        } else if (criteria) {
            // 조건에 따른 대상 선택
            targetIds = await findNutritionInfoByCriteria(criteria);
        } else {
            return res.status(400).json({
                success: false,
                error: 'ids 또는 criteria 중 하나는 필수입니다.'
            });
        }

        if (targetIds.length === 0) {
            return res.json({
                success: true,
                data: {
                    action: action,
                    processedCount: 0,
                    message: '처리할 항목이 없습니다.'
                }
            });
        }

        let processedCount = 0;
        const errors = [];

        for (const id of targetIds) {
            try {
                switch (action) {
                    case 'activate':
                        await nutritionDataManager.updateNutritionInfo(id, {
                            isActive: true,
                            status: 'active',
                            lastModified: new Date().toISOString(),
                            modifiedBy: req.session.user.username || req.session.user.id
                        });
                        break;

                    case 'deactivate':
                        await nutritionDataManager.updateNutritionInfo(id, {
                            isActive: false,
                            status: 'inactive',
                            lastModified: new Date().toISOString(),
                            modifiedBy: req.session.user.username || req.session.user.id
                        });
                        break;

                    case 'delete':
                        const { permanent = false } = req.body;
                        if (permanent) {
                            await nutritionDataManager.permanentlyDeleteNutritionInfo(id);
                        } else {
                            await nutritionDataManager.deleteNutritionInfo(id);
                        }
                        break;

                    case 'update_trust_score':
                        if (criteria && criteria.newTrustScore !== undefined) {
                            await nutritionDataManager.updateNutritionInfo(id, {
                                trustScore: criteria.newTrustScore,
                                lastModified: new Date().toISOString(),
                                modifiedBy: req.session.user.username || req.session.user.id
                            });
                        }
                        break;
                }
                processedCount++;
            } catch (error) {
                errors.push({ id, error: error.message });
            }
        }

        console.log(`🔄 일괄 처리 완료: ${action} - ${processedCount}개 처리 (by ${req.session.user.username || req.session.user.id})`);

        res.json({
            success: true,
            data: {
                action: action,
                processedCount: processedCount,
                totalRequested: targetIds.length,
                errors: errors,
                processedBy: req.session.user.username || req.session.user.id,
                processedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('일괄 처리 오류:', error);
        res.status(500).json({
            success: false,
            error: '일괄 처리 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// === 헬퍼 함수들 ===

/**
 * 모든 영양 정보 관련 캐시 무효화
 */
async function invalidateAllNutritionCaches() {
    try {
        // 현재 관리자 데이터 매니저 캐시 무효화
        if (nutritionDataManager && typeof nutritionDataManager.invalidateCache === 'function') {
            nutritionDataManager.invalidateCache();
        }
        
        // 메인 nutrition-info 라우터에서 사용하는 supabaseDataManager 캐시도 무효화
        const SupabaseNutritionDataManager = require('../utils/supabaseNutritionDataManager');
        const mainDataManager = new SupabaseNutritionDataManager();
        mainDataManager.invalidateCache();
        
        // 서버 전역 캐시 매니저가 있다면 무효화
        try {
            const cacheManager = require('../utils/cacheManager');
            if (cacheManager && typeof cacheManager.invalidateCache === 'function') {
                cacheManager.invalidateCache('api', 'nutrition');
                cacheManager.invalidateCache('nutrition', null);
            }
        } catch (globalCacheError) {
            console.log('전역 캐시 매니저 무효화 건너뜀:', globalCacheError.message);
        }
        
        console.log('🧹 모든 영양 정보 캐시 무효화 완료');
    } catch (error) {
        console.error('❌ 캐시 무효화 중 오류:', error);
    }
}

/**
 * 수동 수집 실행
 */
async function executeManualCollection(sources, keywords, maxResults, collectionId) {
    const results = {
        collected: 0,
        processed: 0,
        saved: 0,
        errors: [],
        sourceResults: {}
    };

    try {
        // 기본 키워드 설정
        const defaultKeywords = keywords.length > 0 ? keywords : ["nutrition", "diet", "supplements", "health"];

        // 각 소스별로 수집 실행
        for (const source of sources) {
            try {
                console.log(`📡 ${source} 수집 시작...`);
                let sourceData = [];

                switch (source) {
                    case 'pubmed':
                        if (contentAggregator.pubmedService) {
                            sourceData = await contentAggregator.pubmedService.searchPapers(
                                defaultKeywords,
                                maxResults,
                                '30d'
                            );
                        }
                        break;

                    case 'youtube':
                        if (contentAggregator.youtubeService) {
                            const publishedAfter = new Date();
                            publishedAfter.setDate(publishedAfter.getDate() - 30);
                            sourceData = await contentAggregator.youtubeService.searchVideos(
                                defaultKeywords,
                                [],
                                maxResults,
                                publishedAfter.toISOString()
                            );
                        }
                        break;

                    case 'news':
                        if (contentAggregator.newsService) {
                            const fromDate = new Date();
                            fromDate.setDate(fromDate.getDate() - 30);
                            sourceData = await contentAggregator.newsService.searchArticles(
                                defaultKeywords,
                                [],
                                maxResults,
                                fromDate.toISOString()
                            );
                        }
                        break;
                }

                results.sourceResults[source] = sourceData.length;
                results.collected += sourceData.length;

                console.log(`✅ ${source}: ${sourceData.length}개 수집 완료`);

            } catch (error) {
                console.error(`❌ ${source} 수집 실패:`, error.message);
                results.errors.push({
                    source,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        }

        console.log(`📊 수동 수집 완료 (ID: ${collectionId}): ${results.collected}개 수집`);

    } catch (error) {
        console.error(`❌ 수동 수집 실패 (ID: ${collectionId}):`, error);
        results.errors.push({
            source: 'system',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }

    return results;
}

/**
 * 최근 수집 활동 정보 조회
 */
async function getRecentCollectionActivity() {
    // 실제 구현에서는 로그 파일이나 데이터베이스에서 조회
    return {
        lastCollection: new Date().toISOString(),
        collectionsToday: 3,
        collectionsThisWeek: 15,
        recentErrors: []
    };
}

/**
 * 품질 지표 계산
 */
async function calculateQualityMetrics() {
    try {
        const allItems = await nutritionDataManager.getNutritionInfoList({}, { limit: 1000 });

        if (allItems.data.length === 0) {
            return {
                averageTrustScore: 0,
                highQualityItems: 0,
                lowQualityItems: 0,
                duplicatesDetected: 0
            };
        }

        const trustScores = allItems.data.map(item => item.trustScore || 0);
        const averageTrustScore = trustScores.reduce((sum, score) => sum + score, 0) / trustScores.length;

        const highQualityItems = allItems.data.filter(item => (item.trustScore || 0) >= 80).length;
        const lowQualityItems = allItems.data.filter(item => (item.trustScore || 0) < 60).length;

        return {
            averageTrustScore: Math.round(averageTrustScore * 100) / 100,
            highQualityItems,
            lowQualityItems,
            duplicatesDetected: 0 // 실제 구현에서는 중복 감지 로직 필요
        };
    } catch (error) {
        console.error('품질 지표 계산 오류:', error);
        return {
            averageTrustScore: 0,
            highQualityItems: 0,
            lowQualityItems: 0,
            duplicatesDetected: 0
        };
    }
}

/**
 * 소스별 성능 지표 조회
 */
async function getSourcePerformanceMetrics() {
    return {
        pubmed: {
            successRate: 95,
            averageResponseTime: 1200,
            lastSuccess: new Date().toISOString(),
            errorCount: 2
        },
        youtube: {
            successRate: 88,
            averageResponseTime: 800,
            lastSuccess: new Date().toISOString(),
            errorCount: 5
        },
        news: {
            successRate: 92,
            averageResponseTime: 600,
            lastSuccess: new Date().toISOString(),
            errorCount: 3
        }
    };
}

/**
 * 시스템 상태 정보 조회
 */
async function getSystemStatus() {
    return {
        schedulerRunning: false, // 스케줄러 기능은 현재 비활성화
        lastHealthCheck: new Date().toISOString(),
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        nodeVersion: process.version
    };
}

/**
 * 수집 로그 조회
 */
async function getCollectionLogs(options) {
    // 실제 구현에서는 로그 파일이나 데이터베이스에서 조회
    return {
        logs: [],
        total: 0,
        hasMore: false
    };
}

/**
 * 차단된 소스 목록 조회
 */
async function getBlockedSources() {
    const fs = require('fs').promises;
    const path = require('path');

    try {
        const blockedSourcesPath = path.join(__dirname, '../data/blocked-sources.json');
        const data = await fs.readFile(blockedSourcesPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // 파일이 없으면 빈 배열 반환
        return [];
    }
}

/**
 * 차단된 소스 목록 저장
 */
async function saveBlockedSources(blockedSources) {
    const fs = require('fs').promises;
    const path = require('path');

    try {
        const blockedSourcesPath = path.join(__dirname, '../data/blocked-sources.json');
        await fs.writeFile(blockedSourcesPath, JSON.stringify(blockedSources, null, 2));
    } catch (error) {
        console.error('차단된 소스 목록 저장 오류:', error);
        throw error;
    }
}

/**
 * 소스별 영양 정보 비활성화
 */
async function deactivateNutritionInfoBySource(sourceUrl, sourceName) {
    try {
        const allItems = await nutritionDataManager.getNutritionInfoList({}, { limit: 1000 });
        let deactivatedCount = 0;

        for (const item of allItems.data) {
            let shouldDeactivate = false;

            if (sourceUrl && item.sourceUrl === sourceUrl) {
                shouldDeactivate = true;
            }

            if (sourceName && item.sourceName === sourceName) {
                shouldDeactivate = true;
            }

            if (shouldDeactivate && item.isActive) {
                await nutritionDataManager.updateNutritionInfo(item.id, {
                    isActive: false,
                    status: 'blocked',
                    lastModified: new Date().toISOString(),
                    blockReason: '소스 차단으로 인한 비활성화'
                });
                deactivatedCount++;
            }
        }

        return deactivatedCount;
    } catch (error) {
        console.error('소스별 영양 정보 비활성화 오류:', error);
        return 0;
    }
}

/**
 * 조건에 따른 영양 정보 검색
 */
async function findNutritionInfoByCriteria(criteria) {
    try {
        const allItems = await nutritionDataManager.getNutritionInfoList({}, { limit: 1000 });
        const matchingIds = [];

        for (const item of allItems.data) {
            let matches = true;

            // 신뢰도 점수 조건
            if (criteria.minTrustScore !== undefined && item.trustScore < criteria.minTrustScore) {
                matches = false;
            }

            if (criteria.maxTrustScore !== undefined && item.trustScore > criteria.maxTrustScore) {
                matches = false;
            }

            // 소스 타입 조건
            if (criteria.sourceType && item.sourceType !== criteria.sourceType) {
                matches = false;
            }

            // 카테고리 조건
            if (criteria.category && item.category !== criteria.category) {
                matches = false;
            }

            // 활성 상태 조건
            if (criteria.isActive !== undefined && item.isActive !== criteria.isActive) {
                matches = false;
            }

            // 날짜 조건
            if (criteria.createdBefore) {
                const itemDate = new Date(item.collectedDate);
                const beforeDate = new Date(criteria.createdBefore);
                if (itemDate >= beforeDate) {
                    matches = false;
                }
            }

            if (criteria.createdAfter) {
                const itemDate = new Date(item.collectedDate);
                const afterDate = new Date(criteria.createdAfter);
                if (itemDate <= afterDate) {
                    matches = false;
                }
            }

            if (matches) {
                matchingIds.push(item.id);
            }
        }

        return matchingIds;
    } catch (error) {
        console.error('조건별 영양 정보 검색 오류:', error);
        return [];
    }
}

/**
 * 영구 저장소 상태 조회 API
 * GET /api/admin/nutrition-info/permanent-storage/status
 */
router.get('/permanent-storage/status', requireAdmin, async (req, res) => {
    try {
        const status = permanentStorageManager.getPermanentStorageStatus();
        const cacheStatus = permanentStorageManager.foodSafetyAPI.getCacheStatus();

        res.json({
            success: true,
            data: {
                permanentStorage: status,
                cache: cacheStatus,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('영구 저장소 상태 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '영구 저장소 상태 조회 중 오류가 발생했습니다.'
        });
    }
});

/**
 * API에서 새 데이터를 받아 영구 저장소에 저장 API
 * POST /api/admin/nutrition-info/permanent-storage/refresh
 */
router.post('/permanent-storage/refresh', requireAdmin, async (req, res) => {
    try {
        const { maxItems = 42000 } = req.body;
        
        console.log('영구 저장소 새로고침 요청 받음:', { maxItems });
        
        const result = await permanentStorageManager.refreshAndSaveToPermanentStorage(maxItems);
        
        if (result && result.success) {
            res.json({
                success: true,
                data: result,
                message: '영구 저장소가 성공적으로 업데이트되었습니다.'
            });
        } else {
            res.status(500).json({
                success: false,
                error: '영구 저장소 업데이트에 실패했습니다.'
            });
        }
    } catch (error) {
        console.error('영구 저장소 새로고침 오류:', error);
        res.status(500).json({
            success: false,
            error: '영구 저장소 새로고침 중 오류가 발생했습니다.'
        });
    }
});

/**
 * 영구 저장소에서 데이터 조회 API (API 연결 없이)
 * GET /api/admin/nutrition-info/permanent-storage/data
 */
router.get('/permanent-storage/data', requireAdmin, async (req, res) => {
    try {
        const { limit = 100, offset = 0 } = req.query;
        
        const data = permanentStorageManager.getDataFromPermanentStorage();
        
        if (data && data.C003) {
            // 페이지네이션 적용
            const startIndex = parseInt(offset);
            const endIndex = startIndex + parseInt(limit);
            const paginatedData = data.C003.row.slice(startIndex, endIndex);
            
            res.json({
                success: true,
                data: {
                    total_count: data.C003.total_count,
                    row: paginatedData,
                    source: data.C003.source,
                    pagination: {
                        limit: parseInt(limit),
                        offset: parseInt(offset),
                        hasMore: endIndex < data.C003.total_count
                    }
                }
            });
        } else {
            res.status(404).json({
                success: false,
                error: '영구 저장소에 데이터가 없습니다.'
            });
        }
    } catch (error) {
        console.error('영구 저장소 데이터 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '영구 저장소 데이터 조회 중 오류가 발생했습니다.'
        });
    }
});

/**
 * 영구 저장소 삭제 API
 * DELETE /api/admin/nutrition-info/permanent-storage
 */
router.delete('/permanent-storage', requireAdmin, async (req, res) => {
    try {
        const success = permanentStorageManager.clearPermanentStorage();
        
        if (success) {
            res.json({
                success: true,
                message: '영구 저장소가 성공적으로 삭제되었습니다.'
            });
        } else {
            res.status(500).json({
                success: false,
                error: '영구 저장소 삭제에 실패했습니다.'
            });
        }
    } catch (error) {
        console.error('영구 저장소 삭제 오류:', error);
        res.status(500).json({
            success: false,
            error: '영구 저장소 삭제 중 오류가 발생했습니다.'
        });
    }
});

/**
 * 캐시 삭제 API
 * DELETE /api/admin/nutrition-info/cache
 */
router.delete('/cache', requireAdmin, async (req, res) => {
    try {
        const success = permanentStorageManager.foodSafetyAPI.clearCache();
        
        if (success) {
            res.json({
                success: true,
                message: '캐시가 성공적으로 삭제되었습니다.'
            });
        } else {
            res.status(500).json({
                success: false,
                error: '캐시 삭제에 실패했습니다.'
            });
        }
    } catch (error) {
        console.error('캐시 삭제 오류:', error);
        res.status(500).json({
            success: false,
            error: '캐시 삭제 중 오류가 발생했습니다.'
        });
    }
});

module.exports = router;