/**
 * Supabase 영양정보 데이터를 로컬 파일 시스템으로 마이그레이션하는 스크립트
 */

const { supabase } = require('../utils/supabaseClient');
const fs = require('fs').promises;
const path = require('path');

class SupabaseToLocalMigration {
    constructor() {
        this.dataDir = path.join(__dirname, '../data');
        this.nutritionDir = path.join(this.dataDir, 'nutrition');
        this.backupDir = path.join(this.dataDir, 'backup');
        
        // 데이터 파일 경로들
        this.paths = {
            nutritionPosts: path.join(this.nutritionDir, 'nutrition-posts.json'),
            categories: path.join(this.nutritionDir, 'categories.json'),
            tags: path.join(this.nutritionDir, 'tags.json'),
            postTags: path.join(this.nutritionDir, 'post-tags.json'),
            relatedProducts: path.join(this.nutritionDir, 'post-related-products.json')
        };
    }

    /**
     * 디렉토리 초기화
     */
    async initializeDirectories() {
        console.log('📁 디렉토리 초기화 중...');
        
        // 필요한 디렉토리들 생성
        const dirs = [this.nutritionDir, this.backupDir];
        for (const dir of dirs) {
            try {
                await fs.mkdir(dir, { recursive: true });
                console.log(`✅ 디렉토리 생성: ${dir}`);
            } catch (error) {
                if (error.code !== 'EEXIST') {
                    throw error;
                }
            }
        }
    }

