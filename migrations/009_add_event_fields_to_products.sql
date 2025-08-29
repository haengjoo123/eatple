-- products 테이블에 이벤트 관련 필드 추가
-- 이벤트 상품 관리를 위한 필드들

-- 이벤트 상품 여부 (boolean)
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_event BOOLEAN DEFAULT FALSE;

-- 이벤트 태그 (문자열)
ALTER TABLE products ADD COLUMN IF NOT EXISTS event_tag VARCHAR(100);

-- 이벤트 시작일
ALTER TABLE products ADD COLUMN IF NOT EXISTS event_start_date TIMESTAMP WITH TIME ZONE;

-- 이벤트 종료일
ALTER TABLE products ADD COLUMN IF NOT EXISTS event_end_date TIMESTAMP WITH TIME ZONE;

-- 이벤트 할인율 (percentage)
ALTER TABLE products ADD COLUMN IF NOT EXISTS event_discount_rate INTEGER CHECK (event_discount_rate >= 0 AND event_discount_rate <= 100);

-- 이벤트 설명
ALTER TABLE products ADD COLUMN IF NOT EXISTS event_description TEXT;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_products_is_event ON products(is_event);
CREATE INDEX IF NOT EXISTS idx_products_event_tag ON products(event_tag);
CREATE INDEX IF NOT EXISTS idx_products_event_dates ON products(event_start_date, event_end_date);

-- 컬럼 코멘트 추가
COMMENT ON COLUMN products.is_event IS '이벤트 상품 여부';
COMMENT ON COLUMN products.event_tag IS '이벤트 태그 (예: summer_sale, new_year, etc.)';
COMMENT ON COLUMN products.event_start_date IS '이벤트 시작일';
COMMENT ON COLUMN products.event_end_date IS '이벤트 종료일';
COMMENT ON COLUMN products.event_discount_rate IS '이벤트 할인율 (0-100)';
COMMENT ON COLUMN products.event_description IS '이벤트 설명';

-- 기존 할인 상품들을 이벤트 상품으로 마크하는 함수
CREATE OR REPLACE FUNCTION mark_discounted_products_as_events()
RETURNS void AS $$
BEGIN
    -- 할인율이 15% 이상인 상품들을 이벤트 상품으로 마크
    UPDATE products 
    SET 
        is_event = TRUE,
        event_tag = 'discount_sale',
        event_discount_rate = CASE 
            WHEN originalPrice > 0 AND price > 0 
            THEN ROUND(((originalPrice - price) / originalPrice) * 100)
            ELSE 0
        END,
        event_description = '특가 할인 상품'
    WHERE 
        originalPrice > price 
        AND ((originalPrice - price) / originalPrice) * 100 >= 15
        AND is_event = FALSE;
END;
$$ LANGUAGE plpgsql;

-- 함수 실행
SELECT mark_discounted_products_as_events();

-- 함수 삭제 (일회성 실행이므로)
DROP FUNCTION IF EXISTS mark_discounted_products_as_events();
