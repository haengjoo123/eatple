// 이메일 기반 회원가입 및 소셜로그인 페이지

// 이메일 기반 회원가입 처리
document.getElementById("signupForm").onsubmit = async function (e) {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const passwordConfirm = document.getElementById("passwordConfirm").value;
  const msg = document.getElementById("signupMsg");
  msg.textContent = "";

  // 약관 동의 확인
  if (!checkTermsAgreement()) {
    return;
  }

  // 클라이언트 측 유효성 검사
  if (!email || !password || !passwordConfirm) {
    msg.style.color = "red";
    msg.textContent = "모든 항목을 입력하세요.";
    return;
  }

  // 이메일 형식 검증
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    msg.style.color = "red";
    msg.textContent = "올바른 이메일 형식을 입력하세요.";
    return;
  }

  // 비밀번호 확인
  if (password !== passwordConfirm) {
    msg.style.color = "red";
    msg.textContent = "비밀번호가 일치하지 않습니다.";
    return;
  }

  // 비밀번호 강도 검증
  if (!validatePassword(password, email)) {
    msg.style.color = "red";
    msg.textContent = "비밀번호 조건을 확인해주세요.";
    return;
  }

  try {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });

    const data = await res.json();

    if (data.success) {
      msg.style.color = "green";
      msg.textContent = data.message;

      // 이메일 인증이 필요한 경우 즉시 모달 표시
      if (data.needsEmailConfirmation) {
        showEmailConfirmationModal(data.email);
      }
    } else {
      msg.style.color = "red";
      msg.textContent = data.error || "회원가입 실패";
    }
  } catch (err) {
    console.error("Signup error:", err);
    msg.style.color = "red";
    msg.textContent = "서버 오류가 발생했습니다.";
  }
};

// 비밀번호 유효성 검사 함수
function validatePassword(password, email) {
  const rules = {
    length: password.length >= 8 && password.length <= 20,
    repeat: !hasRepeatingChars(password),
    email: !password.toLowerCase().includes(email.split("@")[0].toLowerCase()),
  };

  // UI 업데이트
  updatePasswordRules(rules);

  return Object.values(rules).every((rule) => rule);
}

// 연속/반복 문자 검사
function hasRepeatingChars(password) {
  // 3개 이상 연속되는 문자 검사
  for (let i = 0; i < password.length - 2; i++) {
    if (
      password[i] === password[i + 1] &&
      password[i + 1] === password[i + 2]
    ) {
      return true;
    }
  }

  // 3개 이상 연속되는 ASCII 값 검사 (abc, 123 등)
  for (let i = 0; i < password.length - 2; i++) {
    const char1 = password.charCodeAt(i);
    const char2 = password.charCodeAt(i + 1);
    const char3 = password.charCodeAt(i + 2);

    if (char2 === char1 + 1 && char3 === char2 + 1) {
      return true;
    }
  }

  return false;
}

// 비밀번호 규칙 UI 업데이트
function updatePasswordRules(rules) {
  const passwordRulesEl = document.getElementById("passwordRules");
  if (!passwordRulesEl) return;

  Object.keys(rules).forEach((rule) => {
    const ruleEl = passwordRulesEl.querySelector(`[data-rule="${rule}"]`);
    if (ruleEl) {
      const icon = ruleEl.querySelector(".rule-icon");
      if (rules[rule]) {
        icon.textContent = "✓";
        icon.style.color = "#2ecc40";
        ruleEl.style.color = "#2ecc40";
      } else {
        icon.textContent = "✗";
        icon.style.color = "#e74c3c";
        ruleEl.style.color = "#e74c3c";
      }
    }
  });
}

