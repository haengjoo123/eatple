const { supabaseAdmin } = require('./supabaseClient');

/**
 * 카테고리 및 태그 관리 서비스
 */
class CategoryTagManager {
    constructor() {
        this.supabase = supabaseAdmin;
    }

    // ==================== 카테고리 관리 ====================

    /**
     * 모든 카테고리 조회
     * @returns {Promise<Array>} 카테고리 목록
     */
    async getCategories() {
        try {
            const { data, error } = await this.supabase
                .from('categories')
                .select('*')
                .order('name');

            if (error) {
                throw new Error(`카테고리 조회 실패: ${error.message}`);
            }

            return data;
        } catch (error) {
            console.error('카테고리 조회 중 오류:', error);
            throw error;
        }
    }

    /**
     * 이름으로 카테고리 조회
     * @param {string} name - 카테고리 이름
     * @returns {Promise<Object|null>} 카테고리 데이터 또는 null
     */
    async getCategoryByName(name) {
        try {
            const { data, error } = await this.supabase
                .from('categories')
                .select('*')
                .eq('name', name)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No rows returned
                    return null;
                }
                throw new Error(`카테고리 조회 실패: ${error.message}`);
            }

            return data;
        } catch (error) {
            console.error('카테고리 이름 조회 중 오류:', error);
            throw error;
        }
    }

    /**
     * 카테고리 생성
     * @param {Object} categoryData - 카테고리 데이터
     * @returns {Promise<Object>} 생성된 카테고리
     */
    async addCategory(categoryData) {
        try {
            const { data, error } = await this.supabase
                .from('categories')
                .insert({
                    name: categoryData.name,
                    description: categoryData.description || null
                })
                .select()
                .single();

            if (error) {
                throw new Error(`카테고리 생성 실패: ${error.message}`);
            }

            return data;
        } catch (error) {
            console.error('카테고리 생성 중 오류:', error);
            throw error;
        }
    }

    /**
     * 카테고리 수정
     * @param {string} id - 카테고리 ID
     * @param {Object} updates - 수정할 데이터
     * @returns {Promise<Object>} 수정된 카테고리
     */
    async updateCategory(id, updates) {
        try {
            const { data, error } = await this.supabase
                .from('categories')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (error) {
                throw new Error(`카테고리 수정 실패: ${error.message}`);
            }

            return data;
        } catch (error) {
            console.error('카테고리 수정 중 오류:', error);
            throw error;
        }
    }

    /**
     * 카테고리 삭제
     * @param {string} id - 카테고리 ID
     * @returns {Promise<boolean>} 삭제 성공 여부
     */
    async deleteCategory(id) {
        try {
            // 해당 카테고리를 사용하는 포스팅이 있는지 확인
            const { data: posts, error: checkError } = await this.supabase
                .from('nutrition_posts')
                .select('id')
                .eq('category_id', id)
                .limit(1);

            if (checkError) {
                throw new Error(`카테고리 사용 확인 실패: ${checkError.message}`);
            }

            if (posts && posts.length > 0) {
                throw new Error('해당 카테고리를 사용하는 포스팅이 있어 삭제할 수 없습니다.');
            }

            const { error } = await this.supabase
                .from('categories')
                .delete()
                .eq('id', id);

            if (error) {
                throw new Error(`카테고리 삭제 실패: ${error.message}`);
            }

            return true;
        } catch (error) {
            console.error('카테고리 삭제 중 오류:', error);
            throw error;
        }
    }

    /**
     * 카테고리별 포스팅 수 업데이트
     * @param {string} categoryId - 카테고리 ID
     */
    async updateCategoryPostCount(categoryId) {
        try {
            // 해당 카테고리의 활성 포스팅 수 계산
            const { count, error: countError } = await this.supabase
                .from('nutrition_posts')
                .select('*', { count: 'exact', head: true })
                .eq('category_id', categoryId)
                .eq('is_active', true);

            if (countError) {
                throw new Error(`포스팅 수 계산 실패: ${countError.message}`);
            }

            // 카테고리 포스팅 수 업데이트
            const { error: updateError } = await this.supabase
                .from('categories')
                .update({ post_count: count || 0 })
                .eq('id', categoryId);

            if (updateError) {
                throw new Error(`카테고리 포스팅 수 업데이트 실패: ${updateError.message}`);
            }
        } catch (error) {
            console.error('카테고리 포스팅 수 업데이트 중 오류:', error);
            throw error;
        }
    }

    // ==================== 태그 관리 ====================

    /**
     * 모든 태그 조회
     * @param {Object} options - 조회 옵션
     * @returns {Promise<Array>} 태그 목록
     */
    async getTags(options = {}) {
        try {
            let query = this.supabase
                .from('tags')
                .select('*');

            // 검색 필터
            if (options.search) {
                query = query.ilike('name', `%${options.search}%`);
            }

            // 정렬
            if (options.sortBy === 'post_count') {
                query = query.order('post_count', { ascending: false });
            } else {
                query = query.order('name');
            }

            // 제한
            if (options.limit) {
                query = query.limit(options.limit);
            }

            const { data, error } = await query;

            if (error) {
                // 테이블이 존재하지 않는 경우 빈 배열 반환
                if (error.code === '42P01') {
                    console.warn('Tags table does not exist, returning empty array');
                    return [];
                }
                throw new Error(`태그 조회 실패: ${error.message}`);
            }

            return data || [];
        } catch (error) {
            console.error('태그 조회 중 오류:', error);
            // 오류 발생 시 빈 배열 반환
            return [];
        }
    }

    /**
     * 태그 자동 완성 제안
     * @param {string} input - 입력된 텍스트
     * @param {number} limit - 제한 개수
     * @returns {Promise<Array>} 제안 태그 목록
     */
    async getTagSuggestions(input, limit = 10) {
        try {
            const { data, error } = await this.supabase
                .from('tags')
                .select('name, post_count')
                .ilike('name', `%${input}%`)
                .order('post_count', { ascending: false })
                .limit(limit);

            if (error) {
                // 테이블이 존재하지 않는 경우 빈 배열 반환
                if (error.code === '42P01') {
                    console.warn('Tags table does not exist, returning empty array');
                    return [];
                }
                throw new Error(`태그 제안 조회 실패: ${error.message}`);
            }

            return data || [];
        } catch (error) {
            console.error('태그 제안 조회 중 오류:', error);
            // 오류 발생 시 빈 배열 반환
            return [];
        }
    }

    /**
     * 관련 태그 추천
     * @param {Array<string>} tagNames - 기준 태그 이름들
     * @param {number} limit - 제한 개수
     * @returns {Promise<Array>} 관련 태그 목록
     */
    async getRelatedTags(tagNames, limit = 5) {
        try {
            if (!tagNames || tagNames.length === 0) {
                return [];
            }

            // 기준 태그들과 함께 사용된 다른 태그들을 찾기
            const { data, error } = await this.supabase
                .rpc('get_related_tags', {
                    input_tag_names: tagNames,
                    result_limit: limit
                });

            if (error) {
                console.error('관련 태그 조회 실패:', error);
                // RPC 함수가 없는 경우 대체 로직 사용
                return await this.getRelatedTagsFallback(tagNames, limit);
            }

            return data || [];
        } catch (error) {
            console.error('관련 태그 추천 중 오류:', error);
            // 오류 발생 시 대체 로직 사용
            return await this.getRelatedTagsFallback(tagNames, limit);
        }
    }

    /**
     * 관련 태그 추천 대체 로직
     * @param {Array<string>} tagNames - 기준 태그 이름들
     * @param {number} limit - 제한 개수
     * @returns {Promise<Array>} 관련 태그 목록
     */
    async getRelatedTagsFallback(tagNames, limit = 5) {
        try {
            // 기준 태그 ID들 조회
            const { data: baseTags, error: baseError } = await this.supabase
                .from('tags')
                .select('id')
                .in('name', tagNames);

            if (baseError || !baseTags || baseTags.length === 0) {
                return [];
            }

            const baseTagIds = baseTags.map(tag => tag.id);

            // 이 태그들과 함께 사용된 포스팅들 조회
            const { data: relatedPosts, error: postsError } = await this.supabase
                .from('post_tags')
                .select('post_id')
                .in('tag_id', baseTagIds);

            if (postsError || !relatedPosts || relatedPosts.length === 0) {
                return [];
            }

            const postIds = [...new Set(relatedPosts.map(pt => pt.post_id))];

            // 이 포스팅들에서 사용된 다른 태그들 조회
            const { data: relatedTagData, error: relatedError } = await this.supabase
                .from('post_tags')
                .select(`
                    tags(name, post_count)
                `)
                .in('post_id', postIds)
                .not('tag_id', 'in', `(${baseTagIds.join(',')})`);

            if (relatedError) {
                return [];
            }

            // 태그별 빈도 계산 및 정렬
            const tagFrequency = {};
            relatedTagData.forEach(item => {
                if (item.tags) {
                    const tagName = item.tags.name;
                    tagFrequency[tagName] = (tagFrequency[tagName] || 0) + 1;
                }
            });

            return Object.entries(tagFrequency)
                .sort(([,a], [,b]) => b - a)
                .slice(0, limit)
                .map(([name, frequency]) => ({ name, frequency }));
        } catch (error) {
            console.error('관련 태그 대체 로직 중 오류:', error);
            return [];
        }
    }

    /**
     * 태그별 포스팅 수 업데이트
     * @param {string} tagId - 태그 ID
     */
    async updateTagPostCount(tagId) {
        try {
            // 해당 태그를 사용하는 활성 포스팅 수 계산
            const { count, error: countError } = await this.supabase
                .from('post_tags')
                .select(`
                    nutrition_posts!inner(id)
                `, { count: 'exact', head: true })
                .eq('tag_id', tagId)
                .eq('nutrition_posts.is_active', true);

            if (countError) {
                throw new Error(`태그 포스팅 수 계산 실패: ${countError.message}`);
            }

            // 태그 포스팅 수 업데이트
            const { error: updateError } = await this.supabase
                .from('tags')
                .update({ post_count: count || 0 })
                .eq('id', tagId);

            if (updateError) {
                throw new Error(`태그 포스팅 수 업데이트 실패: ${updateError.message}`);
            }
        } catch (error) {
            console.error('태그 포스팅 수 업데이트 중 오류:', error);
            throw error;
        }
    }

    /**
     * 사용되지 않는 태그 정리
     * @returns {Promise<number>} 삭제된 태그 수
     */
    async cleanupUnusedTags() {
        try {
            // 포스팅 수가 0인 태그들 조회
            const { data: unusedTags, error: findError } = await this.supabase
                .from('tags')
                .select('id')
                .eq('post_count', 0);

            if (findError) {
                throw new Error(`사용되지 않는 태그 조회 실패: ${findError.message}`);
            }

            if (!unusedTags || unusedTags.length === 0) {
                return 0;
            }

            // 사용되지 않는 태그들 삭제
            const { error: deleteError } = await this.supabase
                .from('tags')
                .delete()
                .eq('post_count', 0);

            if (deleteError) {
                throw new Error(`사용되지 않는 태그 삭제 실패: ${deleteError.message}`);
            }

            return unusedTags.length;
        } catch (error) {
            console.error('사용되지 않는 태그 정리 중 오류:', error);
            throw error;
        }
    }

    // ==================== 통계 및 분석 ====================

    /**
     * 카테고리별 통계 조회
     * @returns {Promise<Array>} 카테고리별 통계
     */
    async getCategoryStats() {
        try {
            const { data, error } = await this.supabase
                .from('categories')
                .select(`
                    id,
                    name,
                    description,
                    post_count,
                    created_at
                `)
                .order('post_count', { ascending: false });

            if (error) {
                throw new Error(`카테고리 통계 조회 실패: ${error.message}`);
            }

            return data;
        } catch (error) {
            console.error('카테고리 통계 조회 중 오류:', error);
            throw error;
        }
    }

    /**
     * 인기 태그 조회
     * @param {number} limit - 제한 개수
     * @returns {Promise<Array>} 인기 태그 목록
     */
    async getPopularTags(limit = 20) {
        try {
            const { data, error } = await this.supabase
                .from('tags')
                .select('name, post_count')
                .gt('post_count', 0)
                .order('post_count', { ascending: false })
                .limit(limit);

            if (error) {
                throw new Error(`인기 태그 조회 실패: ${error.message}`);
            }

            return data;
        } catch (error) {
            console.error('인기 태그 조회 중 오류:', error);
            throw error;
        }
    }
}

module.exports = CategoryTagManager;