    /**
     * 기존 파일 백업
     */
    async backupExistingFiles() {
        console.log('💾 기존 파일 백업 중...');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        for (const [name, filePath] of Object.entries(this.paths)) {
            try {
                await fs.access(filePath);
                const backupPath = path.join(this.backupDir, `${name}-backup-${timestamp}.json`);
                await fs.copyFile(filePath, backupPath);
                console.log(`✅ 백업 완료: ${name} -> ${backupPath}`);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.error(`❌ 백업 실패 (${name}):`, error.message);
                }
            }
        }
    }

    /**
     * Supabase에서 카테고리 데이터 추출
     */
    async extractCategories() {
        console.log('📥 카테고리 데이터 추출 중...');
        
        try {
            const { data, error } = await supabase
                .from('categories')
                .select('*')
                .order('created_at');
            
            if (error) throw error;
            
            console.log(`✅ 카테고리 ${data.length}개 추출 완료`);
            return data || [];
        } catch (error) {
            console.error('❌ 카테고리 추출 실패:', error);
            return [];
        }
    }

    /**
     * Supabase에서 태그 데이터 추출
     */
    async extractTags() {
        console.log('📥 태그 데이터 추출 중...');
        
        try {
            const { data, error } = await supabase
                .from('tags')
                .select('*')
                .order('created_at');
            
            if (error) throw error;
            
            console.log(`✅ 태그 ${data.length}개 추출 완료`);
            return data || [];
        } catch (error) {
            console.error('❌ 태그 추출 실패:', error);
            return [];
        }
    }

    /**
     * Supabase에서 영양정보 포스트 데이터 추출
     */
    async extractNutritionPosts() {
        console.log('📥 영양정보 포스트 데이터 추출 중...');
        
        try {
            let allPosts = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;
            
            while (hasMore) {
                const { data, error } = await supabase
                    .from('nutrition_posts')
                    .select(`
                        *,
                        categories(id, name, description),
                        post_tags(tags(id, name))
                    `)
                    .order('created_at')
                    .range(page * pageSize, (page + 1) * pageSize - 1);
                
                if (error) throw error;
                
                if (data && data.length > 0) {
                    allPosts = allPosts.concat(data);
                    console.log(`📄 ${page + 1}페이지: ${data.length}개 포스트 추출`);
                    hasMore = data.length === pageSize;
                    page++;
                } else {
                    hasMore = false;
                }
            }
            
            console.log(`✅ 총 영양정보 포스트 ${allPosts.length}개 추출 완료`);
            return allPosts;
        } catch (error) {
            console.error('❌ 영양정보 포스트 추출 실패:', error);
            return [];
        }
    }

    /**
     * Supabase에서 포스트-태그 관계 데이터 추출
     */
    async extractPostTags() {
        console.log('📥 포스트-태그 관계 데이터 추출 중...');
        
        try {
            const { data, error } = await supabase
                .from('post_tags')
                .select('*');
            
            if (error) throw error;
            
            console.log(`✅ 포스트-태그 관계 ${data.length}개 추출 완료`);
            return data || [];
        } catch (error) {
            console.error('❌ 포스트-태그 관계 추출 실패:', error);
            return [];
        }
    }

    /**
     * Supabase에서 관련 상품 데이터 추출
     */
    async extractRelatedProducts() {
        console.log('📥 관련 상품 데이터 추출 중...');
        
        try {
            const { data, error } = await supabase
                .from('post_related_products')
                .select('*');
            
            if (error) throw error;
            
            console.log(`✅ 관련 상품 ${data.length}개 추출 완료`);
            return data || [];
        } catch (error) {
            console.error('❌ 관련 상품 추출 실패:', error);
            return [];
        }
    }

    /**
     * 데이터를 로컬 파일에 저장
     */
    async saveToFile(filePath, data, description) {
        try {
            const jsonData = JSON.stringify(data, null, 2);
            await fs.writeFile(filePath, jsonData, 'utf8');
            console.log(`✅ ${description} 저장 완료: ${filePath} (${data.length}개)`);
        } catch (error) {
            console.error(`❌ ${description} 저장 실패:`, error);
            throw error;
        }
    }

    /**
     * 마이그레이션 통계 생성
     */
    async generateMigrationStats(categories, tags, nutritionPosts, postTags, relatedProducts) {
        const stats = {
            migrationDate: new Date().toISOString(),
            totalItems: {
                categories: categories.length,
                tags: tags.length,
                nutritionPosts: nutritionPosts.length,
                postTags: postTags.length,
                relatedProducts: relatedProducts.length
            },
            dataFiles: this.paths,
            source: 'Supabase',
            target: 'Local File System'
        };

        const statsPath = path.join(this.dataDir, 'migration-stats.json');
        await this.saveToFile(statsPath, stats, '마이그레이션 통계');
        
        return stats;
    }

    /**
     * 전체 마이그레이션 실행
     */
    async migrate() {
        console.log('🚀 Supabase -> 로컬 파일 시스템 마이그레이션 시작');
        console.log('=' .repeat(60));
        
        try {
            // 1. 디렉토리 초기화
            await this.initializeDirectories();
            
            // 2. 기존 파일 백업
            await this.backupExistingFiles();
            
            // 3. Supabase에서 데이터 추출
            console.log('\n📥 Supabase 데이터 추출 시작...');
            const [categories, tags, nutritionPosts, postTags, relatedProducts] = await Promise.all([
                this.extractCategories(),
                this.extractTags(),
                this.extractNutritionPosts(),
                this.extractPostTags(),
                this.extractRelatedProducts()
            ]);
            
            // 4. 로컬 파일에 저장
            console.log('\n💾 로컬 파일 저장 시작...');
            await Promise.all([
                this.saveToFile(this.paths.categories, categories, '카테고리'),
                this.saveToFile(this.paths.tags, tags, '태그'),
                this.saveToFile(this.paths.nutritionPosts, nutritionPosts, '영양정보 포스트'),
                this.saveToFile(this.paths.postTags, postTags, '포스트-태그 관계'),
                this.saveToFile(this.paths.relatedProducts, relatedProducts, '관련 상품')
            ]);
            
            // 5. 마이그레이션 통계 생성
            const stats = await this.generateMigrationStats(categories, tags, nutritionPosts, postTags, relatedProducts);
            
            console.log('\n✅ 마이그레이션 완료!');
            console.log('=' .repeat(60));
            console.log('📊 마이그레이션 통계:');
            console.log(`  - 카테고리: ${stats.totalItems.categories}개`);
            console.log(`  - 태그: ${stats.totalItems.tags}개`);
            console.log(`  - 영양정보 포스트: ${stats.totalItems.nutritionPosts}개`);
            console.log(`  - 포스트-태그 관계: ${stats.totalItems.postTags}개`);
            console.log(`  - 관련 상품: ${stats.totalItems.relatedProducts}개`);
            console.log(`\n📁 데이터 파일 위치: ${this.nutritionDir}`);
            
            return stats;
            
        } catch (error) {
            console.error('\n❌ 마이그레이션 실패:', error);
            throw error;
        }
    }
}

// 스크립트가 직접 실행될 때
if (require.main === module) {
    const migration = new SupabaseToLocalMigration();
    
    migration.migrate()
        .then((stats) => {
            console.log('\n🎉 마이그레이션이 성공적으로 완료되었습니다!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 마이그레이션 중 오류 발생:', error);
            process.exit(1);
        });
}

module.exports = SupabaseToLocalMigration;

