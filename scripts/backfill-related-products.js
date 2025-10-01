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

function readLocalProducts() {
  const p = path.join(__dirname, '../data/nutrition/post-related-products.json');
  const raw = fs.readFileSync(p, 'utf8');
  const arr = JSON.parse(raw);
  return Array.isArray(arr) ? arr : [];
}

function buildDesiredByPost(localProducts) {
  // 그룹화 및 1..3 재매핑
  const byPost = new Map();
  for (const item of localProducts) {
    if (!item || !item.post_id) continue;
    if (!byPost.has(item.post_id)) byPost.set(item.post_id, []);
    byPost.get(item.post_id).push(item);
  }

  // 각 포스트별로 최대 3개 선택, display_order 1..3으로 재지정
  const desired = new Map();
  for (const [postId, items] of byPost.entries()) {
    const sorted = items
      .slice()
      .sort((a, b) => {
        // 우선순위: 유효한 display_order(>0) 오름차순 -> created_at 시간 오름차순
        const ao = (a.display_order && a.display_order > 0) ? a.display_order : 9999;
        const bo = (b.display_order && b.display_order > 0) ? b.display_order : 9999;
        if (ao !== bo) return ao - bo;
        const at = a.created_at ? Date.parse(a.created_at) : 0;
        const bt = b.created_at ? Date.parse(b.created_at) : 0;
        return at - bt;
      })
      .slice(0, 3);

    const mapped = sorted.map((it, idx) => ({
      post_id: postId,
      display_order: idx + 1,
      product_name: it.product_name || null,
      product_link: it.product_link || null,
      product_price: it.product_price || null,
      product_image_url: it.product_image_url || null,
    }));
    desired.set(postId, mapped);
  }
  return desired;
}

async function fetchExistingForPosts(postIds) {
  const { data, error } = await supabase
    .from('post_related_products')
    .select('post_id, display_order')
    .in('post_id', postIds);
  if (error) throw error;
  const map = new Map();
  for (const row of data || []) {
    const key = row.post_id;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(row.display_order);
  }
  return map;
}

async function insertMissing(batch) {
  if (batch.length === 0) return { ok: 0, fail: 0 };
  const { error } = await supabase.from('post_related_products').insert(batch);
  if (error) {
    // 개별로 재시도 (부분 실패 상황 대비)
    let ok = 0, fail = 0;
    for (const row of batch) {
      const { error: e } = await supabase.from('post_related_products').insert(row);
      if (e) fail++; else ok++;
    }
    return { ok, fail };
  }
  return { ok: batch.length, fail: 0 };
}

async function main() {
  try {
    console.log('🚀 관련상품 보강 시작...');
    const localProducts = readLocalProducts();
    const desired = buildDesiredByPost(localProducts);

    const allPostIds = Array.from(desired.keys());
    console.log(`📋 대상 포스트: ${allPostIds.length}개`);

    let totalOk = 0, totalFail = 0;
    const chunkSize = 100;
    for (let i = 0; i < allPostIds.length; i += chunkSize) {
      const chunkPostIds = allPostIds.slice(i, i + chunkSize);
      const existingMap = await fetchExistingForPosts(chunkPostIds);

      const toInsert = [];
      for (const postId of chunkPostIds) {
        const desiredRows = desired.get(postId) || [];
        const existingOrders = existingMap.get(postId) || new Set();
        for (const row of desiredRows) {
          if (!existingOrders.has(row.display_order)) {
            toInsert.push(row);
          }
        }
      }

      // 대용량 삽입 배치
      const insertBatchSize = 500;
      for (let j = 0; j < toInsert.length; j += insertBatchSize) {
        const batch = toInsert.slice(j, j + insertBatchSize);
        const { ok, fail } = await insertMissing(batch);
        totalOk += ok; totalFail += fail;
      }
      console.log(`✅ 진행: ${Math.min(i + chunkPostIds.length, allPostIds.length)}/${allPostIds.length}`);
    }

    console.log('🎉 보강 완료');
    console.log(`- 삽입 성공: ${totalOk}, 실패: ${totalFail}`);

    // 검증: 3개 미만 포스트 수
    const { data: under3, error: qErr } = await supabase
      .from('post_related_products')
      .select('post_id', { count: 'estimated' })
      .group('post_id');
    if (qErr) {
      console.log('검증 쿼리 건너뜀');
    }
  } catch (e) {
    console.error('❌ 오류:', e);
    process.exit(1);
  }
}

main();
