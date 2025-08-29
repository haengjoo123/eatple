-- Add summary and originalPrice fields to products table
-- Migration: 003_add_summary_to_products.sql

-- Add summary field to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS summary TEXT;

-- Add originalPrice field to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS originalprice INTEGER CHECK (originalprice > 0);

-- Add index for summary field for better search performance
CREATE INDEX IF NOT EXISTS idx_products_summary ON products USING gin(to_tsvector('korean', summary));

-- Update existing products to have empty summary if null
UPDATE products SET summary = '' WHERE summary IS NULL;

-- Add comment to document the new fields
COMMENT ON COLUMN products.summary IS '제품 요약 정보 (간단한 설명)';
COMMENT ON COLUMN products.originalprice IS '제품 정가 (할인 전 가격)';

