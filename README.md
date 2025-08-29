# 잇플 (ItPlan) - AI 기반 건강 관리 플랫폼

## 프로젝트 개요

잇플은 AI를 활용한 맞춤형 식단 구성, 영양제 추천, 식당 추천 서비스를 제공하는 건강 관리 플랫폼입니다.

## 주요 기능

### 1. AI 맞춤 식단 구성
- 사용자 프로필 기반 개인화된 식단 생성
- 건강 목표에 따른 맞춤 메뉴 추천
- 영양 정보 및 조리법 제공

### 2. AI 영양제 추천
- 건강 상태 분석을 통한 영양제 추천
- 알레르기 및 약물 상호작용 고려
- 우선순위별 영양제 목록 제공
- **식약처 승인 건강기능식품 검색**: 정부 인증 제품만 검색 가능
- **대용량 병렬 처리**: 42,000개 전체 제품을 안정적으로 검색
- **스마트 캐싱 시스템**: 24시간 캐시로 응답 속도 최대 10배 향상
- **지능형 영양제 명칭 매칭**: 유사도 기반 검색으로 복잡한 명칭도 정확히 찾기
  - "크롬 피콜리네이트" → "크롬피콜리네이트" 자동 매칭
  - "아슈와간다" → "KSM-66", "위타니아" 등 별명 매칭
  - "CoQ10" → "코큐텐", "코엔자임Q10" 등 다양한 표기 지원

### 3. AI 식당 추천 🆕
- 위치 기반 주변 식당 검색
- 사용자 건강 정보를 고려한 식당 추천
- Google Search API를 활용한 실시간 정보 검색

### 4. 미니게임 및 포인트 시스템 🆕
- 스네이크 게임, 기억력 게임, 퍼즐 게임 제공
- 게임 플레이를 통한 포인트 적립 시스템
- 일일 포인트 획득 한도 관리
- **주간 리더보드 시스템**: 매주 월요일 00:00 초기화, 상위 3명에게 보상 지급
  - 1등: 500포인트
  - 2등: 300포인트  
  - 3등: 200포인트

## 설치 및 설정

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
프로젝트 루트에 `.env` 파일을 생성하고 다음 환경 변수를 설정하세요:

```env


# Gemini API 키 (Google AI Studio에서 발급)
GEMINI_API_KEY=your_gemini_api_key_here

# News API 키 (NewsAPI.org에서 발급)
NEWS_API_KEY=your_news_api_key_here

# 카카오 REST API 키 (카카오 개발자 센터에서 발급)
KAKAO_REST_API_KEY=your_kakao_rest_api_key_here

# 카카오 지도 API 키 (기본값 제공)
KAKAO_MAP_API_KEY=085770d2077b87b5e25d90791d9712a7

# 서버 포트
PORT=3000

# 세션 시크릿
SESSION_SECRET=mealplan_secret_key
```

### 3. API 키 발급 방법



