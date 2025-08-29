-- 영양정보 포스팅 관련 상품 테이블 생성
-- 각 영양정보 포스팅에 연결된 관련 상품들을 저장

CREATE TABLE IF NOT EXISTS post_related_products (
    id SERIAL PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES nutrition_posts(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    product_link TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_post_related_products_post_id ON post_related_products(post_id);
CREATE INDEX IF NOT EXISTS idx_post_related_products_display_order ON post_related_products(display_order);

-- 업데이트 시간 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_post_related_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_post_related_products_updated_at
    BEFORE UPDATE ON post_related_products
    FOR EACH ROW
    EXECUTE FUNCTION update_post_related_products_updated_at();

-- 테이블 코멘트
COMMENT ON TABLE post_related_products IS '영양정보 포스팅 관련 상품 정보';
COMMENT ON COLUMN post_related_products.id IS '관련 상품 ID';
COMMENT ON COLUMN post_related_products.post_id IS '영양정보 포스팅 ID';
COMMENT ON COLUMN post_related_products.product_name IS '상품명';
COMMENT ON COLUMN post_related_products.product_link IS '상품 구매 링크';
COMMENT ON COLUMN post_related_products.display_order IS '표시 순서';
COMMENT ON COLUMN post_related_products.created_at IS '생성일시';
COMMENT ON COLUMN post_related_products.updated_at IS '수정일시';