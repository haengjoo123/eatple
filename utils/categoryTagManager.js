const LocalNutritionDataManager = require('./localNutritionDataManager');
const fs = require('fs').promises;
const path = require('path');

/**
 * 카테고리 및 태그 관리 서비스 (로컬 데이터 전용)
 */
class CategoryTagManager {
    constructor() {
        this.localNutritionDataManager = new LocalNutritionDataManager();
        this.dataPath = path.join(__dirname, "../data/nutrition");
        this.categoriesFile = path.join(this.dataPath, "categories.json");
        this.tagsFile = path.join(this.dataPath, "tags.json");
        this.postTagsFile = path.join(this.dataPath, "post-tags.json");
    }

    // ==================== 카테고리 관리 ====================

    /**
     * 모든 카테고리 조회
     * @returns {Promise<Array>} 카테고리 목록
     */
    async getCategories() {
        try {
            const data = await fs.readFile(this.categoriesFile, 'utf8');
            const categories = JSON.parse(data);
            return categories.sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            console.error('카테고리 조회 중 오류:', error);
            // 파일이 없으면 빈 배열 반환
            return [];
        }
    }

    /**
     * 이름으로 카테고리 조회
     * @param {string} name - 카테고리 이름
     * @returns {Promise<Object|null>} 카테고리 데이터 또는 null
     */
    async getCategoryByName(name) {
        try {
            const categories = await this.getCategories();
            return categories.find(cat => cat.name === name) || null;
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
            const categories = await this.getCategories();
            
            // 새 카테고리 ID 생성
            const maxId = categories.length > 0 ? Math.max(...categories.map(cat => parseInt(cat.id) || 0)) : 0;
            const newId = (maxId + 1).toString();
            
            const newCategory = {
                id: newId,
                name: categoryData.name,
                description: categoryData.description || null,
                post_count: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            categories.push(newCategory);
            await fs.writeFile(this.categoriesFile, JSON.stringify(categories, null, 2), 'utf8');
            
            return newCategory;
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
            console.log(`📊 카테고리 포스팅 수 업데이트 시작 - 카테고리 ID: ${categoryId}`);
            
            // 로컬 데이터에서 포스팅 수 계산
            const localPosts = await this.localNutritionDataManager.getNutritionInfoList({}, { limit: 10000 });
            const posts = localPosts.data || [];
            
            // 카테고리 ID로 필터링하여 활성 포스팅 수 계산
            const activePostsCount = posts.filter(post => {
                const postData = typeof post.toJSON === 'function' ? post.toJSON() : post;
                return postData.category === categoryId || postData.category_id === categoryId;
            }).length;

            console.log(`📊 로컬 데이터에서 계산된 포스팅 수: ${activePostsCount}`);

            // 로컬 카테고리 데이터 업데이트
            const categories = await this.getCategories();
            const categoryIndex = categories.findIndex(cat => cat.id === categoryId || cat.name === categoryId);
            
            if (categoryIndex !== -1) {
                categories[categoryIndex].post_count = activePostsCount;
                categories[categoryIndex].updated_at = new Date().toISOString();
                
                // 로컬 카테고리 파일 업데이트
                await fs.writeFile(this.categoriesFile, JSON.stringify(categories, null, 2), 'utf8');
                
                console.log(`✅ 로컬 카테고리 ${categoryId} 포스팅 수 업데이트: ${activePostsCount}`);
            } else {
                console.log(`⚠️ 카테고리 ${categoryId}를 찾을 수 없음`);
            }

        } catch (error) {
            console.error('❌ 카테고리 포스팅 수 업데이트 오류:', error);
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
            const data = await fs.readFile(this.tagsFile, 'utf8');
            let tags = JSON.parse(data);

            // 검색 필터
            if (options.search) {
                tags = tags.filter(tag => 
                    tag.name.toLowerCase().includes(options.search.toLowerCase())
                );
            }

            // 정렬
            if (options.sortBy === 'post_count') {
                tags.sort((a, b) => (b.post_count || 0) - (a.post_count || 0));
            } else {
                tags.sort((a, b) => a.name.localeCompare(b.name));
            }

            // 제한
            if (options.limit) {
                tags = tags.slice(0, options.limit);
            }

            return tags;
        } catch (error) {
            console.error('태그 조회 중 오류:', error);
            // 파일이 없으면 빈 배열 반환
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