-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    post_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    post_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create nutrition_posts table
CREATE TABLE IF NOT EXISTS nutrition_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    content TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'paper', 'youtube', 'news'
    source_url TEXT,
    source_name TEXT,
    author TEXT,
    published_date TIMESTAMPTZ DEFAULT NOW(),
    collected_date TIMESTAMPTZ DEFAULT NOW(),
    trust_score INTEGER DEFAULT 100,
    category_id UUID REFERENCES categories(id),
    image_url TEXT,
    language TEXT DEFAULT 'ko',
    is_active BOOLEAN DEFAULT true,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    bookmark_count INTEGER DEFAULT 0,
    
    -- 수동 포스팅 전용 필드
    is_manual_post BOOLEAN DEFAULT true,
    admin_id UUID,
    admin_name TEXT,
    is_draft BOOLEAN DEFAULT false,
    last_modified TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create post_tags junction table
CREATE TABLE IF NOT EXISTS post_tags (
    post_id UUID REFERENCES nutrition_posts(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

-- Create post_modification_history table
CREATE TABLE IF NOT EXISTS post_modification_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES nutrition_posts(id) ON DELETE CASCADE,
    admin_id UUID,
    admin_name TEXT,
    changes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_nutrition_posts_category_id ON nutrition_posts(category_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_posts_is_active ON nutrition_posts(is_active);
CREATE INDEX IF NOT EXISTS idx_nutrition_posts_is_draft ON nutrition_posts(is_draft);
CREATE INDEX IF NOT EXISTS idx_nutrition_posts_admin_id ON nutrition_posts(admin_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_posts_created_at ON nutrition_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_nutrition_posts_source_type ON nutrition_posts(source_type);
CREATE INDEX IF NOT EXISTS idx_post_tags_post_id ON post_tags(post_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag_id ON post_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

-- Insert default categories
INSERT INTO categories (name, description) VALUES
('diet', '식단 관련 영양 정보'),
('supplements', '영양 보충제 관련 정보'),
('research', '영양학 연구 정보'),
('trends', '영양 트렌드 정보')
ON CONFLICT (name) DO NOTHING;

-- Create function to update post_count in categories
CREATE OR REPLACE FUNCTION update_category_post_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE categories SET post_count = post_count + 1 WHERE id = NEW.category_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE categories SET post_count = post_count - 1 WHERE id = OLD.category_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.category_id != NEW.category_id THEN
            UPDATE categories SET post_count = post_count - 1 WHERE id = OLD.category_id;
            UPDATE categories SET post_count = post_count + 1 WHERE id = NEW.category_id;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update category post counts
CREATE TRIGGER trigger_update_category_post_count
    AFTER INSERT OR UPDATE OR DELETE ON nutrition_posts
    FOR EACH ROW EXECUTE FUNCTION update_category_post_count();

-- Create function to update post_count in tags
CREATE OR REPLACE FUNCTION update_tag_post_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE tags SET post_count = post_count + 1 WHERE id = NEW.tag_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE tags SET post_count = post_count - 1 WHERE id = OLD.tag_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update tag post counts
CREATE TRIGGER trigger_update_tag_post_count
    AFTER INSERT OR DELETE ON post_tags
    FOR EACH ROW EXECUTE FUNCTION update_tag_post_count();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at timestamps
CREATE TRIGGER trigger_update_nutrition_posts_updated_at
    BEFORE UPDATE ON nutrition_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();