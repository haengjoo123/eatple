/**
 * Category Management Utility
 * Handles CRUD operations for product categories
 * Requirements: 2.2, 4.2, 7.1
 */

const { supabase, supabaseAdmin } = require('./supabaseClient');

class CategoryManager {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 10 * 60 * 1000; // 10분 캐시 (카테고리는 자주 변경되지 않음)
    }

    /**
     * 카테고리 생성
     * Requirements: 2.2, 7.1
     */
    async createCategory(categoryData) {
        try {
            // 데이터 검증
            const validationErrors = this.validateCategoryData(categoryData);
            if (validationErrors.length > 0) {
                throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
            }

            // 중복 확인
            const existingCategory = await this.getCategoryByName(categoryData.name);
            if (existingCategory.success && existingCategory.data) {
                throw new Error('이미 존재하는 카테고리입니다.');
            }

            // 카테고리 생성
            const { data, error } = await supabaseAdmin
                .from('product_categories')
                .insert([{
                    name: categoryData.name.trim().toLowerCase(),
                    display_name: categoryData.display_name.trim(),
                    description: categoryData.description?.trim() || null
                }])
                .select()
                .single();

            if (error) {
                throw new Error(`Database error: ${error.message}`);
            }

            // 캐시 무효화
            this.clearCache();

            return data;

        } catch (error) {
            console.error('CategoryManager.createCategory error:', error);
            throw error;
        }
    }

    /**
     * 카테고리 목록 조회
     * Requirements: 4.2, 7.1
     */
    async getCategories(includeInactive = false) {
        const cacheKey = `categories_${includeInactive}`;
        
        // 캐시 확인
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheExpiry) {
                return cached.data;
            }
        }

        try {
            // product_categories 테이블에서 먼저 시도
            let query = supabaseAdmin
                .from('product_categories')
                .select('*')
                .order('display_name', { ascending: true });

            let { data, error } = await query;

            // product_categories에서 실패하면 categories 테이블 사용
            if (error || !data || data.length === 0) {
                console.log('Falling back to categories table...');
                query = supabaseAdmin
                    .from('categories')
                    .select('*')
                    .order('name', { ascending: true });
                
                const result = await query;
                data = result.data;
                error = result.error;
            }

            if (error) {
                throw new Error(`Database error: ${error.message}`);
            }

            const result = data || [];

            // 캐시 저장
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            return result;

        } catch (error) {
            console.error('CategoryManager.getCategories error:', error);
            throw error;
        }
    }

    /**
     * 단일 카테고리 조회 (ID로)
     * Requirements: 4.2, 7.1
     */
    async getCategoryById(categoryId) {
        try {
            const { data, error } = await supabaseAdmin
                .from('product_categories')
                .select('*')
                .eq('id', categoryId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return {
                        success: false,
                        error: 'Category not found',
                        message: '카테고리를 찾을 수 없습니다.'
                    };
                }
                throw new Error(`Database error: ${error.message}`);
            }

            return {
                success: true,
                data: data
            };

        } catch (error) {
            console.error('CategoryManager.getCategoryById error:', error);
            return {
                success: false,
                error: error.message,
                message: '카테고리 조회에 실패했습니다.'
            };
        }
    }

    /**
     * 단일 카테고리 조회 (이름으로)
     * Requirements: 4.2, 7.1
     */
    async getCategoryByName(categoryName) {
        try {
            const { data, error } = await supabaseAdmin
                .from('product_categories')
                .select('*')
                .eq('name', categoryName.toLowerCase())
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return {
                        success: false,
                        error: 'Category not found',
                        message: '카테고리를 찾을 수 없습니다.'
                    };
                }
                throw new Error(`Database error: ${error.message}`);
            }

            return {
                success: true,
                data: data
            };

        } catch (error) {
            console.error('CategoryManager.getCategoryByName error:', error);
            return {
                success: false,
                error: error.message,
                message: '카테고리 조회에 실패했습니다.'
            };
        }
    }

    /**
     * 카테고리 업데이트
     * Requirements: 4.2, 7.1
     */
    async updateCategory(categoryId, updateData) {
        try {
            // 기존 카테고리 확인
            const existingCategory = await this.getCategoryById(categoryId);
            if (!existingCategory.success) {
                return null;
            }

            // 업데이트할 데이터 검증
            const validationErrors = this.validateCategoryData(updateData, true);
            if (validationErrors.length > 0) {
                throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
            }

            // 이름 중복 확인 (이름이 변경되는 경우)
            if (updateData.name && updateData.name.toLowerCase() !== existingCategory.data.name) {
                const duplicateCheck = await this.getCategoryByName(updateData.name);
                if (duplicateCheck.success && duplicateCheck.data) {
                    throw new Error('이미 존재하는 카테고리 이름입니다.');
                }
            }

            // 업데이트 데이터 준비
            const updateFields = {};

            if (updateData.name !== undefined) updateFields.name = updateData.name.trim().toLowerCase();
            if (updateData.display_name !== undefined) updateFields.display_name = updateData.display_name.trim();
            if (updateData.description !== undefined) updateFields.description = updateData.description?.trim() || null;

            const { data, error } = await supabaseAdmin
                .from('product_categories')
                .update(updateFields)
                .eq('id', categoryId)
                .select()
                .single();

            if (error) {
                throw new Error(`Database error: ${error.message}`);
            }

            // 캐시 무효화
            this.clearCache();

            return data;

        } catch (error) {
            console.error('CategoryManager.updateCategory error:', error);
            throw error;
        }
    }

    /**
     * 카테고리 삭제
     * Requirements: 4.2, 7.1
     */
    async deleteCategory(categoryId) {
        try {
            // 기존 카테고리 확인
            const existingCategory = await this.getCategoryById(categoryId);
            if (!existingCategory.success) {
                return false;
            }

            // 해당 카테고리를 사용하는 상품이 있는지 확인
            const { data: productsUsingCategory, error: checkError } = await supabaseAdmin
                .from('products')
                .select('id')
                .eq('category', existingCategory.data.name)
                .limit(1);

            if (checkError) {
                throw new Error(`Database error: ${checkError.message}`);
            }

            if (productsUsingCategory && productsUsingCategory.length > 0) {
                throw new Error('이 카테고리를 사용하는 상품이 있어 삭제할 수 없습니다.');
            }

            const { error } = await supabaseAdmin
                .from('product_categories')
                .delete()
                .eq('id', categoryId);

            if (error) {
                throw new Error(`Database error: ${error.message}`);
            }

            // 캐시 무효화
            this.clearCache();

            return true;

        } catch (error) {
            console.error('CategoryManager.deleteCategory error:', error);
            throw error;
        }
    }

    /**
     * 기본 카테고리 생성
     * Requirements: 7.1
     */
    async createDefaultCategories() {
        const defaultCategories = [
            // 건강식품
            {
                name: 'health_functional_food',
                display_name: '건강기능식품',
                description: '건강 기능성이 인정된 식품'
            },
            {
                name: 'protein_food',
                display_name: '단백질 식품',
                description: '근육 건강을 위한 단백질 식품'
            },
            {
                name: 'healthy_snack',
                display_name: '건강 간식',
                description: '건강한 간식거리'
            },
            {
                name: 'healthy_juice',
                display_name: '건강 주스',
                description: '영양이 풍부한 건강 주스'
            },
            // 간편식 / 반찬
            {
                name: 'home_meal_replacement',
                display_name: '가정간편식',
                description: '간편하게 즐기는 가정식'
            },
            {
                name: 'side_dish',
                display_name: '반찬',
                description: '맛있는 밑반찬'
            },
            {
                name: 'salad',
                display_name: '샐러드',
                description: '신선한 샐러드'
            },
            // 신선식품
            {
                name: 'fruit',
                display_name: '과일',
                description: '신선한 제철 과일'
            },
            {
                name: 'meat',
                display_name: '정육/계란',
                description: '신선한 정육/계란'
            },
            {
                name: 'seafood',
                display_name: '수산/해산',
                description: '신선한 수산/해산'
            }
        ];

        const results = [];
        
        for (const category of defaultCategories) {
            try {
                // 이미 존재하는지 확인
                const existing = await this.getCategoryByName(category.name);
                if (existing.success && existing.data) {
                    results.push({
                        category: category.name,
                        status: 'exists',
                        message: '이미 존재함'
                    });
                    continue;
                }

                // 생성
                const result = await this.createCategory(category, 'system');
                results.push({
                    category: category.name,
                    status: result.success ? 'created' : 'failed',
                    message: result.message
                });

            } catch (error) {
                results.push({
                    category: category.name,
                    status: 'failed',
                    message: error.message
                });
            }
        }

        return {
            success: true,
            data: results,
            message: '기본 카테고리 생성이 완료되었습니다.'
        };
    }

    /**
     * 카테고리 데이터 검증
     * Requirements: 2.3
     */
    validateCategoryData(data, isUpdate = false) {
        const errors = [];

        // 필수 필드 검증 (생성 시에만)
        if (!isUpdate) {
            if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
                errors.push('카테고리 이름은 필수입니다.');
            }
            if (!data.display_name || typeof data.display_name !== 'string' || data.display_name.trim().length === 0) {
                errors.push('표시 이름은 필수입니다.');
            }
        } else {
            // 업데이트 시 제공된 필드만 검증
            if (data.name !== undefined && (typeof data.name !== 'string' || data.name.trim().length === 0)) {
                errors.push('카테고리 이름은 비어있을 수 없습니다.');
            }
            if (data.display_name !== undefined && (typeof data.display_name !== 'string' || data.display_name.trim().length === 0)) {
                errors.push('표시 이름은 비어있을 수 없습니다.');
            }
        }

        // 공통 검증
        if (data.name) {
            if (data.name.length > 100) {
                errors.push('카테고리 이름은 100자를 초과할 수 없습니다.');
            }
            if (!/^[a-z0-9_-]+$/.test(data.name.toLowerCase())) {
                errors.push('카테고리 이름은 영문 소문자, 숫자, 언더스코어, 하이픈만 사용할 수 있습니다.');
            }
        }

        if (data.display_name && data.display_name.length > 100) {
            errors.push('표시 이름은 100자를 초과할 수 없습니다.');
        }

        if (data.description && data.description.length > 500) {
            errors.push('설명은 500자를 초과할 수 없습니다.');
        }

        return errors;
    }

    /**
     * 캐시 무효화
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * 고객용 활성 카테고리 목록 조회
     * Requirements: 8.3, 9.3
     */
    async getActiveCategories() {
        const cacheKey = 'active_categories';
        
        // 캐시 확인
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheExpiry) {
                return cached.data;
            }
        }

        try {
            // 활성 상품이 있는 카테고리만 조회
            const { data: activeProductCategories, error: productError } = await supabase
                .from('products')
                .select('category')
                .eq('status', 'active');

            if (productError) {
                throw new Error(`Database error: ${productError.message}`);
            }

            // 중복 제거하여 활성 카테고리 목록 생성
            const activeCategoryNames = [...new Set(activeProductCategories.map(p => p.category))];

            if (activeCategoryNames.length === 0) {
                const result = [];
                
                // 캐시 저장
                this.cache.set(cacheKey, {
                    data: result,
                    timestamp: Date.now()
                });

                return result;
            }

            // 카테고리 정보 조회
            const { data: categories, error: categoryError } = await supabase
                .from('product_categories')
                .select('name, display_name, description')
                .in('name', activeCategoryNames)
                .order('display_name', { ascending: true });

            if (categoryError) {
                throw new Error(`Database error: ${categoryError.message}`);
            }

            const result = categories || [];

            // 캐시 저장
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            return result;

        } catch (error) {
            console.error('CategoryManager.getActiveCategories error:', error);
            throw error;
        }
    }

    /**
     * 카테고리별 상품 수 조회
     * Requirements: 4.2
     */
    async getCategoryStats() {
        const cacheKey = 'category_stats';
        
        // 캐시 확인
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheExpiry) {
                return cached.data;
            }
        }

        try {
            const { data, error } = await supabaseAdmin
                .from('products')
                .select('category')
                .eq('status', 'active');

            if (error) {
                throw new Error(`Database error: ${error.message}`);
            }

            // 카테고리별 상품 수 계산
            const categoryStats = {};
            data.forEach(product => {
                categoryStats[product.category] = (categoryStats[product.category] || 0) + 1;
            });

            const result = {
                success: true,
                data: categoryStats
            };

            // 캐시 저장
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            return result;

        } catch (error) {
            console.error('CategoryManager.getCategoryStats error:', error);
            return {
                success: false,
                error: error.message,
                message: '카테고리 통계 조회에 실패했습니다.'
            };
        }
    }

    /**
     * 모든 카테고리 조회 (관리자용)
     * Requirements: 4.2, 7.1
     */
    async getAllCategories() {
        return await this.getCategories(true);
    }
}

module.exports = CategoryManager;