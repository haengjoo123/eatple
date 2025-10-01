# Render 세션 문제 해결 가이드

## 🚨 현재 문제
Render 환경에서 로그인은 성공하지만 세션이 제대로 유지되지 않아 로그인 상태가 인식되지 않는 문제

## 🔧 해결 방법

### 1. Render 환경변수 설정 확인
다음 환경변수들이 Render 대시보드에 올바르게 설정되어 있는지 확인:

```
NODE_ENV=production
SESSION_SECRET=your_very_secure_session_secret_key_here
```

### 2. 세션 설정 최적화 (완료됨)
- `secure: true` (프로덕션 환경)
- `sameSite: "none"` (크로스 도메인 쿠키 허용)
- `rolling: true` (매 요청마다 세션 갱신)
- `maxAge: 24시간` (세션 유지 시간 연장)

### 3. 브라우저 설정 확인
- 브라우저에서 쿠키 차단 설정 해제
- 시크릿 모드에서 테스트
- 브라우저 캐시 및 쿠키 삭제 후 재시도

### 4. 디버깅 로그 확인
브라우저 개발자 도구에서 다음 로그들을 확인:

#### 로그인 시:
```
로그인 시도: { email: '***설정됨***', ... }
Supabase 로그인 요청 시작...
Supabase 로그인 응답: { hasData: true, hasError: false }
세션 설정 완료: { sessionId: '...', user: {...}, sessionCookie: {...} }
로그인 응답 전송: { id: '...', email: '...', isAdmin: true, role: 'admin' }
```

#### 프론트엔드에서:
```
로그인 응답 받음: { success: true, user: {...} }
사용자 정보 localStorage에 저장됨: {...}
로그인 성공 처리 시작
```

#### 페이지 새로고침 시:
```
사용자 상태 확인 - 세션 사용자: { id: '...', email: '...', isAdmin: true, role: 'admin' }
```

### 5. 문제 지속 시 확인사항

#### A. 세션이 생성되지 않는 경우:
- Render 로그에서 "세션 설정 완료" 메시지 확인
- `SESSION_SECRET` 환경변수 설정 확인

#### B. 세션은 생성되지만 유지되지 않는 경우:
- 브라우저에서 쿠키 확인 (개발자 도구 > Application > Cookies)
- `mealplan_session` 쿠키가 있는지 확인
- 쿠키의 `Secure`, `SameSite` 속성 확인

#### C. 세션은 유지되지만 사용자 정보가 없는 경우:
- `/api/auth/me` 응답 확인
- 세션에서 사용자 정보가 올바르게 저장되었는지 확인

### 6. 임시 해결책
세션이 계속 문제가 된다면, localStorage 기반 인증으로 임시 전환할 수 있습니다:

```javascript
// 로그인 성공 시
localStorage.setItem("user", JSON.stringify(data.user));
localStorage.setItem("loginTime", Date.now().toString());

// 인증 확인 시
const user = localStorage.getItem("user");
const loginTime = localStorage.getItem("loginTime");
const now = Date.now();
const maxAge = 24 * 60 * 60 * 1000; // 24시간

if (user && loginTime && (now - parseInt(loginTime)) < maxAge) {
  // 로그인 상태 유지
} else {
  // 로그인 만료
  localStorage.removeItem("user");
  localStorage.removeItem("loginTime");
}
```

## 🔍 테스트 방법

1. 브라우저 개발자 도구 열기 (F12)
2. 로그인 시도
3. Console 탭에서 위의 로그 메시지들 확인
4. Application 탭에서 Cookies 확인
5. Network 탭에서 `/api/auth/login`과 `/api/auth/me` 요청 확인

## 📞 문제 지속 시
위의 모든 단계를 확인한 후에도 문제가 지속되면, Render 로그의 구체적인 오류 메시지를 확인하여 추가 진단이 필요합니다.
