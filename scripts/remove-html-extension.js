#!/usr/bin/env node

/**
 * HTML 파일에서 .html 확장자를 제거하는 스크립트
 * 
 * 사용법: node scripts/remove-html-extension.js
 */

const fs = require('fs');
const path = require('path');

// 재귀적으로 HTML 파일 찾기
function findHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // node_modules, .git 등 제외
      if (!['node_modules', '.git', 'uploads'].includes(file)) {
        findHtmlFiles(filePath, fileList);
      }
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// public 폴더의 모든 HTML 파일 찾기
const publicDir = path.join(__dirname, '..', 'public');
const htmlFilePaths = findHtmlFiles(publicDir);
const htmlFiles = htmlFilePaths.map(fp => path.relative(publicDir, fp));

console.log(`\n🔍 총 ${htmlFiles.length}개의 HTML 파일을 찾았습니다.\n`);

let totalReplacements = 0;
let totalFiles = 0;

htmlFiles.forEach(file => {
  const filePath = path.join(publicDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  let fileReplacements = 0;

  // href 속성에서 .html 제거 (외부 링크 제외)
  // 예: href="meal-plan.html" → href="meal-plan"
  // 예: href="index.html" → href="/"
  newContent = newContent.replace(/href="([^"http][^"]*?)\.html"/g, (match, p1) => {
    fileReplacements++;
    // index.html은 / 로 변경
    if (p1 === 'index' || p1 === '/index' || p1 === './index') {
      return 'href="/"';
    }
    return `href="${p1}"`;
  });

  // href 속성에서 .html 제거 (상대 경로)
  newContent = newContent.replace(/href='([^'http][^']*?)\.html'/g, (match, p1) => {
    fileReplacements++;
    if (p1 === 'index' || p1 === '/index' || p1 === './index') {
      return "href='/'";
    }
    return `href='${p1}'`;
  });

  // window.location.href에서 .html 제거
  newContent = newContent.replace(/window\.location\.href\s*=\s*["']([^"']*?)\.html["']/g, (match, p1) => {
    fileReplacements++;
    if (p1 === 'index' || p1 === '/index' || p1 === './index') {
      return `window.location.href = "/"`;
    }
    return `window.location.href = "${p1}"`;
  });

  // window.location에서 .html 제거
  newContent = newContent.replace(/window\.location\s*=\s*["']([^"']*?)\.html["']/g, (match, p1) => {
    fileReplacements++;
    if (p1 === 'index' || p1 === '/index' || p1 === './index') {
      return `window.location = "/"`;
    }
    return `window.location = "${p1}"`;
  });

  // canonical 링크에서 .html 제거
  newContent = newContent.replace(/<link\s+rel="canonical"\s+href="([^"]*?)\.html"\s*\/?>/g, (match, p1) => {
    fileReplacements++;
    return `<link rel="canonical" href="${p1}" />`;
  });

  // Open Graph URL에서 .html 제거
  newContent = newContent.replace(/<meta\s+property="og:url"\s+content="([^"]*?)\.html"\s*\/?>/g, (match, p1) => {
    fileReplacements++;
    return `<meta property="og:url" content="${p1}" />`;
  });

  // 변경사항이 있으면 파일 저장
  if (fileReplacements > 0) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✅ ${file}: ${fileReplacements}개 수정`);
    totalReplacements += fileReplacements;
    totalFiles++;
  }
});

console.log(`\n✨ 완료! ${totalFiles}개 파일에서 총 ${totalReplacements}개의 .html 확장자를 제거했습니다.\n`);

// 사이트맵 업데이트
const sitemapPath = path.join(publicDir, 'sitemap.xml');
if (fs.existsSync(sitemapPath)) {
  console.log('📄 사이트맵 업데이트 중...');
  let sitemap = fs.readFileSync(sitemapPath, 'utf8');
  const sitemapReplacements = (sitemap.match(/\.html</g) || []).length;
  
  // sitemap.xml에서 .html 제거
  sitemap = sitemap.replace(/\.html</g, '<');
  
  fs.writeFileSync(sitemapPath, sitemap, 'utf8');
  console.log(`✅ 사이트맵: ${sitemapReplacements}개 수정\n`);
}

console.log('🎉 모든 작업이 완료되었습니다!');
console.log('\n📝 다음 단계:');
console.log('   1. 서버를 재시작하세요: npm start');
console.log('   2. 브라우저에서 테스트하세요:');
console.log('      - http://localhost:3000/');
console.log('      - http://localhost:3000/meal-plan');
console.log('      - http://localhost:3000/supplements');
console.log('   3. 기존 .html URL이 자동으로 리다이렉트되는지 확인하세요');
console.log('      - http://localhost:3000/meal-plan.html → http://localhost:3000/meal-plan\n');
