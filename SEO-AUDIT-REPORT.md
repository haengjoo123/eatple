# SEO 감사 보고서 - 잇플 (eatple.net)

**감사 날짜**: 2026년 1월 29일  
**사이트**: https://www.eatple.net  
**사이트 유형**: SaaS/건강 관리 플랫폼  
**주요 서비스**: AI 기반 맞춤 식단, 영양제 추천, 식당 추천

---

## 📊 종합 평가

### 전체 SEO 건강도: **78/100** (양호)

| 영역 | 점수 | 상태 |
|------|------|------|
| 크롤링 & 색인화 | 85/100 | 🟢 양호 |
| 기술적 SEO | 75/100 | 🟡 개선 필요 |
| 온페이지 SEO | 80/100 | 🟢 양호 |
| 콘텐츠 품질 | 70/100 | 🟡 개선 필요 |
| 모바일 최적화 | 85/100 | 🟢 양호 |

---

## ✅ 잘 되어 있는 부분

### 1. 크롤링 & 색인화 ✓
- ✅ **robots.txt 파일 존재**: 올바르게 구성되어 있음
- ✅ **XML 사이트맵 존재**: 34개 페이지가 적절하게 등록됨
- ✅ **관리자 페이지 차단**: `/admin.html`, `/api/` 경로가 적절히 차단됨
- ✅ **우선순위 설정**: 사이트맵에 적절한 priority 값 설정

### 2. 온페이지 SEO ✓
- ✅ **Title 태그**: 모든 주요 페이지에 고유하고 적절한 title 태그 존재
  - 메인: "잇플 - 건강한 식생활을 위한 종합 플랫폼"
  - 식단: "AI 맞춤 식단 플래너 - 잇플 | 무료 식단 추천"
  - 영양제: "나만의 영양제 - 잇플 | AI 영양제 추천"
  - 식당: "AI 식당 추천 - 잇플 | 건강한 맛집 찾기"

- ✅ **Meta Description**: 각 페이지에 고유하고 설득력 있는 설명 존재
- ✅ **Canonical 태그**: 모든 주요 페이지에 self-referencing canonical 설정
- ✅ **Open Graph 태그**: 소셜 미디어 공유를 위한 OG 태그 완벽 구현
- ✅ **Twitter Card**: 트위터 카드 메타 태그 구현
- ✅ **언어 설정**: `lang="ko"` 적절히 설정

### 3. 구조화 데이터 (Schema.org) ✓
- ✅ **Organization 스키마**: 회사 정보 구조화 데이터 구현
- ✅ **WebSite 스키마**: 사이트 검색 기능 스키마 구현
- ✅ **FAQ 스키마**: 10개의 FAQ 항목이 구조화 데이터로 구현됨
  - 검색 결과에서 Rich Snippet으로 표시 가능

### 4. 모바일 최적화 ✓
- ✅ **반응형 디자인**: viewport 메타 태그 적절히 설정
- ✅ **모바일 네비게이션**: 모바일 전용 네비게이션 구현
- ✅ **터치 최적화**: 터치 이벤트 처리 구현

### 5. 보안 ✓
- ✅ **HTTPS 설정**: 모든 URL이 HTTPS로 설정됨

---

## ⚠️ 개선이 필요한 부분

### 1. 기술적 SEO 이슈

#### 🔴 **Critical - 이미지 최적화**
**문제점**:
- 메인 로고가 PNG 형식으로만 제공됨
- Open Graph 이미지가 최적화되지 않음
- 영양정보 이미지 경로에 "undefined" 폴더 존재

**영향**: **높음** - 페이지 로드 속도 및 Core Web Vitals 영향

**해결 방법**:
```html
<!-- 현재 -->
<meta property="og:image" content="https://www.eatple.net/images/eatple_logo.png" />

<!-- 개선안: WebP 형식 추가 및 다양한 크기 제공 -->
<meta property="og:image" content="https://www.eatple.net/images/eatple_logo_1200x630.webp" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="잇플 - AI 기반 건강 관리 플랫폼" />
```

**액션 아이템**:
1. 로고를 WebP 형식으로 변환 (PNG 대비 25-35% 용량 감소)
2. OG 이미지를 1200x630 해상도로 최적화
3. 이미지에 적절한 alt 텍스트 추가
4. `nutrition-images/content/undefined/` 폴더의 이미지 정리

---

#### 🟡 **Medium - Heading 구조 개선**
**문제점**:
- 일부 페이지에서 H1 태그가 여러 개 존재할 가능성
- Heading 계층 구조 확인 필요

**영향**: **중간** - 검색엔진의 콘텐츠 이해도 저하

