# 영양정보 조회수 분석 기능 설정 가이드

## 개요

관리자 페이지에서 영양정보 포스팅의 조회수를 분석하고 통계를 확인할 수 있는 기능입니다.

### 주요 기능

1. **오늘 조회수 통계**: 금일 조회수 총합 및 포스팅별 조회수 상세
2. **최근 7일 조회수 그래프**: Chart.js를 활용한 시각화된 일별 조회수 추이
3. **상위 조회수 TOP 10**: 가장 많이 조회된 포스팅 순위

## 설치 및 설정

### 1. 데이터베이스 마이그레이션

#### 자동 마이그레이션 (권장)

```bash
# Node.js 스크립트 실행
node scripts/create-nutrition-views-table.js
```

#### 수동 마이그레이션

Supabase 대시보드에서:

1. **SQL Editor** 메뉴로 이동
2. `migrations/015_create_nutrition_post_views_table.sql` 파일 내용을 복사
3. SQL Editor에 붙여넣고 **Run** 버튼 클릭

### 2. 테이블 구조

```sql
-- nutrition_post_views 테이블
CREATE TABLE nutrition_post_views (
    id UUID PRIMARY KEY,
    post_id UUID REFERENCES nutrition_posts(id),
    viewed_at TIMESTAMP,
    view_count INTEGER DEFAULT 1,
    user_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP
);

-- 인덱스
CREATE INDEX idx_nutrition_post_views_post_id ON nutrition_post_views(post_id);
CREATE INDEX idx_nutrition_post_views_viewed_at ON nutrition_post_views(viewed_at DESC);
CREATE INDEX idx_nutrition_post_views_post_date ON nutrition_post_views(post_id, viewed_at DESC);
```

## 사용 방법

### 관리자 페이지 접근

1. 관리자 계정으로 로그인
2. `/admin.html` 페이지 접속
3. **영양정보 관리** 탭 클릭

### 기능 설명

#### 1. 오늘 조회수 카드

- 실시간 금일 조회수 표시
- 클릭하면 상세 모달 오픈
- 포스팅별 조회수, 비율, 카테고리 확인 가능

#### 2. 최근 7일 조회수 그래프

- Chart.js 라인 차트로 시각화
- 일별 조회수 추이 확인
- 호버 시 상세 정보 표시

#### 3. 상위 조회수 TOP 10

- 전체 기간 기준 인기 포스팅
- 포스팅 제목, 카테고리, 조회수 표시
- 클릭하면 포스팅 상세 페이지로 이동

## API 엔드포인트

### 1. 포스팅 통계 조회

```
GET /api/admin/manual-posting/stats
```

**응답 예시:**
```json
{
  "success": true,
  "stats": {
    "totalPosts": 50,
    "publishedPosts": 45,
    "draftPosts": 3,
    "inactivePosts": 2,
    "todayViews": 127
  }
}
```

### 2. 조회수 분석 데이터 조회

```
GET /api/admin/manual-posting/views-analytics?days=7
```

**파라미터:**
- `days`: 조회 기간 (기본값: 7)

**응답 예시:**
```json
{
  "success": true,
  "chartData": [
    { "date": "2026-01-21", "views": 45 },
    { "date": "2026-01-22", "views": 52 },
    ...
  ],
  "topPosts": [
    {
      "id": "uuid",
      "title": "비타민D의 효능",
      "view_count": 234,
      "category": "비타민"
    },
    ...
  ]
}
```

### 3. 오늘 조회수 상세

```
GET /api/admin/manual-posting/today-views-detail
```

**응답 예시:**
```json
{
  "success": true,
  "data": {
    "totalViews": 127,
    "posts": [
      {
        "id": "uuid",
        "title": "비타민D의 효능",
        "category": "비타민",
        "todayViews": 45
      },
      ...
    ]
  }
}
```

## 조회수 기록 로직

### 자동 조회수 증가

포스팅 상세 페이지(`/api/nutrition-info/:id`) 접근 시:

1. `nutrition_posts.view_count` 필드 증가
2. `nutrition_post_views` 테이블에 조회 기록 저장
   - 조회 시각
   - 사용자 ID (로그인한 경우)
   - IP 주소
   - User Agent

### 데이터 보존

- 조회 기록은 영구 보관
- 일별/월별 집계 가능
- 사용자 패턴 분석 가능

## 성능 최적화

### 인덱스 활용

- `post_id`: 포스팅별 조회 속도 향상
- `viewed_at`: 시간 범위 필터링 최적화
- `(post_id, viewed_at)`: 복합 인덱스로 포스팅별 시간순 조회 최적화
- `(DATE(viewed_at), post_id)`: 일별 집계 최적화

### 캐싱 전략

- 대시보드 통계는 5분 캐시
- 차트 데이터는 10분 캐시
- 상세 조회는 실시간 반영

## 트러블슈팅

### 1. 테이블 생성 실패

**증상:** `nutrition_post_views does not exist` 오류

**해결 방법:**
```bash
# 스크립트 재실행
node scripts/create-nutrition-views-table.js

# 또는 Supabase 대시보드에서 수동 실행
```

### 2. 조회수가 기록되지 않음

**확인 사항:**
- RLS 정책이 올바르게 설정되어 있는지 확인
- `SUPABASE_URL`, `SUPABASE_KEY` 환경 변수 확인
- 서버 로그에서 오류 메시지 확인

```bash
# 로그 확인
tail -f logs/app.log
```

### 3. 차트가 표시되지 않음

**확인 사항:**
- Chart.js 라이브러리 로드 확인
- 브라우저 콘솔에서 JavaScript 오류 확인
- API 응답 데이터 형식 확인

## 향후 개선 사항

- [ ] 월별/연도별 조회수 집계
- [ ] 카테고리별 조회수 분석
- [ ] 사용자 행동 패턴 분석
- [ ] 조회수 기반 자동 추천 알고리즘
- [ ] 엑셀 다운로드 기능
- [ ] 실시간 조회수 업데이트 (WebSocket)

## 라이선스

이 기능은 잇플(Eatple) 프로젝트의 일부입니다.

## 문의

기술적 문의나 버그 리포트는 GitHub Issues를 통해 제출해주세요.
