-- 프로모션 카드 관리를 위한 테이블 생성
CREATE TABLE IF NOT EXISTS promotions (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    subtitle VARCHAR(200),
    description TEXT,
    badge VARCHAR(20),
    tag VARCHAR(100),
    theme VARCHAR(50) NOT NULL DEFAULT 'default-theme',
    image_url TEXT,
    icons JSONB, -- 아이콘 배열을 JSON으로 저장
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_promotions_display_order ON promotions(display_order);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(start_date, end_date);

-- 기본 프로모션 데이터 삽입
INSERT INTO promotions (title, subtitle, description, badge, theme, image_url, display_order) VALUES
('생수', '최저가 도전', '15% 쿠폰 받고, 어디든 갑니다', '15%', 'water-theme', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=200&fit=crop', 1),
('Bottle to Bottle', '난 다시 태어나도, 나로 태어날래', '원더플 캠페인 시즌 6', NULL, 'bottle-theme', NULL, 2),
('여행 빅세일', '쿨 바캉스 타임', '항공/호텔/패키지/렌터카 ~10%', NULL, 'travel-theme', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop', 3),
('건강식품', '자연의 힘', '유기농 건강식품 20% 할인', '20%', 'food-theme', 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=300&h=200&fit=crop', 4),
('뷰티 케어', '아름다움의 시작', '프리미엄 뷰티 제품 25% 할인', NULL, 'beauty-theme', NULL, 5),
('피트니스', '강한 몸, 건강한 삶', '운동용품 및 보조제 30% 할인', NULL, 'fitness-theme', 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=200&fit=crop', 6),
('비타민', '필수 영양소', '종합비타민 18% 할인', '18%', 'vitamin-theme', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&h=200&fit=crop', 7),
('영양제', '건강한 선택', '프리미엄 영양제 22% 할인', NULL, 'supplement-theme', NULL, 8);

-- 아이콘이 있는 프로모션 업데이트
UPDATE promotions SET 
    tag = '플라스틱 순환 캠페인',
    icons = '["🥤", "📦", "🏠", "⭐"]'::jsonb
WHERE title = 'Bottle to Bottle';

UPDATE promotions SET 
    tag = '뷰티 트렌드',
    icons = '["✨", "💄", "🌸", "💎"]'::jsonb
WHERE title = '뷰티 케어';

UPDATE promotions SET 
    tag = '건강 관리',
    icons = '["💊", "🌿", "💪", "⭐"]'::jsonb
WHERE title = '영양제';