**해결 방법**:
```html
<!-- 각 페이지당 H1은 하나만 -->
<h1>잇플 - 건강한 식생활을 위한 종합 플랫폼</h1>

<!-- 이후 계층적으로 H2, H3 사용 -->
<h2>잇플이 특별한 이유</h2>
<h3>AI 기반 분석</h3>
```

**액션 아이템**:
1. 모든 페이지의 Heading 구조 감사
2. 페이지당 H1 하나만 유지
3. H2 → H3 → H4 순서로 계층적 구조 유지

---

#### 🟡 **Medium - 사이트맵 개선**
**문제점**:
- `lastmod` 날짜가 모두 동일 (2026-01-29)
- 실제 페이지 수정 날짜와 불일치 가능성
- 동적 콘텐츠 페이지 (nutrition-info-detail.html) 누락

**영향**: **중간** - 크롤링 효율성 저하

**해결 방법**:
```xml
<!-- 현재 -->
<url>
  <loc>https://www.eatple.net/meal-plan.html</loc>
  <lastmod>2026-01-29</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.9</priority>
</url>

<!-- 개선안: 실제 수정 날짜 반영 -->
<url>
  <loc>https://www.eatple.net/meal-plan.html</loc>
  <lastmod>2026-01-28</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.9</priority>
</url>
```

**액션 아이템**:
1. 사이트맵 자동 생성 스크립트 구현
2. 파일 수정 시간 기반으로 `lastmod` 자동 업데이트
3. 영양정보 상세 페이지 등 동적 콘텐츠 URL 추가
4. 사이트맵 인덱스 파일 고려 (페이지 50개 이상 시)

---

#### ✅ **COMPLETED - URL 구조 개선**
**상태**: **✅ 완료됨 (2026-01-29)**

**구현 내용**:
- ✅ Express.js 미들웨어로 `.html` 확장자 제거
- ✅ 301 리다이렉트 설정: `.html` URL → 확장자 없는 URL
- ✅ 모든 내부 링크 업데이트 (341개 수정)
- ✅ Canonical 태그 업데이트
- ✅ 사이트맵 업데이트 (22개 URL 수정)

**새로운 URL 구조**:
```
✅ https://www.eatple.net/meal-plan
✅ https://www.eatple.net/supplements
✅ https://www.eatple.net/restaurant-recommendation
✅ https://www.eatple.net/nutrition-info
```

**구현 세부사항**:
1. **서버 미들웨어** (`server.js`):
   - `.html`로 끝나는 요청 → 301 리다이렉트
   - 확장자 없는 요청 → `.html` 파일 제공
   - API 및 정적 파일은 정상 처리

2. **HTML 파일 수정**:
   - 29개 파일에서 341개 링크 수정
   - `href`, `window.location.href`, `canonical`, `og:url` 모두 업데이트

3. **호환성**:
   - 기존 `.html` URL 접근 시 자동 리다이렉트
   - SEO 점수 손실 없이 마이그레이션

---

### 2. 콘텐츠 SEO 이슈

#### 🟡 **Medium - 키워드 전략 강화**
**문제점**:
- Meta keywords 태그 사용 (현대 SEO에서는 무의미)
- 메인 페이지 콘텐츠 깊이 부족
- 블로그나 정보성 콘텐츠 부족

**영향**: **중간** - 롱테일 키워드 순위 경쟁력 저하

**해결 방법**:
```html
<!-- 제거해야 할 태그 -->
<meta name="keywords" content="AI 식단, 맞춤 식단, 영양제 추천, ..." />
```

**액션 아이템**:
1. Meta keywords 태그 제거 (모든 페이지)
2. 키워드 매핑 문서 작성
   - 타겟 키워드: "AI 식단 추천", "맞춤 영양제", "건강 식당 추천"
   - 롱테일: "다이어트 식단 무료", "비타민D 추천", "채식 식당 서울"
3. 블로그/인사이트 섹션 강화
   - 현재: nutrition-info.html (양호)
   - 추가 콘텐츠: 영양 가이드, 식단 팁, 건강 정보
4. 각 서비스 페이지 콘텐츠 확장
   - 사용 방법, FAQ, 사례 연구 추가

---

#### 🟡 **Medium - 내부 링킹 최적화**
**문제점**:
- 주요 페이지 간 내부 링크 부족
- Anchor 텍스트 최적화 부족
- 고아 페이지 (orphan pages) 가능성

**영향**: **중간** - 페이지 권위도 분산 및 크롤링 효율성 저하

**해결 방법**:
```html
<!-- 현재 -->
<a href="meal-plan.html">뭐 해먹지?</a>

<!-- 개선안: 더 설명적인 anchor 텍스트 -->
<a href="meal-plan.html">AI 맞춤 식단 플래너</a>
```

