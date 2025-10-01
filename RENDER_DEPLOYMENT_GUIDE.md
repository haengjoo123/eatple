# Render 배포 가이드 - 로그인 문제 해결

## 🔧 필수 환경변수 설정

Render 대시보드에서 다음 환경변수들을 설정해야 합니다:

### 1. 기본 환경변수
```
NODE_ENV=production
RENDER=true
SESSION_SECRET=your_very_secure_session_secret_key_here
```

### 2. Supabase 관련 환경변수
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
```

### 3. OAuth 관련 환경변수
```
GOOGLE_CLIENT_ID=your_google_client_id
KAKAO_REST_API_KEY=your_kakao_rest_api_key
KAKAO_JAVASCRIPT_KEY=your_kakao_javascript_key
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret
```

### 4. AI API 키
```
GEMINI_API_KEY=your_gemini_api_key
```

### 5. 기타 API 키 (선택사항)
```
KAKAO_MAP_API_KEY=your_kakao_map_api_key
NAVER_CLOUD_CLIENT_ID=your_naver_cloud_client_id
```

## 🚨 주요 문제 해결

### 1. 세션 쿠키 문제
- Render는 HTTPS를 사용하므로 `secure: true` 설정 필요
- `sameSite: "none"`으로 설정하여 크로스 도메인 쿠키 허용

### 2. CORS 문제
- Render의 자동 생성 도메인을 허용하도록 설정
- `credentials: true`로 설정하여 쿠키 전송 허용

### 3. 환경변수 누락
- 모든 필요한 환경변수가 Render에 설정되어 있는지 확인
- 특히 `SUPABASE_URL`과 `SUPABASE_KEY`가 필수

## 📝 Render 환경변수 설정 방법

1. Render 대시보드에서 프로젝트 선택
2. "Environment" 탭으로 이동
3. "Add Environment Variable" 클릭
4. 위의 환경변수들을 하나씩 추가

## 🔍 로그 확인 방법

Render에서 로그를 확인하여 오류를 진단할 수 있습니다:

1. Render 대시보드에서 프로젝트 선택
2. "Logs" 탭에서 실시간 로그 확인
3. 로그인 시도 시 나타나는 오류 메시지 확인

## ✅ 테스트 방법

1. 브라우저 개발자 도구 열기 (F12)
2. Network 탭에서 로그인 요청 확인
3. Console 탭에서 JavaScript 오류 확인
4. Application 탭에서 쿠키 설정 확인

## 🆘 문제가 지속될 경우

1. 브라우저 캐시 및 쿠키 삭제
2. 시크릿 모드에서 테스트
3. 다른 브라우저에서 테스트
4. Render 로그에서 구체적인 오류 메시지 확인
