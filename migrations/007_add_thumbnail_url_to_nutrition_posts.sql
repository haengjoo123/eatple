-- 영양정보 포스팅 테이블에 썸네일 URL 컬럼 추가
-- Migration: 007_add_thumbnail_url_to_nutrition_posts.sql

-- nutrition_posts 테이블에 thumbnail_url 컬럼 추가
ALTER TABLE nutrition_posts 
ADD COLUMN thumbnail_url TEXT;

-- 썸네일 URL 컬럼에 대한 코멘트 추가
COMMENT ON COLUMN nutrition_posts.thumbnail_url IS '영양정보 포스팅의 썸네일 이미지 URL';

-- 인덱스 추가 (썸네일이 있는 포스팅을 빠르게 조회하기 위해)
CREATE INDEX idx_nutrition_posts_thumbnail_url ON nutrition_posts(thumbnail_url) 
WHERE thumbnail_url IS NOT NULL;