-- 제품 테이블에 최대 판매 개수 컬럼 추가
ALTER TABLE products 
ADD COLUMN max_sales_quantity INTEGER DEFAULT NULL;

-- 기존 제품들에 기본값 설정 (NULL로 설정하여 무제한 판매)
-- NULL은 무제한 판매를 의미하고, 정수값은 해당 개수까지만 판매 가능

-- 체크 제약 조건 추가 (음수 방지)
ALTER TABLE products 
ADD CONSTRAINT check_max_sales_quantity_positive CHECK (max_sales_quantity IS NULL OR max_sales_quantity > 0);

-- 인덱스 추가 (재고 관리 성능 향상)
CREATE INDEX idx_products_max_sales_quantity ON products(max_sales_quantity);

-- 품절 상태를 자동으로 관리하는 함수 생성
CREATE OR REPLACE FUNCTION check_and_update_product_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- 최대 판매 개수가 설정되어 있고, 현재 판매 개수가 최대 개수에 도달한 경우
    IF NEW.max_sales_quantity IS NOT NULL AND NEW.purchase_count >= NEW.max_sales_quantity THEN
        NEW.status = 'out_of_stock';
    -- 최대 판매 개수가 설정되어 있고, 현재 판매 개수가 최대 개수 미만이면서 현재 상태가 품절인 경우
    ELSIF NEW.max_sales_quantity IS NOT NULL AND NEW.purchase_count < NEW.max_sales_quantity AND NEW.status = 'out_of_stock' THEN
        NEW.status = 'active';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_check_product_stock ON products;
CREATE TRIGGER trigger_check_product_stock
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION check_and_update_product_stock();

-- 댓글 추가
COMMENT ON COLUMN products.max_sales_quantity IS '최대 판매 가능 개수 (NULL은 무제한 판매)';
COMMENT ON FUNCTION check_and_update_product_stock() IS '판매 개수에 따라 자동으로 품절 상태를 업데이트하는 함수';
