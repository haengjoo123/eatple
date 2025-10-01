const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase env missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function safeReadJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

async function main() {
  try {
    console.log('🚀 카테고리 마이그레이션 시작...');
    const postsPath = path.join(__dirname, '../data/nutrition/nutrition-posts.json');
    const categoriesPath = path.join(__dirname, '../data/nutrition/categories.json');

    const localPosts = safeReadJson(postsPath);
    const localCategories = safeReadJson(categoriesPath);

    // 로컬 카테고리 매핑
    const localCategoryIdToName = new Map();
    for (const c of localCategories) {
      if (c && c.id && c.name) localCategoryIdToName.set(c.id, c.name);
    }

    // Supabase 카테고리 조회 (name -> id)
    const { data: sbCats, error: catErr } = await supabase
      .from('categories')
      .select('id, name');
    if (catErr) throw catErr;
    const sbCategoryNameToId = new Map();
    for (const c of sbCats || []) sbCategoryNameToId.set(c.name, c.id);

    // 업데이트 목록 준비 (post_id -> target category_id)
    const updates = [];
    for (const p of localPosts) {
      if (!p || !p.id) continue;
      let categoryName = null;

      // 1) 포스트에 categories.name 필드가 있으면 우선 사용
      if (p.categories && typeof p.categories.name === 'string') {
        categoryName = p.categories.name;
      }
      // 2) 없으면 category_id로 로컬 카테고리 이름 조회
      if (!categoryName && p.category_id && localCategoryIdToName.has(p.category_id)) {
        categoryName = localCategoryIdToName.get(p.category_id);
      }
      if (!categoryName) continue;

      const sbCategoryId = sbCategoryNameToId.get(categoryName);
      if (!sbCategoryId) continue; // Supabase에 해당 이름이 없으면 건너뜀

      updates.push({ post_id: p.id, category_id: sbCategoryId });
    }

    console.log(`📋 업데이트 대상 포스트: ${updates.length}개`);

    // 배치 업데이트 실행
    let ok = 0, fail = 0;
    const batchSize = 200;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      // 개별 update (eq by id)
      // 병렬 처리하되 너무 많은 동시 연결은 피함
      const tasks = batch.map(async (u) => {
        const { error: upErr } = await supabase
          .from('nutrition_posts')
          .update({ category_id: u.category_id })
          .eq('id', u.post_id);
        if (upErr) { fail++; return; }
        ok++;
      });
      await Promise.all(tasks);
      console.log(`✅ 진행: ${Math.min(i + batch.length, updates.length)}/${updates.length}`);
    }

    console.log('🎉 완료');
    console.log(`- 성공: ${ok}개, 실패: ${fail}개`);

    // 검증: 카테고리 분포 재확인 (일부만)
    const { data: dist } = await supabase.rpc('sql', { sql: '' });
  } catch (e) {
    console.error('❌ 오류:', e);
    process.exit(1);
  }
}

main();
