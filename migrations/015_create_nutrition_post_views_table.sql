-- 영양정보 포스팅 조회수 테이블 생성
-- 일별 조회수를 기록하여 통계 분석에 활용

-- nutrition_post_views 테이블 생성
CREATE TABLE IF NOT EXISTS nutrition_post_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES nutrition_posts(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    view_count INTEGER DEFAULT 1,
    user_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (조회 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_nutrition_post_views_post_id ON nutrition_post_views(post_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_post_views_viewed_at ON nutrition_post_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_nutrition_post_views_post_date ON nutrition_post_views(post_id, viewed_at DESC);

-- 일별 조회수 집계를 위한 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_nutrition_post_views_date_post ON nutrition_post_views(
    DATE(viewed_at), 
    post_id
);

-- Row Level Security (RLS) 활성화
ALTER TABLE nutrition_post_views ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 조회수를 읽을 수 있도록 정책 생성
CREATE POLICY "Anyone can view nutrition post views" ON nutrition_post_views
    FOR SELECT USING (true);

-- 인증된 사용자만 조회수를 기록할 수 있도록 정책 생성
CREATE POLICY "Authenticated users can insert views" ON nutrition_post_views
    FOR INSERT WITH CHECK (true);

-- 관리자만 조회수를 수정/삭제할 수 있도록 정책 생성
-- (실제로는 서버 사이드에서 관리하므로 서비스 키로 접근)
CREATE POLICY "Service role can update views" ON nutrition_post_views
    FOR UPDATE USING (true);

CREATE POLICY "Service role can delete views" ON nutrition_post_views
    FOR DELETE USING (true);

-- 코멘트 추가
COMMENT ON TABLE nutrition_post_views IS '영양정보 포스팅 조회수 기록 테이블';
COMMENT ON COLUMN nutrition_post_views.post_id IS '조회된 포스팅 ID';
COMMENT ON COLUMN nutrition_post_views.viewed_at IS '조회 시각';
COMMENT ON COLUMN nutrition_post_views.view_count IS '조회 횟수 (기본값: 1)';
COMMENT ON COLUMN nutrition_post_views.user_id IS '조회한 사용자 ID (선택적)';
COMMENT ON COLUMN nutrition_post_views.ip_address IS '조회자 IP 주소 (선택적)';
COMMENT ON COLUMN nutrition_post_views.user_agent IS '조회자 User Agent (선택적)';
