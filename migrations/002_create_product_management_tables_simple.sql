-- Product Management System Database Migration
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create product_categories table first (referenced by products table)
CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create products table with all required fields
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price INTEGER NOT NULL CHECK (price > 0), -- Price in KRW, must be positive
    category VARCHAR(100) NOT NULL,
    image_url TEXT,
    image_path TEXT, -- Supabase storage path
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'out_of_stock')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID, -- References auth.users(id) but not enforced for flexibility
    view_count INTEGER DEFAULT 0 CHECK (view_count >= 0),
    purchase_count INTEGER DEFAULT 0 CHECK (purchase_count >= 0)
);

-- Create product_analytics table for tracking views and purchases
CREATE TABLE IF NOT EXISTS product_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('view', 'purchase', 'cart_add')),
    user_id UUID, -- References auth.users(id) but nullable for anonymous users
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_status_category ON products(status, category);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_product_categories_name ON product_categories(name);
CREATE INDEX IF NOT EXISTS idx_product_analytics_product_id ON product_analytics(product_id);
CREATE INDEX IF NOT EXISTS idx_product_analytics_event_type ON product_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_product_analytics_created_at ON product_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_analytics_user_id ON product_analytics(user_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at timestamps
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_categories_updated_at ON product_categories;
CREATE TRIGGER update_product_categories_updated_at
    BEFORE UPDATE ON product_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default product categories
INSERT INTO product_categories (name, display_name, description) VALUES
    ('supplement', '건강보조식품', '비타민, 미네랄 등 건강보조식품'),
    ('vitamin', '비타민', '각종 비타민 제품'),
    ('beauty', '뷰티', '미용 및 피부 관리 제품'),
    ('protein', '프로틴', '단백질 보충제'),
    ('diet', '다이어트', '체중 관리 제품'),
    ('health', '건강식품', '일반 건강식품'),
    ('functional', '기능성식품', '특정 기능을 가진 식품'),
    ('organic', '유기농', '유기농 제품')
ON CONFLICT (name) DO NOTHING;

-- Create helper functions for analytics
CREATE OR REPLACE FUNCTION increment_product_view(product_uuid UUID)
RETURNS void AS $$
BEGIN
    -- Update view count in products table
    UPDATE products 
    SET view_count = view_count + 1 
    WHERE id = product_uuid;
    
    -- Insert analytics record
    INSERT INTO product_analytics (product_id, event_type, created_at)
    VALUES (product_uuid, 'view', NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_product_purchase(product_uuid UUID, user_uuid UUID DEFAULT NULL)
RETURNS void AS $$
BEGIN
    -- Update purchase count in products table
    UPDATE products 
    SET purchase_count = purchase_count + 1 
    WHERE id = product_uuid;
    
    -- Insert analytics record
    INSERT INTO product_analytics (product_id, event_type, user_id, created_at)
    VALUES (product_uuid, 'purchase', user_uuid, NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for product statistics (useful for admin dashboard)
CREATE OR REPLACE VIEW product_statistics AS
SELECT 
    p.id,
    p.name,
    p.category,
    p.status,
    p.price,
    p.view_count,
    p.purchase_count,
    p.created_at,
    pc.display_name as category_display_name,
    COALESCE(analytics.recent_views, 0) as recent_views_7d,
    COALESCE(analytics.recent_purchases, 0) as recent_purchases_7d
FROM products p
LEFT JOIN product_categories pc ON p.category = pc.name
LEFT JOIN (
    SELECT 
        product_id,
        COUNT(CASE WHEN event_type = 'view' AND created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_views,
        COUNT(CASE WHEN event_type = 'purchase' AND created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_purchases
    FROM product_analytics
    GROUP BY product_id
) analytics ON p.id = analytics.product_id;

-- Add comments for documentation
COMMENT ON TABLE products IS 'Main products table storing all shop products';
COMMENT ON TABLE product_categories IS 'Product categories for organization and filtering';
COMMENT ON TABLE product_analytics IS 'Analytics tracking for product views and purchases';
COMMENT ON VIEW product_statistics IS 'Aggregated product statistics for admin dashboard';
COMMENT ON FUNCTION increment_product_view(UUID) IS 'Safely increment product view count and log analytics';
COMMENT ON FUNCTION increment_product_purchase(UUID, UUID) IS 'Safely increment product purchase count and log analytics';