const { supabaseAdmin } = require('./supabaseClient');

/**
 * Supabase를 사용한 수동 포스팅 관리 서비스
 */
class SupabaseManualPostingService {
    constructor() {
        this.supabase = supabaseAdmin;
    }

    /**
     * 새로운 포스팅 생성
     * @param {Object} postData - 포스팅 데이터
     * @param {Object} adminInfo - 관리자 정보
     * @returns {Promise<Object>} 생성된 포스팅 데이터
     */
    async createPost(postData, adminInfo) {
        try {
            // 포스팅 데이터 생성
            const { data: post, error: postError } = await this.supabase
                .from('nutrition_posts')
                .insert({
                    title: postData.title,
                    summary: postData.summary,
                    content: postData.content,
                    source_url: postData.sourceUrl,
                    source_name: postData.sourceName,
                    category_id: postData.categoryId,
                    image_url: postData.imageUrl,
                    thumbnail_url: postData.thumbnailUrl,
                    is_draft: postData.isDraft || false,
                    admin_id: adminInfo.id,
                    admin_name: adminInfo.name,
                    source_type: 'manual',
                    is_manual_post: true,
                    trust_score: 100
                })
                .select()
                .single();

            if (postError) {
                throw new Error(`포스팅 생성 실패: ${postError.message}`);
            }

            // 태그 연결
            if (postData.tags && postData.tags.length > 0) {
                await this.attachTags(post.id, postData.tags);
            }

            // 관련 상품 정보 저장
            if (postData.relatedProducts && postData.relatedProducts.length > 0) {
                await this.attachRelatedProducts(post.id, postData.relatedProducts);
            }

            return post;
        } catch (error) {
            console.error('포스팅 생성 중 오류:', error);
            throw error;
        }
    }