#### Gemini API 키
1. [Google AI Studio](https://aistudio.google.com/)에 접속
2. API 키 생성
3. 생성된 키를 `GEMINI_API_KEY`에 설정

#### 카카오 REST API 키
1. [카카오 개발자 센터](https://developers.kakao.com/)에 접속
2. 애플리케이션 생성
3. REST API 키를 `KAKAO_REST_API_KEY`에 설정

#### YouTube Data API 키
1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. YouTube Data API v3 활성화
4. API 키 생성 및 `YOUTUBE_API_KEY`에 설정

#### News API 키
1. [NewsAPI.org](https://newsapi.org/)에 접속
2. 무료 계정 생성
3. API 키를 `NEWS_API_KEY`에 설정

### 4. 서버 실행
```bash
npm start
```

서버가 `http://localhost:3000`에서 실행됩니다.

## 식당 추천 시스템 사용법

### 1단계: 위치 설정
- 카카오 지도에서 원하는 위치 선택
- 현재 위치 자동 감지 기능 제공

### 2단계: 사용자 프로필 입력
- 기본 신체 정보 (나이, 키, 체중, 성별)
- 건강 정보 (알레르기, 질병, 바이오마커)
- 생활 패턴 (활동량, 식사 패턴, 수면 패턴)

### 3단계: 식당 조건 설정
- 음식 카테고리 선택
- 가격대 설정
- 추가 요구사항 (영업시간)

### 4단계: AI 추천 시작
- 주변 식당 검색 (1km 반경)
- Google Search API를 활용한 실시간 정보 검색
- AI 분석을 통한 맞춤 추천

## API 엔드포인트



### YouTube API
- `GET /api/youtube/search` - 한국어 키워드로 영양/건강 영상 검색
- `GET /api/youtube/channel/:channelId` - 특정 채널의 영상 검색
- `GET /api/youtube/trending` - 트렌딩 토픽 조회
- `GET /api/youtube/recommendations` - 카테고리별 추천 영상

## 기술 스택

### 백엔드
- **Node.js** - 서버 런타임
- **Express.js** - 웹 프레임워크
- **Axios** - HTTP 클라이언트

### 프론트엔드
- **HTML5/CSS3** - 마크업 및 스타일링
- **JavaScript (ES6+)** - 클라이언트 사이드 로직
- **카카오 지도 API** - 지도 및 위치 서비스

### AI 서비스
- **Google Gemini API** - AI 추천 시스템 (Google Search 도구 포함)
- **카카오 REST API** - 식당 검색

## 프로젝트 구조

```
meal-plan/
├── public/                 # 정적 파일 (HTML, CSS, JS)
│   ├── index.html         # 메인 페이지
│   ├── meal-plan.html     # 식단 플래너
│   ├── supplements.html   # 영양제 추천
│   ├── restaurant-recommendation.html  # 식당 추천
│   └── style.css          # 공통 스타일
├── routes/                # API 라우터
│   ├── auth.js           # 인증 관련
│   ├── profile.js        # 프로필 관리
│   ├── supplements.js    # 영양제 추천
│   └── restaurants.js    # 식당 추천
├── data/                  # 데이터 파일
│   └── users.json        # 사용자 데이터
└── server.js             # 메인 서버 파일
```

## API 엔드포인트

### 식당 추천 API
- `POST /api/restaurants/integrated` - 통합 식당 추천
- `POST /api/restaurants/search` - 위치 기반 식당 검색
- `POST /api/restaurants/recommend` - AI 추천

### 기타 API
- `POST /api/generate-meal-plan` - 식단 생성
- `POST /api/generate-supplement-recommendation` - 영양제 추천
- `POST /api/analyze-ingredient` - 식재료 분석

## 개발 가이드

### 새로운 기능 추가
1. 프론트엔드: `public/` 디렉토리에 HTML/JS 파일 추가
2. 백엔드: `routes/` 디렉토리에 라우터 파일 추가
3. 스타일: `public/style.css`에 CSS 추가

### 환경 변수 추가
1. `server.js`에서 환경 변수 로드
2. `.env.example`에 예시 추가
3. README.md에 설정 방법 문서화

## 성능 최적화 🚀

### 식약처 API 성능 개선
이 프로젝트는 식약처 건강기능식품 API의 성능을 대폭 개선했습니다:

#### 주요 개선사항
- **병렬 처리**: 순차적 API 호출을 병렬 처리로 변경하여 **속도 5-8배 향상**
- **스마트 캐싱**: 24시간 캐시 시스템으로 **응답시간 최대 10배 단축**
- **배치 최적화**: 1000개씩 5개 동시 요청으로 API 부하 분산
- **자동 복구**: 실패한 배치 자동 재시도 및 부분 성공 처리

#### 성능 비교
```
기존 방식 (순차 처리):
- 42,000개 제품 로드: ~120-180초
- 매 요청마다 전체 데이터 재조회

개선된 방식 (병렬 + 캐싱 + 최적화):
- 첫 로드: ~25-40초 (3-5배 향상)
- 캐시 사용시: ~0.1-0.5초 (300배 향상)
- API 제한 방지 및 메모리 최적화 적용
- 불필요한 데이터 필드 제거로 메모리 사용량 30% 절약
```

#### 성능 모니터링
- 각 API 호출 시 자동으로 성능 로깅
- 캐시 사용 여부 및 응답 시간 표시
- 실시간 성능 피드백 제공

#### API 엔드포인트
- `GET /api/supplements/cache-status` - 캐시 상태 확인
- `DELETE /api/supplements/cache` - 캐시 삭제
- `POST /api/supplements/refresh-cache` - 캐시 강제 새로고침

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 문의사항

프로젝트에 대한 문의사항이 있으시면 이슈를 생성해 주세요. 
#
# 브랜드별 배송비 시스템 🆕

### 개요
잇플 스토어에서는 브랜드별로 차별화된 배송비 시스템을 운영합니다.

### 주요 특징
- **브랜드별 개별 배송비**: 각 제품의 브랜드에 따라 서로 다른 배송비가 적용됩니다.
- **브랜드별 무료배송 기준**: 동일 브랜드 제품의 총 주문금액이 30,000원 이상일 때 해당 브랜드의 배송비가 무료가 됩니다.
- **다중 브랜드 주문**: 서로 다른 브랜드의 제품을 주문할 경우, 각 브랜드별로 배송비가 별도 계산됩니다.

### 배송비 계산 예시

#### 예시 1: 단일 브랜드 주문
- 잇플 브랜드 제품 A (15,000원) + 잇플 브랜드 제품 B (20,000원)
- 총 주문금액: 35,000원 (30,000원 이상)
- **배송비: 0원 (무료배송)**

#### 예시 2: 다중 브랜드 주문
- 잇플 브랜드 제품 A (15,000원) - 배송비 2,500원
- 헬시푸드 브랜드 제품 B (20,000원) - 배송비 3,000원
- 각 브랜드 모두 30,000원 미만이므로
- **총 배송비: 5,500원**

#### 예시 3: 혼합 주문
- 잇플 브랜드 제품들 총 35,000원 - 배송비 0원 (무료배송)
- 바이탈 브랜드 제품 10,000원 - 배송비 2,000원
- **총 배송비: 2,000원**

### 브랜드별 배송비 정책
| 브랜드 | 배송비 | 무료배송 기준 |
|--------|--------|---------------|
| 잇플 | 2,500원 | 30,000원 이상 |
| 헬시푸드 | 3,000원 | 30,000원 이상 |
| 그린라이프 | 3,500원 | 30,000원 이상 |
| 바이탈 | 2,000원 | 30,000원 이상 |
| 퓨어 | 3,000원 | 30,000원 이상 |
| 네이처 | 4,000원 | 30,000원 이상 |

### 관리자 기능
- **제품 등록 시 브랜드 및 배송비 설정**: 새 제품 등록 시 브랜드명과 배송비를 필수로 입력
- **기존 제품 수정**: 브랜드와 배송비 정보 수정 가능
- **배송비 정책 관리**: 브랜드별 배송비 정책을 유연하게 관리

### 사용자 경험
- **장바구니에서 실시간 배송비 계산**: 제품 추가/제거 시 브랜드별 배송비가 실시간으로 계산됩니다.
- **배송비 상세 정보 표시**: 어떤 브랜드에서 얼마의 배송비가 발생하는지 명확하게 표시됩니다.
- **무료배송 안내**: 각 브랜드별로 무료배송까지 얼마나 더 주문해야 하는지 안내합니다.