// 이메일 인증 모달 표시
function showEmailConfirmationModal(email) {
  const modal = document.createElement("div");
  modal.className = "terms-modal";
  modal.style.display = "block";
  modal.innerHTML = `
    <div class="terms-modal-content">
      <div class="terms-modal-header">
        <h3>이메일 인증</h3>
        <span class="terms-modal-close" onclick="handleEmailConfirmationClose()">&times;</span>
      </div>
      <div class="terms-modal-body">
        <div class="terms-content" style="text-align: center; padding: 20px;">
          <p style="margin-bottom: 20px;">
            <strong>${email}</strong>로<br>
            인증 이메일이 전송되었습니다.
          </p>
          <p style="margin-bottom: 20px; color: #666;">
            이메일을 확인하여 계정을 활성화해주세요.<br>
            이메일이 오지 않았다면 스팸함을 확인해보세요.
          </p>
          <button type="button" id="resendEmailBtn" class="terms-modal-btn" style="margin-right: 10px;">
            이메일 재전송
          </button>
        </div>
      </div>
      <div class="terms-modal-footer">
        <button type="button" class="terms-modal-btn" onclick="handleEmailConfirmationClose()">
          확인
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";

  // 이메일 재전송 버튼 이벤트
  const resendBtn = modal.querySelector("#resendEmailBtn");
  resendBtn.addEventListener("click", () => resendConfirmationEmail(email));

  // 모달 외부 클릭 시 닫기
  modal.addEventListener("click", function (e) {
    if (e.target === modal) {
      handleEmailConfirmationClose();
    }
  });
}

// 이메일 인증 모달 닫기 및 로그인 페이지로 이동
function handleEmailConfirmationClose() {
  const modal = document.querySelector(".terms-modal");
  if (modal) {
    modal.remove();
  }
  document.body.style.overflow = "auto";

  // 로그인 페이지로 이동
  setTimeout(() => {
    window.location.href = "login.html";
  }, 500);
}

// 이메일 재전송 함수
async function resendConfirmationEmail(email) {
  try {
    const res = await fetch("/api/auth/resend-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      credentials: "include",
    });

    const data = await res.json();

    if (data.success) {
      alert(data.message);
    } else {
      alert(data.error || "이메일 재전송 실패");
    }
  } catch (err) {
    console.error("Resend email error:", err);
    alert("서버 오류가 발생했습니다.");
  }
}

// 이메일 입력 시 실시간 검증
document.addEventListener("DOMContentLoaded", function () {
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const passwordConfirmInput = document.getElementById("passwordConfirm");
  const passwordRules = document.getElementById("passwordRules");

  if (emailInput) {
    emailInput.addEventListener("input", function () {
      const email = this.value.trim();
      const emailMsg = document.getElementById("emailMsg");
      const emailCheckmark = document.getElementById("emailCheckmark");

      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(email)) {
          emailMsg.textContent = "";
          emailMsg.classList.remove("show");
          emailMsg.style.color = "";
          emailCheckmark.style.display = "block";
        } else {
          emailMsg.textContent = "올바른 이메일 형식을 입력하세요.";
          emailMsg.classList.add("show");
          emailMsg.style.color = "red";
          emailCheckmark.style.display = "none";
        }
      } else {
        emailMsg.textContent = "";
        emailMsg.classList.remove("show");
        emailCheckmark.style.display = "none";
      }
    });
  }

  if (passwordInput) {
    passwordInput.addEventListener("focus", function () {
      if (passwordRules) {
        passwordRules.style.display = "block";
      }
    });

    passwordInput.addEventListener("input", function () {
      const password = this.value;
      const email = emailInput ? emailInput.value.trim() : "";

      if (password && email) {
        validatePassword(password, email);
      }

      // 비밀번호 확인 검증
      if (passwordConfirmInput && passwordConfirmInput.value) {
        validatePasswordConfirm();
      }
    });
  }

  if (passwordConfirmInput) {
    passwordConfirmInput.addEventListener("input", validatePasswordConfirm);
  }

  function validatePasswordConfirm() {
    const password = passwordInput.value;
    const passwordConfirm = passwordConfirmInput.value;
    const confirmMsg = document.getElementById("passwordConfirmMsg");

    if (passwordConfirm) {
      if (password === passwordConfirm) {
        confirmMsg.textContent = "비밀번호가 일치합니다.";
        confirmMsg.classList.add("show");
        confirmMsg.style.color = "green";
      } else {
        confirmMsg.textContent = "비밀번호가 일치하지 않습니다.";
        confirmMsg.classList.add("show");
        confirmMsg.style.color = "red";
      }
    } else {
      confirmMsg.textContent = "";
      confirmMsg.classList.remove("show");
    }
  }
});

// 카카오 회원가입 처리 함수 (REST API 방식)
async function handleKakaoSignup() {
  const msg = document.getElementById("signupMsg");
  msg.textContent = "";

  // 약관 동의 확인
  if (!checkTermsAgreement()) {
    return;
  }

  try {
    // 카카오 REST API 키 가져오기
    const kakaoRestApiKey = await getKakaoRestApiKey();

    if (!kakaoRestApiKey) {
      msg.style.color = "red";
      msg.textContent = "카카오 API 키를 가져올 수 없습니다.";
      return;
    }

    console.log("Retrieved Kakao REST API Key:", kakaoRestApiKey);

    // 카카오 OAuth 인증 URL로 리다이렉트
    const redirectUri = encodeURIComponent(
      window.location.origin + "/api/auth/kakao/callback"
    );
    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${kakaoRestApiKey}&redirect_uri=${redirectUri}&response_type=code&scope=profile_nickname`;

    console.log("카카오 회원가입 URL로 이동:", kakaoAuthUrl);
    // 팝업으로 띄우기
    window.open(
      kakaoAuthUrl,
      "kakaoLoginPopup",
      "width=500,height=700,menubar=no,toolbar=no,location=no,status=no"
    );
  } catch (error) {
    console.error("카카오 회원가입 오류:", error);
    msg.style.color = "red";
    msg.textContent = "카카오 회원가입 오류: " + error.message;
  }
}

