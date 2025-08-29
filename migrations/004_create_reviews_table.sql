-- Create reviews table for product reviews
-- Migration: 004_create_reviews_table.sql

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- References auth.users(id) from Supabase Auth
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews;
CREATE TRIGGER update_reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add unique constraint to prevent duplicate reviews from same user for same product
ALTER TABLE reviews ADD CONSTRAINT unique_user_product_review 
    UNIQUE (user_id, product_id);

-- Add comments
COMMENT ON TABLE reviews IS '제품 리뷰 테이블';
COMMENT ON COLUMN reviews.product_id IS '리뷰 대상 제품 ID';
COMMENT ON COLUMN reviews.user_id IS '리뷰 작성자 ID (auth.users 참조)';
COMMENT ON COLUMN reviews.rating IS '평점 (1-5점)';
COMMENT ON COLUMN reviews.content IS '리뷰 내용';