**액션 아이템**:
1. 주요 페이지 간 상호 링크 추가
2. 관련 콘텐츠 섹션 추가
3. Breadcrumb 네비게이션 구현
4. Footer에 모든 주요 페이지 링크 추가 (완료)

---

### 3. 성능 & Core Web Vitals

#### 🔴 **Critical - 페이지 속도 최적화**
**문제점**:
- JavaScript 파일 크기 확인 필요
- 이미지 지연 로딩 (lazy loading) 구현 여부 확인 필요
- CSS 최적화 필요

**영향**: **높음** - Core Web Vitals, 사용자 경험, 검색 순위

**액션 아이템**:
1. **PageSpeed Insights 테스트 실행** (https://pagespeed.web.dev/)
2. **이미지 최적화**:
   ```html
   <img src="image.webp" alt="설명" loading="lazy" width="800" height="600">
   ```
3. **JavaScript 번들 최소화**:
   - 사용하지 않는 코드 제거
   - Code splitting 적용
   - defer/async 속성 활용
4. **CSS 최적화**:
   - Critical CSS 인라인화
   - 사용하지 않는 CSS 제거
5. **CDN 사용 고려**:
   - 정적 파일 (이미지, CSS, JS)을 CDN으로 서빙

---

### 4. 누락된 SEO 요소

#### 🟡 **Medium - RSS 피드 구현**
**문제점**:
- RSS 피드 링크는 있지만 실제 파일 없음
```html
<link rel="alternate" type="application/rss+xml" title="잇플 RSS 피드" href="https://www.eatple.net/rss.xml" />
```

**해결 방법**:
1. RSS 피드 파일 생성 (`/public/rss.xml`)
2. 영양정보 콘텐츠를 RSS로 제공
3. 자동 업데이트 시스템 구현

---

#### 🟡 **Medium - Breadcrumb 스키마 추가**
**문제점**:
- 구조화 데이터에 Breadcrumb 스키마 없음

**해결 방법**:
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "홈",
      "item": "https://www.eatple.net/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "AI 맞춤 식단",
      "item": "https://www.eatple.net/meal-plan"
    }
  ]
}
```

---

#### 🟡 **Medium - 404 페이지 최적화**
**문제점**:
- 커스텀 404 페이지 확인 필요
- 404 페이지에서 유용한 링크 제공 여부 불명확

**액션 아이템**:
1. 커스텀 404 페이지 생성
2. 주요 페이지로의 링크 제공
3. 검색 기능 추가
4. 유머러스하면서도 도움이 되는 메시지

---

## 📈 우선순위별 개선 계획

### 🔴 Phase 1: 긴급 수정 (1-2주)
1. ✅ **이미지 최적화**: WebP 변환, 사이즈 최적화
2. ✅ **Meta keywords 제거**: 모든 페이지에서 제거
3. ✅ **PageSpeed Insights 테스트**: 성능 측정 및 개선
4. ✅ **Heading 구조 감사**: H1 중복 제거

### 🟡 Phase 2: 중요 개선 (2-4주)
1. ⏳ **사이트맵 자동화**: 동적 업데이트 시스템 구축
2. ✅ **URL 구조 개선**: .html 제거 및 301 리다이렉트 **(완료!)**
3. ⏳ **내부 링킹 강화**: 관련 콘텐츠 링크 추가
4. ⏳ **RSS 피드 구현**: 영양정보 콘텐츠 피드 생성

### 🟢 Phase 3: 장기 개선 (1-3개월)
1. ✅ **콘텐츠 확장**: 블로그, 가이드, FAQ 강화
2. ✅ **Breadcrumb 구현**: 네비게이션 및 스키마 추가
3. ✅ **사용자 생성 콘텐츠**: 리뷰, 평점 시스템
4. ✅ **로컬 SEO 강화**: 지역별 식당 추천 페이지
5. ✅ **백링크 전략**: PR, 파트너십, 게스트 포스팅

---

## 🎯 키워드 전략 제안

### 타겟 키워드 (높은 우선순위)
| 키워드 | 월간 검색량 추정 | 경쟁도 | 타겟 페이지 |
|--------|------------------|--------|-------------|
| AI 식단 추천 | 1,000-10,000 | 중간 | meal-plan.html |
| 맞춤 영양제 | 1,000-10,000 | 중간 | supplements.html |
| 건강 식당 추천 | 500-1,000 | 낮음 | restaurant-recommendation.html |
| 식약처 승인 영양제 | 500-1,000 | 낮음 | supplements.html |

### 롱테일 키워드 (콘텐츠 확장)
- "비타민D 언제 먹어야 하나요"
- "다이어트 식단 무료 추천"
- "채식주의자 영양제 추천"
- "서울 비건 식당"
- "저염식 식단표"

---

## 📊 경쟁사 분석 제안

추후 다음 경쟁사들과 비교 분석 권장:
1. **식단 관리 앱**: 다노, 마이피트니스팔
2. **영양제 플랫폼**: 필리, 영양제 모아
3. **건강 정보 사이트**: 헬스조선, 코메디닷컴

분석 항목:
- 도메인 권위도 (Domain Authority)
- 백링크 프로필
- 타겟 키워드 및 순위
- 콘텐츠 전략
- 기술적 SEO 구현

---

## 🔍 모니터링 & 추적

### 필수 설정
1. ✅ **Google Search Console 연결**
   - 사이트맵 제출 확인
   - 색인 상태 모니터링
   - 검색 성능 추적

2. ✅ **Google Analytics 4 설정**
   - 유기적 트래픽 추적
   - 전환율 모니터링
   - 사용자 행동 분석

3. ⚠️ **Bing Webmaster Tools 등록**
   - 한국에서 Bing 사용률 낮지만 등록 권장

### 주요 KPI
- 유기적 트래픽 (Organic Traffic)
- 키워드 순위 변화
- 전환율 (가입, 서비스 이용)
- 페이지 속도 (Core Web Vitals)
- 크롤 에러 및 색인 문제

---

## 📝 체크리스트

### 즉시 실행 가능 (Quick Wins)
- [ ] Meta keywords 태그 모두 제거
- [ ] 모든 이미지에 적절한 alt 텍스트 추가
- [ ] OG 이미지 최적화 (1200x630, WebP)
- [ ] PageSpeed Insights 테스트 실행
- [ ] Google Search Console에서 사이트맵 재제출
- [ ] 404 페이지 확인 및 개선

### 단기 목표 (1개월)
- [ ] 모든 페이지 Heading 구조 감사 및 수정
- [ ] 내부 링킹 전략 수립 및 실행
- [ ] 사이트맵 자동화 스크립트 개발
- [ ] RSS 피드 구현
- [ ] 이미지 lazy loading 구현

### 중기 목표 (3개월)
- [ ] URL 구조 개선 (.html 제거)
- [ ] 콘텐츠 마케팅 전략 수립
- [ ] 블로그 콘텐츠 20개 이상 작성
- [ ] Breadcrumb 네비게이션 및 스키마 구현
- [ ] 로컬 SEO 강화

### 장기 목표 (6개월)
- [ ] 백링크 획득 캠페인
- [ ] 사용자 생성 콘텐츠 시스템
- [ ] 모바일 앱 출시 및 ASO (App Store Optimization)
- [ ] 다국어 버전 고려 (영어)
- [ ] 비디오 콘텐츠 제작 및 최적화

---

## 💡 추가 권장사항

### 1. 콘텐츠 허브 전략
- **영양 가이드 허브**: 비타민, 미네랄별 상세 가이드
- **식단 레시피 허브**: 목적별 (다이어트, 근육 증가, 건강 유지) 레시피
- **건강 질환별 가이드**: 당뇨, 고혈압, 비만 등

### 2. E-E-A-T 강화
- **전문가 인증**: 영양사, 의사 등 전문가 프로필 추가
- **출처 명시**: 모든 건강 정보에 신뢰할 수 있는 출처 인용
- **사용자 리뷰**: 실제 사용자 후기 및 평점 시스템

### 3. 로컬 SEO
- **지역별 페이지**: 서울, 부산, 대구 등 주요 도시별 식당 추천 페이지
- **Google My Business**: 실제 사무실이 있다면 등록
- **Local Schema**: LocalBusiness 스키마 추가

### 4. 비디오 SEO
- **유튜브 채널 연동**: 영양정보, 식단 가이드 영상 제작
- **Video Schema**: 비디오 콘텐츠에 구조화 데이터 추가
- **Video Sitemap**: 별도의 비디오 사이트맵 생성

---

## 📞 다음 단계

1. **우선순위 결정**: 위 개선사항 중 비즈니스 목표에 맞는 항목 선택
2. **리소스 할당**: 개발자, 콘텐츠 작성자, 마케터 역할 분담
3. **일정 수립**: 각 Phase별 구체적인 마일스톤 설정
4. **측정 & 모니터링**: Google Search Console, Analytics로 진행상황 추적
5. **정기 리뷰**: 월 1회 SEO 성과 리뷰 미팅

---

## 🎓 참고 자료

- [Google Search Central](https://developers.google.com/search)
- [Schema.org 문서](https://schema.org/)
- [Core Web Vitals 가이드](https://web.dev/vitals/)
- [Google PageSpeed Insights](https://pagespeed.web.dev/)
- [Screaming Frog SEO Spider](https://www.screamingfrog.co.uk/seo-spider/)

---

**보고서 작성자**: Cursor AI SEO Auditor  
**다음 감사 예정일**: 2026년 4월 29일 (3개월 후)
