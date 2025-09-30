/**
 * base64 인라인 이미지를 외부 URL로 마이그레이션
 * - data/nutrition/nutrition-posts.json 의 content 필드 내 <img src="data:image/...;base64,...."> 를 파일로 저장하고 URL로 치환
 * - 저장 경로: public/nutrition-images/content/{postId}/image_{index}.webp (확장자는 포맷 추출)
 * - 또한 image_url, thumbnail_url 가 data: URL이면 동일 방식으로 추출 후 URL로 치환
 *
 * 보안/품질:
 * - JSON 파싱 에러 시 종료
 * - 파일 시스템 경로는 고정된 public 하위만 사용
 * - 대용량 방지: 동일 해시(sha256) 이미지 중복 저장 회피
 */

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:');
}

function parseDataUrl(dataUrl) {
  // data:[<mediatype>][;base64],<data>
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  const mime = match[1] || 'application/octet-stream';
  const isBase64 = Boolean(match[2]);
  const dataPart = match[3];
  const buffer = isBase64 ? Buffer.from(dataPart, 'base64') : Buffer.from(decodeURIComponent(dataPart), 'utf8');
  return { mime, buffer };
}

function extFromMime(mime) {
  if (!mime) return '.bin';
  if (mime.includes('image/jpeg') || mime.includes('image/jpg')) return '.jpg';
  if (mime.includes('image/png')) return '.png';
  if (mime.includes('image/webp')) return '.webp';
  if (mime.includes('image/gif')) return '.gif';
  if (mime.includes('image/svg+xml')) return '.svg';
  return '.bin';
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function writeUniqueImage(baseDir, buffer, mime) {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  const ext = extFromMime(mime);
  const fileName = `${hash}${ext}`;
  const filePath = path.join(baseDir, fileName);
  try {
    await fsp.access(filePath);
    // already exists
  } catch (_) {
    await fsp.writeFile(filePath, buffer);
  }
  return fileName;
}

async function migrate() {
  const projectRoot = path.join(__dirname, '..');
  const postsPath = path.join(projectRoot, 'data', 'nutrition', 'nutrition-posts.json');
  const publicBase = path.join(projectRoot, 'public', 'nutrition-images', 'content');

  const raw = await fsp.readFile(postsPath, 'utf8');
  let posts;
  try {
    posts = JSON.parse(raw);
  } catch (e) {
    console.error('JSON 파싱 실패:', e.message);
    process.exit(1);
  }

  if (!Array.isArray(posts)) {
    console.error('예상과 다른 데이터 구조입니다. 배열이어야 합니다.');
    process.exit(1);
  }

  let totalImages = 0;
  let changedPosts = 0;

  for (const post of posts) {
    const postId = String(post.id || 'unknown');
    const outDir = path.join(publicBase, postId);
    await ensureDir(outDir);

    let changed = false;

    // 1) content 필드: <img src="data:..."> 치환
    if (typeof post.content === 'string' && post.content.includes('data:')) {
      // 정규식으로 data URL 추출
      const imgSrcRegex = /(<img\s+[^>]*src=")data:([^"]+)("[^>]*>)/gi;
      post.content = await replaceAsync(post.content, imgSrcRegex, async (m, p1, p2, p3) => {
        const dataUrl = `data:${p2}`;
        const parsed = parseDataUrl(dataUrl);
        if (!parsed) return m; // 그대로 둠
        const fileName = await writeUniqueImage(outDir, parsed.buffer, parsed.mime);
        const publicUrl = `/nutrition-images/content/${encodeURIComponent(postId)}/${encodeURIComponent(fileName)}`;
        totalImages += 1;
        changed = true;
        return `${p1}${publicUrl}${p3}`;
      });
    }

    // 2) image_url & thumbnail_url 가 data URL이면 파일로 저장 후 URL 치환
    for (const key of ['image_url', 'thumbnail_url']) {
      if (isDataUrl(post[key])) {
        const parsed = parseDataUrl(post[key]);
        if (parsed) {
          const fileName = await writeUniqueImage(outDir, parsed.buffer, parsed.mime);
          post[key] = `/nutrition-images/content/${encodeURIComponent(postId)}/${encodeURIComponent(fileName)}`;
          totalImages += 1;
          changed = true;
        }
      }
    }

    if (changed) changedPosts += 1;
  }

  // 백업 후 저장
  const backupPath = path.join(projectRoot, 'data', 'backup', `nutritionPosts-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  try { await ensureDir(path.dirname(backupPath)); } catch (_) {}
  await fsp.writeFile(backupPath, raw, 'utf8');
  await fsp.writeFile(postsPath, JSON.stringify(posts, null, 2), 'utf8');

  console.log(`완료: 치환된 이미지 ${totalImages}개, 변경된 포스트 ${changedPosts}개`);
  console.log(`백업: ${backupPath}`);
}

async function replaceAsync(str, regex, asyncFn) {
  const promises = [];
  str.replace(regex, (match, ...args) => {
    const promise = asyncFn(match, ...args);
    promises.push(promise);
    return match;
  });
  const data = await Promise.all(promises);
  return str.replace(regex, () => data.shift());
}

migrate().catch(err => {
  console.error('마이그레이션 실패:', err);
  process.exit(1);
});
