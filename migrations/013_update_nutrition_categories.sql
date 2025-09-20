-- 영양정보 카테고리 업데이트 마이그레이션
-- 기존 카테고리를 새로운 건강 중심 카테고리로 변경

-- 기존 카테고리를 새로운 카테고리로 매핑
-- diet -> gut_health (식단 -> 장 건강)
-- supplements -> immunity (영양제 -> 면역력)  
-- research -> general (연구 -> 일반, 기본값으로 처리)
-- trends -> anti_aging (트렌드 -> 항노화)

UPDATE nutrition_info 
SET category = CASE 
    WHEN category = 'diet' THEN 'gut_health'
    WHEN category = 'supplements' THEN 'immunity'
    WHEN category = 'research' THEN 'brain_health'
    WHEN category = 'trends' THEN 'anti_aging'
    ELSE 'immunity' -- 기본값
END
WHERE category IN ('diet', 'supplements', 'research', 'trends');

-- Supabase 테이블도 동일하게 업데이트 (있는 경우)
UPDATE nutrition_posts 
SET category = CASE 
    WHEN category = 'diet' THEN 'gut_health'
    WHEN category = 'supplements' THEN 'immunity'
    WHEN category = 'research' THEN 'brain_health'
    WHEN category = 'trends' THEN 'anti_aging'
    ELSE 'immunity' -- 기본값
END
WHERE category IN ('diet', 'supplements', 'research', 'trends');

-- 카테고리 제약조건이 있다면 업데이트 (테이블별로 확인 필요)
-- ALTER TABLE nutrition_info DROP CONSTRAINT IF EXISTS nutrition_info_category_check;
-- ALTER TABLE nutrition_info ADD CONSTRAINT nutrition_info_category_check 
--     CHECK (category IN ('brain_health', 'cancer', 'cardiovascular', 'blood_sugar', 'ent', 'energy_fatigue',
--                         'eye_health', 'fat_loss', 'gut_health', 'anti_aging', 'immunity', 'bone_joint',
--                         'kidney_urinary', 'liver_health', 'lung_respiratory', 'mens_health', 'womens_health',
--                         'mental_health', 'muscle_exercise', 'oral_health', 'pain', 'pregnancy_parenting',
--                         'skin_hair', 'sleep'));