// 카카오 REST API 키 가져오기
async function getKakaoRestApiKey() {
  try {
    console.log("Fetching Kakao REST API key from:", "/api/kakao-rest-key");

    const response = await fetch("/api/kakao-rest-key", {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    console.log("Response status:", response.status);
    console.log("Response ok:", response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response:", errorText);
      throw new Error(
        `HTTP error! status: ${response.status}, response: ${errorText}`
      );
    }

    const data = await response.json();
    console.log("Parsed response data:", data);

    if (!data.apiKey) {
      throw new Error("API key not found in response");
    }

    return data.apiKey;
  } catch (error) {
    console.error("카카오 REST API 키 가져오기 실패:", error);
    return null;
  }
}

// 네이버 Client ID 가져오기
async function getNaverClientId() {
  try {
    console.log("Fetching Naver Client ID from:", "/api/naver-client-id");

    const response = await fetch("/api/naver-client-id", {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    console.log("Response status:", response.status);
    console.log("Response ok:", response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response:", errorText);
      throw new Error(
        `HTTP error! status: ${response.status}, response: ${errorText}`
      );
    }

    const data = await response.json();
    console.log("Parsed response data:", data);

    if (!data.clientId) {
      throw new Error("Client ID not found in response");
    }

    return data.clientId;
  } catch (error) {
    console.error("네이버 Client ID 가져오기 실패:", error);
    return null;
  }
}

// 카카오 회원가입 성공 처리 함수
async function handleKakaoSignupSuccess(authObj, msg) {
  try {
    // 서버에 액세스 토큰 전송
    const res = await fetch("/api/auth/kakao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: authObj.access_token }),
      credentials: "include",
    });

    const data = await res.json();

    if (res.ok) {
      // 사용자 정보 저장 (세션 기반 인증)
      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      }

      msg.style.color = "green";
      msg.textContent = "카카오 계정으로 가입이 완료되었습니다!";
      setTimeout(() => {
        window.location.href = "index.html";
      }, 1200);
    } else {
      msg.style.color = "red";
      msg.textContent = data.error || "카카오 회원가입 실패";
    }
  } catch (err) {
    console.error("카카오 회원가입 서버 통신 오류:", err);
    msg.style.color = "red";
    msg.textContent = "서버 오류";
  }
}

// 카카오 JavaScript 키 가져오기
async function getKakaoJSKey() {
  try {
    const response = await fetch("/api/kakao-js-key");
    const data = await response.json();
    return data.apiKey;
  } catch (error) {
    console.error("카카오 키 가져오기 실패:", error);
    return null;
  }
}

// Google 회원가입 처리 함수
async function handleGoogleSignup(response) {
  const msg = document.getElementById("signupMsg");
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
      // 사용자 정보 저장 (세션 기반 인증)
      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      }

      msg.style.color = "green";
      msg.textContent = "구글 계정으로 가입이 완료되었습니다!";
      setTimeout(() => {
        window.location.href = "index.html";
      }, 1200);
    } else {
      msg.style.color = "red";
      msg.textContent = data.error || "구글 회원가입 실패";
    }
  } catch (err) {
    msg.style.color = "red";
    msg.textContent = "서버 오류";
  }
}

