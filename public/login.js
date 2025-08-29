// 페이지 로드 시 이벤트 리스너 등록
document.addEventListener("DOMContentLoaded", function () {
  // 소셜 로그인 버튼 이벤트 리스너
  const kakaoLoginBtn = document.getElementById("kakao-login-btn");
  if (kakaoLoginBtn) {
    kakaoLoginBtn.addEventListener("click", handleKakaoLogin);
  }
  
  const naverLoginBtn = document.getElementById("naver-login-btn");
  if (naverLoginBtn) {
    naverLoginBtn.addEventListener("click", handleNaverLogin);
  }

  // 비밀번호 찾기 링크 이벤트 리스너
  const forgotPasswordLink = document.getElementById("forgot-password-link");
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", handleForgotPassword);
  }

  // URL 파라미터 확인 (이메일 인증 완료 등)
  const urlParams = new URLSearchParams(window.location.search);
  const message = urlParams.get('message');
  const error = urlParams.get('error');
  
  const msg = document.getElementById("loginMsg");
  if (message) {
    msg.style.color = "green";
    msg.textContent = decodeURIComponent(message);
  } else if (error) {
    msg.style.color = "red";
    msg.textContent = decodeURIComponent(error);
  }
});

// 이메일 기반 로그인 처리
document.getElementById("loginForm").onsubmit = async function (e) {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const msg = document.getElementById("loginMsg");
  const submitBtn = document.querySelector('button[type="submit"]');
  
  msg.textContent = "";

  // 클라이언트 측 유효성 검사
  if (!email || !password) {
    msg.style.color = "red";
    msg.textContent = "이메일과 비밀번호를 입력하세요.";
    return;
  }

  // 이메일 형식 검증
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    msg.style.color = "red";
    msg.textContent = "올바른 이메일 형식을 입력하세요.";
    return;
  }

  // 로딩 상태 표시
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "로그인 중...";
  msg.style.color = "blue";
  msg.textContent = "로그인 처리 중입니다...";

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });
    
    const data = await res.json();
    
    if (data.success) {
      // 사용자 정보 저장
      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      }

      msg.style.color = "green";
      msg.textContent = "로그인 성공!";
      
      // 로그인 성공 후 리다이렉트 처리
      const returnUrl = sessionStorage.getItem("returnUrl");
      const pending = localStorage.getItem("pendingProfile");
      
      if (pending) {
        // 즉시 페이지 이동하고 백그라운드에서 프로필 처리
        handlePendingProfileAsync(pending);
        setTimeout(() => {
          window.location.href = "profile.html";
        }, 200); // 지연 시간 단축
      } else if (returnUrl) {
        // 장바구니 등에서 온 경우 원래 페이지로 돌아가기
        sessionStorage.removeItem("returnUrl");
        setTimeout(() => {
          window.location.href = returnUrl;
        }, 200);
      } else {
        setTimeout(() => {
          window.location.href = "index.html";
        }, 200); // 지연 시간 단축
      }
    } else {
      msg.style.color = "red";
      msg.textContent = data.error || "로그인 실패";
    }
  } catch (err) {
    console.error("Login error:", err);
    msg.style.color = "red";
    msg.textContent = "서버 오류가 발생했습니다.";
  } finally {
    // 로딩 상태 해제
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
};

// 비밀번호 찾기 처리
async function handleForgotPassword(e) {
  e.preventDefault();
  
  const email = document.getElementById("email").value.trim();
  const msg = document.getElementById("loginMsg");
  
  if (!email) {
    msg.style.color = "red";
    msg.textContent = "이메일을 입력한 후 비밀번호 찾기를 클릭하세요.";
    return;
  }

  // 이메일 형식 검증
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    msg.style.color = "red";
    msg.textContent = "올바른 이메일 형식을 입력하세요.";
    return;
  }

  try {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      credentials: "include",
    });
    
    const data = await res.json();
    
    if (data.success) {
      msg.style.color = "green";
      msg.textContent = data.message;
    } else {
      msg.style.color = "red";
      msg.textContent = data.error || "비밀번호 재설정 요청 실패";
    }
  } catch (err) {
    console.error("Password reset error:", err);
    msg.style.color = "red";
    msg.textContent = "서버 오류가 발생했습니다.";
  }
}

