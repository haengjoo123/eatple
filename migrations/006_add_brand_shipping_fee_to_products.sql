-- 제품 테이블에 브랜드명과 배송비 컬럼 추가
ALTER TABLE products 
ADD COLUMN brand VARCHAR(255),
ADD COLUMN shipping_fee INTEGER DEFAULT 3000;

-- 기존 제품들에 기본값 설정
UPDATE products 
SET brand = '기본브랜드', shipping_fee = 3000 
WHERE brand IS NULL OR shipping_fee IS NULL;

-- 브랜드명을 필수 필드로 설정
ALTER TABLE products 
ALTER COLUMN brand SET NOT NULL;

-- 배송비에 체크 제약 조건 추가 (음수 방지)
ALTER TABLE products 
ADD CONSTRAINT check_shipping_fee_positive CHECK (shipping_fee >= 0);

-- 인덱스 추가 (브랜드별 조회 성능 향상)
CREATE INDEX idx_products_brand ON products(brand);