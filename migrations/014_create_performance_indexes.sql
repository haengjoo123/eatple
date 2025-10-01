-- 성능 최적화를 위한 인덱스 생성
-- 2025-10-01 영양정보 목록 로딩 성능 개선

-- nutrition_posts 테이블 인덱스
-- 자주 사용되는 필터링 및 정렬 컬럼들
CREATE INDEX IF NOT EXISTS idx_nutrition_posts_is_active ON nutrition_posts(is_active);
CREATE INDEX IF NOT EXISTS idx_nutrition_posts_is_draft ON nutrition_posts(is_draft);
CREATE INDEX IF NOT EXISTS idx_nutrition_posts_created_at ON nutrition_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nutrition_posts_admin_id ON nutrition_posts(admin_id);

-- 복합 인덱스 (자주 함께 사용되는 조건들)
CREATE INDEX IF NOT EXISTS idx_nutrition_posts_active_draft ON nutrition_posts(is_active, is_draft);
CREATE INDEX IF NOT EXISTS idx_nutrition_posts_active_created ON nutrition_posts(is_active, created_at DESC);

-- categories 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

-- post_tags 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_post_tags_tag_id ON post_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_post_id ON post_tags(post_id);

-- 복합 인덱스 (태그와 포스트 조인 시 성능 향상)
CREATE INDEX IF NOT EXISTS idx_post_tags_tag_post ON post_tags(tag_id, post_id);

-- tags 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_post_count ON tags(post_count DESC);

-- post_related_products 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_post_related_products_post_id ON post_related_products(post_id);
CREATE INDEX IF NOT EXISTS idx_post_related_products_display_order ON post_related_products(display_order);

-- 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_post_related_products_post_order ON post_related_products(post_id, display_order);

-- products 테이블 인덱스 (상품 관리에서 사용)
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_view_count ON products(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_products_purchase_count ON products(purchase_count DESC);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

-- 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_products_status_category ON products(status, category);
CREATE INDEX IF NOT EXISTS idx_products_status_view_count ON products(status, view_count DESC);

-- 검색 성능을 위한 텍스트 인덱스 (선택사항)
-- title과 summary에 대한 부분 텍스트 검색 최적화
CREATE INDEX IF NOT EXISTS idx_nutrition_posts_title_gin ON nutrition_posts USING gin(to_tsvector('korean', title));
CREATE INDEX IF NOT EXISTS idx_nutrition_posts_summary_gin ON nutrition_posts USING gin(to_tsvector('korean', summary));

-- 인덱스 생성 완료 로그
INSERT INTO migration_log (migration_name, applied_at, description) 
VALUES ('014_create_performance_indexes', NOW(), '영양정보 목록 로딩 성능 개선을 위한 인덱스 생성');