// 카카오 로그인 처리 함수 (기존 코드 유지)
async function handleKakaoLogin() {
  const msg = document.getElementById("loginMsg");
  msg.textContent = "";

  try {
    const kakaoRestApiKey = await getKakaoRestApiKey();

    if (!kakaoRestApiKey) {
      msg.style.color = "red";
      msg.textContent = "카카오 API 키를 가져올 수 없습니다.";
      return;
    }

    const redirectUri = encodeURIComponent(
      window.location.origin + "/api/auth/kakao/callback"
    );
    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${kakaoRestApiKey}&redirect_uri=${redirectUri}&response_type=code&scope=profile_nickname`;

    window.open(
      kakaoAuthUrl,
      'kakaoLoginPopup',
      'width=500,height=700,menubar=no,toolbar=no,location=no,status=no'
    );
  } catch (error) {
    console.error("카카오 로그인 오류:", error);
    msg.style.color = "red";
    msg.textContent = "카카오 로그인 오류: " + error.message;
  }
}

// 네이버 로그인 처리 함수 (기존 코드 유지)
async function handleNaverLogin() {
  const msg = document.getElementById("loginMsg");
  msg.textContent = "";

  try {
    const naverClientId = await getNaverClientId();

    if (!naverClientId) {
      msg.style.color = "red";
      msg.textContent = "네이버 Client ID를 가져올 수 없습니다.";
      return;
    }

    const redirectUri = encodeURIComponent(
      window.location.origin + "/api/auth/naver/callback"
    );
    const state = Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem("naverOAuthState", state);
    const naverAuthUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${naverClientId}&redirect_uri=${redirectUri}&state=${state}`;

    window.open(
      naverAuthUrl,
      'naverLoginPopup',
      'width=500,height=700,menubar=no,toolbar=no,location=no,status=no'
    );
  } catch (error) {
    console.error("네이버 로그인 오류:", error);
    msg.style.color = "red";
    msg.textContent = "네이버 로그인 오류: " + error.message;
  }
}

// Google 로그인 처리 함수 (기존 코드 유지)
async function handleCredentialResponse(response) {
  const msg = document.getElementById("loginMsg");
  msg.textContent = "";

  try {
    const res = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: response.credential }),
      credentials: "include",
    });

    const data = await res.json();

    if (res.ok) {
      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      }

      const pending = localStorage.getItem("pendingProfile");
      if (pending) {
        const profileRes = await fetch("/api/profile", {
          credentials: "include",
        });
        const existingProfile = await profileRes.json();

        if (!existingProfile || Object.keys(existingProfile).length === 0) {
          await fetch("/api/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: pending,
          });
          localStorage.removeItem("pendingProfile");
          msg.style.color = "green";
          msg.textContent = "구글 로그인 성공! 임시 저장된 프로필이 마이페이지에 저장되었습니다.";
          setTimeout(() => {
            window.location.href = "profile.html";
          }, 800);
        } else {
          localStorage.removeItem("pendingProfile");
          msg.style.color = "green";
          msg.textContent = "구글 로그인 성공! 기존 프로필이 유지됩니다.";
          setTimeout(() => {
            window.location.href = "index.html";
          }, 800);
        }
      } else {
        msg.style.color = "green";
        msg.textContent = "구글 로그인 성공!";
        setTimeout(() => {
          window.location.href = "index.html";
        }, 800);
      }
    } else {
      msg.style.color = "red";
      msg.textContent = data.error || "구글 로그인 실패";
    }
  } catch (err) {
    msg.style.color = "red";
    msg.textContent = "서버 오류";
  }
}

// 유틸리티 함수들 (기존 코드 유지)
async function getKakaoRestApiKey() {
  try {
    const response = await fetch("/api/auth/kakao-rest-key", {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
    }

    const data = await response.json();
    if (!data.apiKey) {
      throw new Error("API key not found in response");
    }

    return data.apiKey;
  } catch (error) {
    console.error("카카오 REST API 키 가져오기 실패:", error);
    return null;
  }
}

async function getNaverClientId() {
  try {
    const response = await fetch("/api/auth/naver-client-id", {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
    }

    const data = await response.json();
    if (!data.clientId) {
      throw new Error("Client ID not found in response");
    }

    return data.clientId;
  } catch (error) {
    console.error("네이버 Client ID 가져오기 실패:", error);
    return null;
  }
}

// pendingProfile을 백그라운드에서 비동기 처리하는 함수
async function handlePendingProfileAsync(pending) {
  try {
    const profileRes = await fetch("/api/profile", {
      credentials: "include",
    });
    const existingProfile = await profileRes.json();

    if (!existingProfile || Object.keys(existingProfile).length === 0) {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: pending,
      });
    }
    localStorage.removeItem("pendingProfile");
  } catch (error) {
    console.error("Background profile handling error:", error);
    localStorage.removeItem("pendingProfile");
  }
}

// 팝업에서 로그인 성공 메시지 수신 시 메인 페이지로 이동
window.addEventListener('message', function(event) {
  if (event.data === 'social_login_success') {
    window.location.href = 'index.html';
  }
});