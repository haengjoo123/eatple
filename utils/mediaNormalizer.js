const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:');
}

function parseDataUrl(dataUrl) {
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
  await fs.mkdir(dir, { recursive: true });
}

async function writeUniqueImage(baseDir, buffer, mime) {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  const ext = extFromMime(mime);
  const fileName = `${hash}${ext}`;
  const filePath = path.join(baseDir, fileName);
  try {
    await fs.access(filePath);
  } catch (_) {
    await fs.writeFile(filePath, buffer);
  }
  return fileName;
}

async function replaceAsync(str, regex, asyncFn) {
  const promises = [];
  str.replace(regex, (match, ...args) => {
    const p = asyncFn(match, ...args);
    promises.push(p);
    return match;
  });
  const data = await Promise.all(promises);
  return str.replace(regex, () => data.shift());
}

/**
 * 포스트 내부의 base64 이미지를 public 경로에 저장하고 URL로 치환한다.
 * @param {Object} postData - { content, imageUrl, thumbnailUrl, id? }
 * @param {string} projectRoot - __dirname 기준 프로젝트 루트
 * @param {string} targetPostId - 저장 경로용 식별자 (미리 생성된 ID)
 * @returns {Promise<Object>} 치환된 필드가 반영된 새 객체
 */
async function normalizePostMedia(postData, projectRoot, targetPostId) {
  const outDir = path.join(projectRoot, 'public', 'nutrition-images', 'content', String(targetPostId));
  await ensureDir(outDir);

  const result = { ...postData };

  // content 내 <img src="data:...">
  if (typeof result.content === 'string' && result.content.includes('data:')) {
    const imgSrcRegex = /(<img\s+[^>]*src=")data:([^"]+)("[^>]*>)/gi;
    result.content = await replaceAsync(result.content, imgSrcRegex, async (m, p1, p2, p3) => {
      const parsed = parseDataUrl(`data:${p2}`);
      if (!parsed) return m;
      const fileName = await writeUniqueImage(outDir, parsed.buffer, parsed.mime);
      const publicUrl = `/nutrition-images/content/${encodeURIComponent(targetPostId)}/${encodeURIComponent(fileName)}`;
      return `${p1}${publicUrl}${p3}`;
    });
  }

  // imageUrl / thumbnailUrl
  for (const key of ['imageUrl', 'thumbnailUrl']) {
    if (isDataUrl(result[key])) {
      const parsed = parseDataUrl(result[key]);
      if (parsed) {
        const fileName = await writeUniqueImage(outDir, parsed.buffer, parsed.mime);
        result[key] = `/nutrition-images/content/${encodeURIComponent(targetPostId)}/${encodeURIComponent(fileName)}`;
      }
    }
  }

  return result;
}

module.exports = { normalizePostMedia };