    /**
     * 포스팅 수정
     * @param {string} id - 포스팅 ID
     * @param {Object} updates - 수정할 데이터
     * @param {Object} adminInfo - 관리자 정보
     * @returns {Promise<Object>} 수정된 포스팅 데이터
     */
    async updatePost(id, updates, adminInfo) {
        try {
            const { data, error } = await this.supabase
                .from('nutrition_posts')
                .update({
                    ...updates,
                    last_modified: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (error) {
                throw new Error(`포스팅 수정 실패: ${error.message}`);
            }

            // 수정 이력 기록
            await this.supabase
                .from('post_modification_history')
                .insert({
                    post_id: id,
                    admin_id: adminInfo.id,
                    admin_name: adminInfo.name,
                    changes: JSON.stringify(updates)
                });

            // 태그 업데이트가 있는 경우
            if (updates.tags) {
                await this.updatePostTags(id, updates.tags);
            }

            return data;
        } catch (error) {
            console.error('포스팅 수정 중 오류:', error);
            throw error;
        }
    }

    /**
     * 관련 상품 정보 업데이트
     * @param {string} postId - 포스팅 ID
     * @param {Array} relatedProducts - 관련 상품 배열
     */
    async updateRelatedProducts(postId, relatedProducts) {
        try {
            // 기존 관련 상품 삭제
            const { error: deleteError } = await this.supabase
                .from('post_related_products')
                .delete()
                .eq('post_id', postId);

            if (deleteError) {
                throw new Error(`기존 관련 상품 삭제 실패: ${deleteError.message}`);
            }

            // 새로운 관련 상품 추가
            if (relatedProducts && relatedProducts.length > 0) {
                const productsToInsert = relatedProducts.map((product, index) => ({
                    post_id: postId,
                    product_name: product.name,
                    product_link: product.link,
                    display_order: index + 1
                }));

                const { error: insertError } = await this.supabase
                    .from('post_related_products')
                    .insert(productsToInsert);

                if (insertError) {
                    throw new Error(`관련 상품 추가 실패: ${insertError.message}`);
                }
            }

        } catch (error) {
            console.error('관련 상품 업데이트 중 오류:', error);
            throw error;
        }
    }

    /**
     * 포스팅 삭제
     * @param {string} id - 포스팅 ID
     * @returns {Promise<boolean>} 삭제 성공 여부
     */
    async deletePost(id) {
        try {
            const { error } = await this.supabase
                .from('nutrition_posts')
                .delete()
                .eq('id', id);

            if (error) {
                throw new Error(`포스팅 삭제 실패: ${error.message}`);
            }

            return true;
        } catch (error) {
            console.error('포스팅 삭제 중 오류:', error);
            throw error;
        }
    }

    /**
     * 관리자 포스팅 목록 조회
     * @param {string} adminId - 관리자 ID
     * @param {Object} filters - 필터 옵션
     * @returns {Promise<Array>} 포스팅 목록
     */
    async getAdminPosts(adminId, filters = {}) {
        try {
            let query = this.supabase
                .from('nutrition_posts')
                .select(`
                    *,
                    categories(name),
                    post_tags(tags(name))
                `)
                .eq('admin_id', adminId);

            // 상태 필터링
            if (filters.status === 'draft') {
                query = query.eq('is_draft', true);
            } else if (filters.status === 'published') {
                query = query.eq('is_draft', false).eq('is_active', true);
            } else if (filters.status === 'inactive') {
                query = query.eq('is_active', false);
            }

            // 카테고리 필터링
            if (filters.categoryId) {
                query = query.eq('category_id', filters.categoryId);
            }

            // 검색
            if (filters.search) {
                query = query.or(`title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) {
                throw new Error(`포스팅 목록 조회 실패: ${error.message}`);
            }

            return data;
        } catch (error) {
            console.error('포스팅 목록 조회 중 오류:', error);
            throw error;
        }
    }

    /**
     * 포스팅에 태그 연결
     * @param {string} postId - 포스팅 ID
     * @param {Array<string>} tagNames - 태그 이름 배열
     */
    async attachTags(postId, tagNames) {
        try {
            for (const tagName of tagNames) {
                const trimmedTag = tagName.trim();
                if (!trimmedTag) continue;

                // 태그가 없으면 생성
                const { data: tag, error: tagError } = await this.supabase
                    .from('tags')
                    .upsert({ name: trimmedTag }, { onConflict: 'name' })
                    .select()
                    .single();

                if (tagError) {
                    console.error(`태그 생성/조회 실패 (${trimmedTag}):`, tagError);
                    continue;
                }

                // 포스트-태그 연결
                const { error: linkError } = await this.supabase
                    .from('post_tags')
                    .upsert({ post_id: postId, tag_id: tag.id }, { onConflict: 'post_id,tag_id' });

                if (linkError) {
                    console.error(`포스트-태그 연결 실패 (${trimmedTag}):`, linkError);
                }
            }
        } catch (error) {
            console.error('태그 연결 중 오류:', error);
            throw error;
        }
    }

    /**
     * 관련 상품 정보 연결
     * @param {string} postId - 포스팅 ID
     * @param {Array<Object>} products - 상품 정보 배열 [{name, link}, ...]
     */
    async attachRelatedProducts(postId, products) {
        try {

            for (const product of products) {
                if (!product.name || !product.name.trim()) continue;

                const productData = {
                    post_id: postId,
                    product_name: product.name.trim(),
                    product_link: product.link ? product.link.trim() : null,
                    created_at: new Date().toISOString()
                };

                const { error: productError } = await this.supabase
                    .from('post_related_products')
                    .insert(productData);

                if (productError) {
                    console.error(`관련 상품 연결 실패 (${product.name}):`, productError);
                    continue;
                }

            }
        } catch (error) {
            console.error('관련 상품 연결 중 오류:', error);
            throw error;
        }
    }

    /**
     * 포스팅 태그 업데이트
     * @param {string} postId - 포스팅 ID
     * @param {Array<string>} newTagNames - 새로운 태그 이름 배열
     */
    async updatePostTags(postId, newTagNames) {
        try {
            // 기존 태그 연결 삭제
            await this.supabase
                .from('post_tags')
                .delete()
                .eq('post_id', postId);

            // 새로운 태그 연결
            if (newTagNames && newTagNames.length > 0) {
                await this.attachTags(postId, newTagNames);
            }
        } catch (error) {
            console.error('포스팅 태그 업데이트 중 오류:', error);
            throw error;
        }
    }

    /**
     * 포스팅 상태 토글 (게시/비게시)
     * @param {string} id - 포스팅 ID
     * @param {boolean} isActive - 활성 상태
     * @returns {Promise<Object>} 업데이트된 포스팅 데이터
     */
    async togglePostStatus(id, isActive) {
        try {
            const { data, error } = await this.supabase
                .from('nutrition_posts')
                .update({ 
                    is_active: isActive,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (error) {
                throw new Error(`포스팅 상태 변경 실패: ${error.message}`);
            }

            return data;
        } catch (error) {
            console.error('포스팅 상태 변경 중 오류:', error);
            throw error;
        }
    }

    /**
     * 임시저장 포스팅 목록 조회
     * @param {string} adminId - 관리자 ID
     * @returns {Promise<Array>} 임시저장 포스팅 목록
     */
    async getDrafts(adminId) {
        try {
            const { data, error } = await this.supabase
                .from('nutrition_posts')
                .select(`
                    *,
                    categories(name),
                    post_tags(tags(name))
                `)
                .eq('admin_id', adminId)
                .eq('is_draft', true)
                .order('updated_at', { ascending: false });

            if (error) {
                throw new Error(`임시저장 목록 조회 실패: ${error.message}`);
            }

            return data;
        } catch (error) {
            console.error('임시저장 목록 조회 중 오류:', error);
            throw error;
        }
    }

    /**
     * 포스팅 상세 조회
     * @param {string} id - 포스팅 ID
     * @returns {Promise<Object>} 포스팅 상세 데이터
     */
    async getPostById(id) {
        try {
            const { data, error } = await this.supabase
                .from('nutrition_posts')
                .select(`
                    *,
                    categories(id, name),
                    post_tags(tags(id, name))
                `)
                .eq('id', id)
                .single();

            if (error) {
                throw new Error(`포스팅 조회 실패: ${error.message}`);
            }

            // 관련 상품 정보 조회
            const { data: relatedProducts, error: productsError } = await this.supabase
                .from('post_related_products')
                .select('*')
                .eq('post_id', id)
                .order('created_at', { ascending: true });

            if (!productsError && relatedProducts) {
                data.related_products = relatedProducts;
            }

            return data;
        } catch (error) {
            console.error('포스팅 조회 중 오류:', error);
            throw error;
        }
    }

    // ==================== 추천 시스템 ====================

    /**
     * 카테고리 기반 관련 포스팅 추천
     * @param {string} categoryId - 카테고리 ID
     * @param {string} excludeId - 제외할 포스팅 ID
     * @param {number} limit - 추천 개수 제한
     * @returns {Promise<Array>} 추천 포스팅 목록
     */
    async getRelatedByCategory(categoryId, excludeId, limit = 5) {
        try {
            if (!categoryId) {
                return [];
            }

            let query = this.supabase
                .from('nutrition_posts')
                .select(`
                    id,
                    title,
                    summary,
                    image_url,
                    published_date,
                    view_count,
                    like_count,
                    bookmark_count,
                    categories(name),
                    post_tags(tags(name))
                `)
                .eq('category_id', categoryId)
                .eq('is_active', true)
                .eq('is_draft', false);

            // 현재 포스팅 제외
            if (excludeId) {
                query = query.neq('id', excludeId);
            }

            // 최신순과 인기순을 조합한 정렬
            // 먼저 최근 30일 내 포스팅을 우선하고, 그 다음 조회수와 좋아요 수를 고려
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data, error } = await query
                .gte('published_date', thirtyDaysAgo.toISOString())
                .order('view_count', { ascending: false })
                .order('like_count', { ascending: false })
                .order('published_date', { ascending: false })
                .limit(limit);

            if (error) {
                throw new Error(`카테고리 기반 추천 조회 실패: ${error.message}`);
            }

            // 최근 30일 내 포스팅이 부족한 경우 전체 기간에서 추가 조회
            if (data.length < limit) {
                const remainingLimit = limit - data.length;
                const existingIds = data.map(post => post.id);

                let additionalQuery = this.supabase
                    .from('nutrition_posts')
                    .select(`
                        id,
                        title,
                        summary,
                        image_url,
                        published_date,
                        view_count,
                        like_count,
                        bookmark_count,
                        categories(name),
                        post_tags(tags(name))
                    `)
                    .eq('category_id', categoryId)
                    .eq('is_active', true)
                    .eq('is_draft', false)
                    .lt('published_date', thirtyDaysAgo.toISOString());

                if (excludeId) {
                    additionalQuery = additionalQuery.neq('id', excludeId);
                }

                if (existingIds.length > 0) {
                    additionalQuery = additionalQuery.not('id', 'in', `(${existingIds.map(id => `'${id}'`).join(',')})`);
                }

                const { data: additionalData, error: additionalError } = await additionalQuery
                    .order('view_count', { ascending: false })
                    .order('like_count', { ascending: false })
                    .order('published_date', { ascending: false })
                    .limit(remainingLimit);

                if (!additionalError && additionalData) {
                    data.push(...additionalData);
                }
            }

            return data;
        } catch (error) {
            console.error('카테고리 기반 추천 중 오류:', error);
            return [];
        }
    }

    /**
     * 태그 기반 관련 포스팅 추천
     * @param {Array<string>} tagNames - 태그 이름 배열
     * @param {string} excludeId - 제외할 포스팅 ID
     * @param {number} limit - 추천 개수 제한
     * @returns {Promise<Array>} 추천 포스팅 목록 (관련도 점수 포함)
     */
    async getRelatedByTags(tagNames, excludeId, limit = 5) {
        try {
            if (!tagNames || tagNames.length === 0) {
                return [];
            }

            // 태그 이름으로 태그 ID 조회
            const { data: tags, error: tagError } = await this.supabase
                .from('tags')
                .select('id, name')
                .in('name', tagNames);

            if (tagError || !tags || tags.length === 0) {
                console.error('태그 조회 실패:', tagError);
                return [];
            }

            const tagIds = tags.map(tag => tag.id);
            const tagNameMap = tags.reduce((map, tag) => {
                map[tag.id] = tag.name;
                return map;
            }, {});

            // 해당 태그들을 가진 포스팅들 조회
            const { data: postTags, error: postTagError } = await this.supabase
                .from('post_tags')
                .select(`
                    post_id,
                    tag_id,
                    nutrition_posts!inner(
                        id,
                        title,
                        summary,
                        image_url,
                        published_date,
                        view_count,
                        like_count,
                        bookmark_count,
                        is_active,
                        is_draft,
                        categories(name)
                    )
                `)
                .in('tag_id', tagIds)
                .eq('nutrition_posts.is_active', true)
                .eq('nutrition_posts.is_draft', false);

            if (postTagError) {
                throw new Error(`태그 기반 포스팅 조회 실패: ${postTagError.message}`);
            }

            if (!postTags || postTags.length === 0) {
                return [];
            }

            // 포스팅별 태그 매칭 정보 수집
            const postTagMap = {};
            postTags.forEach(pt => {
                const postId = pt.post_id;
                const post = pt.nutrition_posts;
                
                // 제외할 포스팅 스킵
                if (excludeId && postId === excludeId) {
                    return;
                }

                if (!postTagMap[postId]) {
                    postTagMap[postId] = {
                        post: post,
                        matchingTags: [],
                        matchingTagIds: new Set()
                    };
                }

                if (tagIds.includes(pt.tag_id)) {
                    postTagMap[postId].matchingTags.push(tagNameMap[pt.tag_id]);
                    postTagMap[postId].matchingTagIds.add(pt.tag_id);
                }
            });

            // 각 포스팅의 전체 태그 정보 조회 (관련도 점수 계산용)
            const postIds = Object.keys(postTagMap);
            if (postIds.length === 0) {
                return [];
            }

            const { data: allPostTags, error: allTagError } = await this.supabase
                .from('post_tags')
                .select(`
                    post_id,
                    tags(name)
                `)
                .in('post_id', postIds);

            if (!allTagError && allPostTags) {
                // 포스팅별 전체 태그 정보 추가
                allPostTags.forEach(apt => {
                    if (postTagMap[apt.post_id] && apt.tags) {
                        if (!postTagMap[apt.post_id].allTags) {
                            postTagMap[apt.post_id].allTags = [];
                        }
                        postTagMap[apt.post_id].allTags.push(apt.tags.name);
                    }
                });
            }

            // 관련도 점수 계산 및 정렬
            const scoredPosts = Object.values(postTagMap).map(item => {
                const matchingCount = item.matchingTags.length;
                const totalTags = item.allTags ? item.allTags.length : matchingCount;
                const inputTagCount = tagNames.length;

                // 관련도 점수 계산 (여러 요소 고려)
                // 1. 태그 일치 비율 (매칭된 태그 수 / 입력 태그 수)
                const matchRatio = matchingCount / inputTagCount;
                
                // 2. 태그 정확도 (매칭된 태그 수 / 포스팅의 전체 태그 수)
                const precision = totalTags > 0 ? matchingCount / totalTags : 0;
                
                // 3. 인기도 점수 (조회수와 좋아요 수 기반)
                const popularityScore = (item.post.view_count || 0) * 0.1 + (item.post.like_count || 0) * 0.5;
                
                // 4. 최신성 점수 (최근 포스팅일수록 높은 점수)
                const publishedDate = new Date(item.post.published_date);
                const daysSincePublished = (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);
                const recencyScore = Math.max(0, 1 - (daysSincePublished / 365)); // 1년 기준으로 감소

                // 최종 관련도 점수 (가중 평균)
                const relevanceScore = (
                    matchRatio * 0.4 +           // 태그 일치 비율 (40%)
                    precision * 0.3 +            // 태그 정확도 (30%)
                    Math.min(popularityScore / 100, 1) * 0.2 + // 인기도 (20%, 최대 1로 제한)
                    recencyScore * 0.1           // 최신성 (10%)
                );

                return {
                    ...item.post,
                    matchingTags: item.matchingTags,
                    allTags: item.allTags || [],
                    relevanceScore: relevanceScore,
                    matchingTagCount: matchingCount,
                    categories: item.post.categories
                };
            });

            // 관련도 점수 기준으로 정렬하고 제한
            return scoredPosts
                .sort((a, b) => {
                    // 먼저 관련도 점수로 정렬
                    if (b.relevanceScore !== a.relevanceScore) {
                        return b.relevanceScore - a.relevanceScore;
                    }
                    // 관련도 점수가 같으면 매칭 태그 수로 정렬
                    if (b.matchingTagCount !== a.matchingTagCount) {
                        return b.matchingTagCount - a.matchingTagCount;
                    }
                    // 그 다음 인기도로 정렬
                    const aPopularity = (a.view_count || 0) + (a.like_count || 0) * 2;
                    const bPopularity = (b.view_count || 0) + (b.like_count || 0) * 2;
                    return bPopularity - aPopularity;
                })
                .slice(0, limit);
        } catch (error) {
            console.error('태그 기반 추천 중 오류:', error);
            return [];
        }
    }

    /**
     * 관련 태그 추천 및 연관성 분석
     * @param {Array<string>} inputTagNames - 입력 태그 이름들
     * @param {number} limit - 추천 태그 제한 개수
     * @returns {Promise<Array>} 관련 태그 목록 (연관성 점수 포함)
     */
    async getRelatedTagRecommendations(inputTagNames, limit = 10) {
        try {
            if (!inputTagNames || inputTagNames.length === 0) {
                return [];
            }

            // 입력 태그 ID 조회
            const { data: inputTags, error: inputTagError } = await this.supabase
                .from('tags')
                .select('id, name')
                .in('name', inputTagNames);

            if (inputTagError || !inputTags || inputTags.length === 0) {
                return [];
            }

            const inputTagIds = inputTags.map(tag => tag.id);

            // 입력 태그들과 함께 사용된 포스팅들 조회
            const { data: relatedPosts, error: postError } = await this.supabase
                .from('post_tags')
                .select('post_id')
                .in('tag_id', inputTagIds);

            if (postError || !relatedPosts || relatedPosts.length === 0) {
                return [];
            }

            // 중복 제거된 포스팅 ID 목록
            const uniquePostIds = [...new Set(relatedPosts.map(pt => pt.post_id))];

            // 이 포스팅들에서 사용된 모든 태그들 조회 (입력 태그 제외)
            const { data: allRelatedTags, error: relatedTagError } = await this.supabase
                .from('post_tags')
                .select(`
                    tag_id,
                    post_id,
                    tags(name, post_count)
                `)
                .in('post_id', uniquePostIds)
                .not('tag_id', 'in', `(${inputTagIds.join(',')})`);

            if (relatedTagError || !allRelatedTags) {
                return [];
            }

            // 태그별 연관성 분석
            const tagAnalysis = {};
            const totalPosts = uniquePostIds.length;

            allRelatedTags.forEach(art => {
                const tagName = art.tags.name;
                const tagPostCount = art.tags.post_count || 0;

                if (!tagAnalysis[tagName]) {
                    tagAnalysis[tagName] = {
                        name: tagName,
                        coOccurrenceCount: 0,
                        totalPostCount: tagPostCount,
                        posts: new Set()
                    };
                }

                tagAnalysis[tagName].coOccurrenceCount++;
                tagAnalysis[tagName].posts.add(art.post_id);
            });

            // 연관성 점수 계산 및 정렬
            const relatedTagsWithScores = Object.values(tagAnalysis).map(analysis => {
                // 1. 동시 출현 빈도 (해당 태그가 입력 태그들과 함께 나타나는 빈도)
                const coOccurrenceRate = analysis.coOccurrenceCount / totalPosts;
                
                // 2. 태그의 전체적인 인기도 (전체 포스팅에서의 사용 빈도)
                const popularityScore = Math.min(analysis.totalPostCount / 100, 1); // 최대 1로 제한
                
                // 3. 특이성 점수 (너무 일반적이지 않은 태그에 가산점)
                const specificityScore = analysis.totalPostCount > 0 ? 
                    Math.max(0, 1 - (analysis.totalPostCount / 50)) : 0;

                // 최종 연관성 점수
                const associationScore = (
                    coOccurrenceRate * 0.6 +      // 동시 출현 빈도 (60%)
                    popularityScore * 0.2 +       // 인기도 (20%)
                    specificityScore * 0.2        // 특이성 (20%)
                );

                return {
                    name: analysis.name,
                    coOccurrenceCount: analysis.coOccurrenceCount,
                    coOccurrenceRate: coOccurrenceRate,
                    totalPostCount: analysis.totalPostCount,
                    associationScore: associationScore,
                    uniquePostCount: analysis.posts.size
                };
            });

            // 연관성 점수 기준으로 정렬하고 제한
            return relatedTagsWithScores
                .sort((a, b) => {
                    // 먼저 연관성 점수로 정렬
                    if (b.associationScore !== a.associationScore) {
                        return b.associationScore - a.associationScore;
                    }
                    // 연관성 점수가 같으면 동시 출현 횟수로 정렬
                    return b.coOccurrenceCount - a.coOccurrenceCount;
                })
                .slice(0, limit);
        } catch (error) {
            console.error('관련 태그 추천 중 오류:', error);
            return [];
        }
    }

    /**
     * 통합 추천 시스템 - 카테고리와 태그를 결합한 관련 콘텐츠 추천
     * @param {Object} nutritionInfo - 기준이 되는 영양 정보 포스팅
     * @param {number} limit - 추천 개수 제한
     * @returns {Promise<Array>} 통합 추천 결과 (중복 제거 및 최종 점수 포함)
     */
    async getIntegratedRecommendations(nutritionInfo, limit = 5) {
        try {
            if (!nutritionInfo || !nutritionInfo.id) {
                return [];
            }

            const categoryId = nutritionInfo.category_id || nutritionInfo.categories?.id;
            const tagNames = this.extractTagNames(nutritionInfo);
            const excludeId = nutritionInfo.id;

            // 병렬로 카테고리 기반 추천과 태그 기반 추천 실행
            const [categoryRecommendations, tagRecommendations] = await Promise.all([
                this.getRelatedByCategory(categoryId, excludeId, Math.ceil(limit * 1.5)),
                this.getRelatedByTags(tagNames, excludeId, Math.ceil(limit * 1.5))
            ]);

            // 추천 결과 통합 및 중복 제거
            const combinedRecommendations = this.combineAndDeduplicateRecommendations(
                categoryRecommendations,
                tagRecommendations,
                nutritionInfo
            );

            // 최종 점수 계산 및 정렬
            const finalRecommendations = combinedRecommendations.map(item => {
                const finalScore = this.calculateFinalRecommendationScore(item, nutritionInfo);
                return {
                    ...item,
                    finalScore: finalScore,
                    recommendationReason: this.generateRecommendationReason(item, nutritionInfo)
                };
            });

            // 최종 점수 기준으로 정렬하고 제한
            return finalRecommendations
                .sort((a, b) => b.finalScore - a.finalScore)
                .slice(0, limit);
        } catch (error) {
            console.error('통합 추천 시스템 중 오류:', error);
            return [];
        }
    }

    /**
     * 포스팅에서 태그 이름 추출
     * @param {Object} nutritionInfo - 영양 정보 포스팅
     * @returns {Array<string>} 태그 이름 배열
     */
    extractTagNames(nutritionInfo) {
        if (nutritionInfo.post_tags && Array.isArray(nutritionInfo.post_tags)) {
            return nutritionInfo.post_tags
                .map(pt => pt.tags?.name)
                .filter(name => name);
        }
        
        if (nutritionInfo.tags && Array.isArray(nutritionInfo.tags)) {
            return nutritionInfo.tags;
        }
        
        return [];
    }

    /**
     * 카테고리 기반 추천과 태그 기반 추천 결과를 통합하고 중복 제거
     * @param {Array} categoryRecommendations - 카테고리 기반 추천 결과
     * @param {Array} tagRecommendations - 태그 기반 추천 결과
     * @param {Object} originalPost - 원본 포스팅 정보
     * @returns {Array} 통합된 추천 결과
     */
    combineAndDeduplicateRecommendations(categoryRecommendations, tagRecommendations, originalPost) {
        const recommendationMap = new Map();

        // 카테고리 기반 추천 결과 추가
        categoryRecommendations.forEach(item => {
            recommendationMap.set(item.id, {
                ...item,
                recommendationSources: ['category'],
                categoryMatch: true,
                tagMatch: false,
                relevanceScore: 0 // 태그 기반 점수는 0으로 초기화
            });
        });

        // 태그 기반 추천 결과 추가 (중복 시 정보 병합)
        tagRecommendations.forEach(item => {
            if (recommendationMap.has(item.id)) {
                // 이미 존재하는 경우 정보 병합
                const existing = recommendationMap.get(item.id);
                existing.recommendationSources.push('tag');
                existing.tagMatch = true;
                existing.relevanceScore = item.relevanceScore || 0;
                existing.matchingTags = item.matchingTags || [];
                existing.matchingTagCount = item.matchingTagCount || 0;
            } else {
                // 새로운 항목 추가
                recommendationMap.set(item.id, {
                    ...item,
                    recommendationSources: ['tag'],
                    categoryMatch: false,
                    tagMatch: true
                });
            }
        });

        return Array.from(recommendationMap.values());
    }

    /**
     * 최종 추천 점수 계산
     * @param {Object} recommendation - 추천 항목
     * @param {Object} originalPost - 원본 포스팅
     * @returns {number} 최종 추천 점수
     */
    calculateFinalRecommendationScore(recommendation, originalPost) {
        let score = 0;

        // 1. 카테고리 매칭 점수 (30%)
        if (recommendation.categoryMatch) {
            score += 0.3;
        }

        // 2. 태그 매칭 점수 (40%)
        if (recommendation.tagMatch && recommendation.relevanceScore) {
            score += recommendation.relevanceScore * 0.4;
        }

        // 3. 복합 매칭 보너스 (카테고리 + 태그 모두 매칭 시 추가 점수) (10%)
        if (recommendation.categoryMatch && recommendation.tagMatch) {
            score += 0.1;
        }

        // 4. 인기도 점수 (15%)
        const viewCount = recommendation.view_count || 0;
        const likeCount = recommendation.like_count || 0;
        const bookmarkCount = recommendation.bookmark_count || 0;
        const popularityScore = Math.min((viewCount * 0.1 + likeCount * 0.5 + bookmarkCount * 0.3) / 100, 1);
        score += popularityScore * 0.15;

        // 5. 최신성 점수 (5%)
        const publishedDate = new Date(recommendation.published_date);
        const daysSincePublished = (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);
        const recencyScore = Math.max(0, 1 - (daysSincePublished / 365)); // 1년 기준
        score += recencyScore * 0.05;

        return Math.min(score, 1); // 최대 1점으로 제한
    }

    /**
     * 추천 이유 생성
     * @param {Object} recommendation - 추천 항목
     * @param {Object} originalPost - 원본 포스팅
     * @returns {string} 추천 이유 텍스트
     */
    generateRecommendationReason(recommendation, originalPost) {
        const reasons = [];

        if (recommendation.categoryMatch && recommendation.tagMatch) {
            reasons.push('동일한 카테고리이며 관련 태그를 공유합니다');
        } else if (recommendation.categoryMatch) {
            reasons.push('동일한 카테고리의 관련 정보입니다');
        } else if (recommendation.tagMatch) {
            const matchingTagCount = recommendation.matchingTagCount || 0;
            if (matchingTagCount > 1) {
                reasons.push(`${matchingTagCount}개의 공통 태그를 가지고 있습니다`);
            } else {
                reasons.push('관련 태그를 공유합니다');
            }
        }

        // 인기도 추가
        const likeCount = recommendation.like_count || 0;
        const viewCount = recommendation.view_count || 0;
        if (likeCount > 10 || viewCount > 100) {
            reasons.push('인기 있는 콘텐츠입니다');
        }

        // 최신성 추가
        const publishedDate = new Date(recommendation.published_date);
        const daysSincePublished = (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSincePublished <= 7) {
            reasons.push('최근에 게시된 정보입니다');
        }

        return reasons.length > 0 ? reasons.join(', ') : '관련 정보입니다';
    }

    /**
     * 포스팅 ID로 통합 추천 조회 (편의 메서드)
     * @param {string} postId - 포스팅 ID
     * @param {number} limit - 추천 개수 제한
     * @returns {Promise<Array>} 통합 추천 결과
     */
    async getRecommendationsById(postId, limit = 5) {
        try {
            const nutritionInfo = await this.getPostById(postId);
            if (!nutritionInfo) {
                return [];
            }

            return await this.getIntegratedRecommendations(nutritionInfo, limit);
        } catch (error) {
            console.error('포스팅 ID로 추천 조회 중 오류:', error);
            return [];
        }
    }
}

module.exports = SupabaseManualPostingService;