// 약관 동의 확인 함수
function checkTermsAgreement() {
  const terms1 = document.getElementById("terms1");
  const terms2 = document.getElementById("terms2");
  const msg = document.getElementById("signupMsg");

  if (!terms1.checked || !terms2.checked) {
    msg.style.color = "red";
    msg.textContent = "모든 필수 약관에 동의해야 회원가입이 가능합니다.";
    return false;
  }
  return true;
}

// 약관 모달 기능
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM Content Loaded - 이벤트 리스너 등록 시작");

  // 카카오 회원가입 버튼 이벤트 리스너
  const kakaoSignupBtn = document.getElementById("kakao-signup-btn");
  console.log("카카오 회원가입 버튼:", kakaoSignupBtn);
  if (kakaoSignupBtn) {
    kakaoSignupBtn.addEventListener("click", handleKakaoSignup);
    console.log("카카오 회원가입 버튼 이벤트 리스너 등록 완료");
  }

  // 네이버 회원가입 버튼 이벤트 리스너
  const naverSignupBtn = document.getElementById("naver-signup-btn");
  console.log("네이버 회원가입 버튼:", naverSignupBtn);
  if (naverSignupBtn) {
    naverSignupBtn.addEventListener("click", function (e) {
      console.log("네이버 회원가입 버튼 클릭됨");
      e.preventDefault();
      handleNaverSignup();
    });
    console.log("네이버 회원가입 버튼 이벤트 리스너 등록 완료");
  } else {
    console.error("네이버 회원가입 버튼을 찾을 수 없습니다!");
  }
  const termsModal = document.getElementById("termsModal");
  const terms1Link = document.getElementById("terms1Link");
  const termsModalClose = document.getElementById("termsModalClose");
  const termsModalConfirm = document.getElementById("termsModalConfirm");

  // 약관 링크 클릭 시 모달 열기
  if (terms1Link) {
    terms1Link.addEventListener("click", function (e) {
      e.preventDefault();
      termsModal.style.display = "block";
      document.body.style.overflow = "hidden"; // 스크롤 방지
    });
  }

  // X 버튼 클릭 시 모달 닫기
  if (termsModalClose) {
    termsModalClose.addEventListener("click", function () {
      termsModal.style.display = "none";
      document.body.style.overflow = "auto"; // 스크롤 복원
    });
  }

  // 확인 버튼 클릭 시 모달 닫기
  if (termsModalConfirm) {
    termsModalConfirm.addEventListener("click", function () {
      termsModal.style.display = "none";
      document.body.style.overflow = "auto"; // 스크롤 복원
    });
  }

  // 모달 외부 클릭 시 닫기
  if (termsModal) {
    termsModal.addEventListener("click", function (e) {
      if (e.target === termsModal) {
        termsModal.style.display = "none";
        document.body.style.overflow = "auto"; // 스크롤 복원
      }
    });
  }

  // 개인정보 수집 및 이용 동의 모달 기능
  const privacyModal = document.getElementById("privacyModal");
  const terms2Link = document.getElementById("terms2Link");
  const privacyModalClose = document.getElementById("privacyModalClose");
  const privacyModalConfirm = document.getElementById("privacyModalConfirm");

  // 개인정보 링크 클릭 시 모달 열기
  if (terms2Link) {
    terms2Link.addEventListener("click", function (e) {
      e.preventDefault();
      privacyModal.style.display = "block";
      document.body.style.overflow = "hidden"; // 스크롤 방지
    });
  }

  // X 버튼 클릭 시 모달 닫기
  if (privacyModalClose) {
    privacyModalClose.addEventListener("click", function () {
      privacyModal.style.display = "none";
      document.body.style.overflow = "auto"; // 스크롤 복원
    });
  }

  // 확인 버튼 클릭 시 모달 닫기
  if (privacyModalConfirm) {
    privacyModalConfirm.addEventListener("click", function () {
      privacyModal.style.display = "none";
      document.body.style.overflow = "auto"; // 스크롤 복원
    });
  }

  // 모달 외부 클릭 시 닫기
  if (privacyModal) {
    privacyModal.addEventListener("click", function (e) {
      if (e.target === privacyModal) {
        privacyModal.style.display = "none";
        document.body.style.overflow = "auto"; // 스크롤 복원
      }
    });
  }

  // ESC 키로 모달 닫기 (두 모달 모두)
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (termsModal.style.display === "block") {
        termsModal.style.display = "none";
        document.body.style.overflow = "auto";
      } else if (privacyModal.style.display === "block") {
        privacyModal.style.display = "none";
        document.body.style.overflow = "auto";
      }
    }
  });
});
// 네이버 회원가입 처리 함수
async function handleNaverSignup() {
  console.log("handleNaverSignup 함수 호출됨");
  const msg = document.getElementById("signupMsg");
  msg.textContent = "";

  try {
    console.log("네이버 Client ID 가져오기 시작");
    // 네이버 Client ID 가져오기
    const naverClientId = await getNaverClientId();

    if (!naverClientId) {
      console.error("네이버 Client ID를 가져올 수 없음");
      msg.style.color = "red";
      msg.textContent = "네이버 Client ID를 가져올 수 없습니다.";
      return;
    }

    console.log("Retrieved Naver Client ID:", naverClientId);

    // 네이버 OAuth 인증 URL로 리다이렉트
    const redirectUri = encodeURIComponent(
      window.location.origin + "/api/auth/naver/callback"
    );
    const state = Math.random().toString(36).substring(2, 15);

    // 상태 값을 세션 스토리지에 저장 (CSRF 방지)
    sessionStorage.setItem("naverOAuthState", state);

    const naverAuthUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${naverClientId}&redirect_uri=${redirectUri}&state=${state}`;

    console.log("네이버 회원가입 URL로 이동:", naverAuthUrl);
    // 팝업으로 띄우기
    window.open(
      naverAuthUrl,
      "naverLoginPopup",
      "width=500,height=700,menubar=no,toolbar=no,location=no,status=no"
    );
  } catch (error) {
    console.error("네이버 회원가입 오류:", error);
    msg.style.color = "red";
    msg.textContent = "네이버 회원가입 오류: " + error.message;
  }
}

// 팝업에서 로그인 성공 메시지 수신 시 메인 페이지로 이동
window.addEventListener("message", function (event) {
  if (event.data === "social_login_success") {
    window.location.href = "index.html";
  }
});
