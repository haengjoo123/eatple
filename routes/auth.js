const express = require("express");
const bcrypt = require("bcrypt");
const { randomUUID } = require('crypto');
const { renderOAuthSuccess } = require('../utils/oauthResponse');
const { OAuth2Client } = require("google-auth-library");
const { createClient } = require('@supabase/supabase-js');
const { readUsers, writeUsers } = require('../utils/userStore');
const { adminAuth, requireLogin, establishSession } = require('../utils/authMiddleware');
const { authLimiter } = require('../utils/securityMiddleware');
const router = express.Router();

router.use(['/signup', '/login', '/reset-password', '/resend-email', '/update-password', '/change-password'], authLimiter);

// UUID 생성 함수
function generateUUID() {
  return randomUUID();
}

// 카카오 리다이렉트 URI 생성 헬퍼 함수 (프록시 환경 지원)
function getKakaoRedirectUri(req) {
  // 환경 변수로 리다이렉트 URI가 설정되어 있으면 사용
  if (process.env.KAKAO_REDIRECT_URI) {
    return process.env.KAKAO_REDIRECT_URI;
  }
  
  // 프록시 뒤에서 실행될 때 X-Forwarded-Proto 헤더 확인
  const protocol = req.get('X-Forwarded-Proto') || req.protocol;
  const host = req.get('host');
  
  // 프로덕션 환경에서는 https 강제
  const finalProtocol = process.env.NODE_ENV === 'production' && protocol === 'http' 
    ? 'https' 
    : protocol;
  
  return `${finalProtocol}://${host}/api/auth/kakao/callback`;
}

// Supabase 클라이언트 초기화 (성능 최적화 옵션 추가)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// 환경변수 확인 및 로깅 (프로덕션에서는 간단히만)

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 환경변수가 설정되지 않았습니다!');
  console.error('SUPABASE_URL:', supabaseUrl);
  console.error('SUPABASE_KEY:', supabaseKey ? '***설정됨***' : '설정되지 않음');
}

const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false, // URL에서 세션 감지 비활성화 (프로덕션에서 문제 방지)
  },
  global: {
    headers: {
      'x-client-info': 'meal-plan-app/1.0.0'
    }
  }
});

// Google OAuth 설정
const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  "1026465295959-1mlmha91v7osfg3ihuiti4v9dgcaa10i.apps.googleusercontent.com";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// 네이버 OAuth 설정 (로그인용)
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

// 세션 미들웨어는 server.js에서 설정한다고 가정

// Authentication changes a Supabase client's current session; never share it between requests.
function createAuthClient() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
}

// OAuth calls may take time. Merge only identity fields into freshly read user data.
function saveAuthUser(user) {
  const users = readUsers();
  const providerKey = { google: 'googleId', kakao: 'kakaoId', naver: 'naverId', email: 'supabaseId' }[user.authType];
  let existing = users.find(candidate => candidate.id === user.id ||
    (providerKey && user[providerKey] && candidate[providerKey] === user[providerKey]));
  if (existing) {
    for (const field of ['email', 'name', 'picture', 'authType', 'supabaseId', 'googleId', 'kakaoId', 'naverId', 'emailConfirmed']) {
      if (user[field] !== undefined) existing[field] = user[field];
    }
  } else {
    existing = { ...user };
    users.push(existing);
  }
  writeUsers(users);
  return existing;
}

// Save the verified identity without overwriting profile or point updates made during authentication.
async function processUserDataAsync(user) {
  const users = readUsers();
  const existing = users.find(candidate => candidate.id === user.id || candidate.supabaseId === user.id);
  if (!existing) {
    try {
      const { error } = await supabase.from('users').insert({
        id: user.id, email: user.email, auth_type: 'email', profile: {},
        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      });
      if (error) console.error('Supabase users 저장 오류:', error.message);
    } catch (error) {
      console.error('Supabase users 저장 오류:', error.message);
    }
  }
  return saveAuthUser({
    ...(existing || { id: user.id, createdAt: new Date().toISOString(), isAdmin: false, role: null }),
    email: user.email,
    authType: existing?.authType || 'email',
    emailConfirmed: !!user.email_confirmed_at,
    supabaseId: user.id
  });
}

// 이메일 기반 회원가입 (Supabase)
router.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // 입력값 검증
    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      return res.status(400).json({ 
        success: false, 
        error: "이메일과 비밀번호를 입력하세요." 
      });
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        error: "올바른 이메일 형식을 입력하세요." 
      });
    }

    // 비밀번호 강도 검증
    if (password.length < 8) {
      return res.status(400).json({ 
        success: false, 
        error: "비밀번호는 8자 이상이어야 합니다." 
      });
    }

    // Supabase를 통한 회원가입
    const { data, error } = await createAuthClient().auth.signUp({
      email: email,
      password: password,
      options: {
        emailRedirectTo: `${req.protocol}://${req.get('host')}/email-confirmed.html`
      }
    });

    if (error) {
      console.error('Supabase signup error:', error);
      
      // 에러 메시지 한국어 변환
      let errorMessage = "회원가입 중 오류가 발생했습니다.";
      if (error.message.includes('already registered')) {
        errorMessage = "이미 가입된 이메일입니다.";
      } else if (error.message.includes('Password should be')) {
        errorMessage = "비밀번호는 최소 8자 이상이어야 합니다.";
      } else if (error.message.includes('Invalid email')) {
        errorMessage = "올바른 이메일 형식을 입력하세요.";
      }
      
      return res.status(400).json({ 
        success: false, 
        error: errorMessage 
      });
    }

    // 회원가입 성공 - 이메일 인증 필요
    res.json({ 
      success: true, 
      message: "회원가입이 완료되었습니다. 이메일을 확인하여 계정을 활성화해주세요.",
      needsEmailConfirmation: true,
      email: email
    });

  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ 
      success: false, 
      error: "서버 오류가 발생했습니다." 
    });
  }
});

// 이메일 기반 로그인 (Supabase)
router.post("/login", async (req, res) => {
  
  try {
    const { email, password } = req.body;
    
    // 로그인 시도 로그 (개발 환경에서만)

    // 입력값 검증
    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      return res.status(400).json({ 
        success: false, 
        error: "이메일과 비밀번호를 입력하세요." 
      });
    }

    // Supabase 클라이언트 확인
    if (!supabase) {
      console.error('Supabase 클라이언트가 초기화되지 않았습니다');
      return res.status(500).json({ 
        success: false, 
        error: "서버 설정 오류가 발생했습니다." 
      });
    }

    // Supabase를 통한 로그인 (타임아웃 설정)
    const loginPromise = createAuthClient().auth.signInWithPassword({
      email: email,
      password: password
    });
    
    // 10초 타임아웃 설정
    let loginTimeout;
    const timeoutPromise = new Promise((_, reject) => {
      loginTimeout = setTimeout(() => reject(new Error('로그인 요청 시간 초과')), 10000);
    });
    let loginResult;
    try {
      loginResult = await Promise.race([loginPromise, timeoutPromise]);
    } finally {
      clearTimeout(loginTimeout);
    }
    const { data, error } = loginResult;

    if (error) {
      console.error('Supabase login error:', error);
      
      // 에러 메시지 한국어 변환
      let errorMessage = "로그인 중 오류가 발생했습니다.";
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = "이메일 또는 비밀번호가 올바르지 않습니다.";
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = "이메일 인증이 완료되지 않았습니다. 이메일을 확인해주세요.";
      } else if (error.message.includes('Too many requests')) {
        errorMessage = "너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해주세요.";
      }
      
      return res.status(401).json({ 
        success: false, 
        error: errorMessage 
      });
    }

    // 로그인 성공 - 로컬 JSON에 사용자 정보 저장/업데이트 (비동기 최적화)
    const user = data.user;
    
    // 사용자 데이터 처리를 비동기로 수행하여 응답 속도 향상
    const userData = await processUserDataAsync(user);
    
    // 세션 설정을 먼저 수행
    const sessionUser = { 
      id: userData.id,
      email: user.email, 
      authType: "email",
      emailConfirmed: user.email_confirmed_at ? true : false,
      isAdmin: userData.isAdmin || false,
      role: userData.role || null
    };
    
    await establishSession(req, sessionUser);

    // 즉시 응답 반환
    const responseUser = { 
      id: userData.id,
      email: user.email, 
      authType: "email",
      emailConfirmed: user.email_confirmed_at ? true : false,
      isAdmin: userData.isAdmin || false,
      role: userData.role || null
    };
    
    res.json({ 
      success: true, 
      user: responseUser 
    });

  } catch (err) {
    console.error('Login error:', err);
    
    res.status(500).json({ 
      success: false, 
      error: "서버 오류가 발생했습니다." 
    });
  }
});

// 비밀번호 재설정 요청
router.post("/reset-password", async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: "이메일을 입력하세요." 
      });
    }

    const { error } = await createAuthClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${req.protocol}://${req.get('host')}/reset-password.html`
    });

    if (error) {
      console.error('Password reset error:', error);
      return res.status(400).json({ 
        success: false, 
        error: "비밀번호 재설정 요청 중 오류가 발생했습니다." 
      });
    }

    res.json({ 
      success: true, 
      message: "비밀번호 재설정 링크가 이메일로 전송되었습니다." 
    });

  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ 
      success: false, 
      error: "서버 오류가 발생했습니다." 
    });
  }
});

// 이메일 재전송
router.post("/resend-email", async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: "이메일을 입력하세요." 
      });
    }

    const { error } = await createAuthClient().auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: `${req.protocol}://${req.get('host')}/email-confirmed.html`
      }
    });

    if (error) {
      console.error('Resend email error:', error);
      return res.status(400).json({ 
        success: false, 
        error: "이메일 재전송 중 오류가 발생했습니다." 
      });
    }

    res.json({ 
      success: true, 
      message: "인증 이메일이 재전송되었습니다." 
    });

  } catch (err) {
    console.error('Resend email error:', err);
    res.status(500).json({ 
      success: false, 
      error: "서버 오류가 발생했습니다." 
    });
  }
});

// 이메일 인증 완료 후 사용자 정보 동기화
router.post('/sync-email-user', async (req, res) => {
  try {
    const { access_token } = req.body;
    if (typeof access_token !== 'string' || !access_token) {
      return res.status(400).json({ error: '액세스 토큰이 필요합니다.' });
    }
    const { data, error } = await supabase.auth.getUser(access_token);
    if (error || !data?.user?.email_confirmed_at) {
      return res.status(400).json({ error: '이메일 인증 정보를 확인할 수 없습니다.' });
    }
    const user = await processUserDataAsync(data.user);
    res.json({ success: true, message: '사용자 정보가 동기화되었습니다.',
      user: { id: user.id, email: user.email, authType: user.authType, emailConfirmed: user.emailConfirmed } });
  } catch (error) {
    console.error('사용자 동기화 오류:', error.message);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 비밀번호 업데이트 (재설정 시)
router.post("/update-password", async (req, res) => {
  try {
    const { accessToken, refreshToken, newPassword } = req.body;

    if (typeof accessToken !== 'string' || !accessToken || typeof refreshToken !== 'string' || !refreshToken || typeof newPassword !== 'string' || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        error: "필수 정보가 누락되었습니다." 
      });
    }

    // 비밀번호 강도 검증
    if (newPassword.length < 8 || newPassword.length > 20) {
      return res.status(400).json({ 
        success: false, 
        error: "비밀번호는 8자 이상 20자 이하여야 합니다." 
      });
    }

    // 임시 Supabase 클라이언트 생성 (토큰 포함)
    const tempSupabase = createAuthClient();
    
    // 세션 설정
    const { data: sessionData, error: sessionError } = await tempSupabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken || null
    });

    if (sessionError) {
      console.error('Session error:', sessionError);
      return res.status(400).json({ 
        success: false, 
        error: "유효하지 않은 재설정 링크입니다." 
      });
    }

    // 비밀번호 업데이트
    const { data: updateData, error: updateError } = await tempSupabase.auth.updateUser({
      password: newPassword
    });

    if (updateError) {
      console.error('Password update error:', updateError);
      return res.status(400).json({ 
        success: false, 
        error: "비밀번호 변경 중 오류가 발생했습니다." 
      });
    }

    res.json({ 
      success: true, 
      message: "비밀번호가 성공적으로 변경되었습니다." 
    });

  } catch (err) {
    console.error('Update password error:', err);
    res.status(500).json({ 
      success: false, 
      error: "서버 오류가 발생했습니다." 
    });
  }
});

// Supabase authentication clients are request-local; terminate only this Express session.
router.post('/logout', (req, res) => {
  req.session.destroy(error => {
    if (error) return res.status(500).json({ success: false, error: '로그아웃에 실패했습니다.' });
    res.clearCookie('mealplan_session', { path: '/', ...(process.env.SESSION_COOKIE_DOMAIN ? { domain: process.env.SESSION_COOKIE_DOMAIN } : {}) });
    res.json({ success: true });
  });
});

// Google OAuth 로그인
router.post("/google", async (req, res) => {
  try {
    const { token } = req.body;

    // Google 토큰 검증
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleId = payload["sub"];
    const email = payload["email"];
    const name = payload["name"];
    const picture = payload["picture"];

    const users = readUsers();
    let user = users.find((u) => u.googleId === googleId);

    if (!user) {
      // 새 사용자 생성 - UUID 할당
      user = {
        id: generateUUID(), // UUID 생성
        googleId,
        email,
        name,
        picture,
        authType: "google", // 인증 타입 구분
        createdAt: new Date().toISOString(),
      };
      
      // Supabase에 사용자 정보 저장
      try {
        // 1. Supabase Auth에 사용자 생성
        const { data: supabaseUser, error: supabaseError } = await supabase.auth.admin.createUser({
          email: email,
          email_confirm: true,
          user_metadata: {
            googleId: googleId,
            name: name,
            picture: picture,
            authType: "google"
          }
        });
        
        if (supabaseError) {
          console.error("Supabase Auth 사용자 생성 오류:", supabaseError);
        } else {
          user.supabaseId = supabaseUser.user.id;
          
          // 2. Supabase users 테이블에 사용자 정보 저장
          const { error: tableError } = await supabase
            .from('users')
            .insert({
              id: supabaseUser.user.id,
              email: email,
              name: name,
              picture: picture,
              auth_type: 'google',
              google_id: googleId,
              profile: {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          if (tableError) {
            console.error("Supabase users 테이블 저장 오류:", tableError);
          }
        }
      } catch (supabaseErr) {
        console.error("Supabase 연동 오류:", supabaseErr);
      }
      
      user = saveAuthUser(user);
    } else {
      // 기존 사용자 정보 업데이트
      user.name = name || user.name;
      user.email = email || user.email;
      user.picture = picture || user.picture;
      
      // Supabase 사용자 정보 업데이트
      if (user.supabaseId) {
        try {
          // 1. Supabase Auth 사용자 메타데이터 업데이트
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            user.supabaseId,
            {
              user_metadata: {
                googleId: googleId,
                name: name,
                picture: picture,
                authType: "google"
              }
            }
          );
          
          if (updateError) {
            console.error("Supabase Auth 사용자 업데이트 오류:", updateError);
          }
          
          // 2. Supabase users 테이블 업데이트
          const { error: tableUpdateError } = await supabase
            .from('users')
            .update({
              name: name,
              picture: picture,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.supabaseId);
          
          if (tableUpdateError) {
            console.error("Supabase users 테이블 업데이트 오류:", tableUpdateError);
          }
        } catch (updateErr) {
          console.error("Supabase 업데이트 연동 오류:", updateErr);
        }
      }
      
      user = saveAuthUser(user);
    }

    // 세션에 사용자 정보 저장
    await establishSession(req, {
      id: user.id,
      name: user.name || user.email,
      email: user.email,
      authType: "google",
      isAdmin: user.isAdmin || false,
      role: user.role || null
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name || user.email,
        email: user.email,
        authType: "google",
        isAdmin: user.isAdmin || false,
        role: user.role || null
      },
    });
  } catch (error) {
    console.error("Google OAuth error:", error);
    res.status(401).json({ error: "구글 인증에 실패했습니다." });
  }
});

// 카카오 OAuth 인증 코드로 토큰 교환 및 로그인
router.post("/kakao", async (req, res) => {
  try {
    const { code, accessToken } = req.body;
    const axios = require("axios");
    let finalAccessToken = accessToken;

    // 인증 코드가 있으면 액세스 토큰으로 교환
    if (code && !accessToken) {
      const redirectUri = getKakaoRedirectUri(req);
      
      const tokenResponse = await axios.post(
        "https://kauth.kakao.com/oauth/token",
        new URLSearchParams({
          grant_type: "authorization_code",
          client_id: process.env.KAKAO_REST_API_KEY,
          redirect_uri: redirectUri,
          code: code,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      finalAccessToken = tokenResponse.data.access_token;
    }

    if (!finalAccessToken) {
      return res
        .status(400)
        .json({ error: "액세스 토큰 또는 인증 코드가 필요합니다." });
    }

    // 카카오 사용자 정보 조회
    const userInfoResponse = await axios.get(
      "https://kapi.kakao.com/v2/user/me",
      {
        headers: {
          Authorization: `Bearer ${finalAccessToken}`,
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        },
      }
    );

    const kakaoUser = userInfoResponse.data;
    const kakaoId = kakaoUser.id.toString();
    const email = kakaoUser.kakao_account?.email;
    const nickname = kakaoUser.kakao_account?.profile?.nickname;
    const profileImage = kakaoUser.kakao_account?.profile?.profile_image_url;

    const users = readUsers();
    let user = users.find((u) => u.kakaoId === kakaoId);

    if (!user) {
      // 새 사용자 생성 - UUID 할당
      user = {
        id: generateUUID(), // UUID 생성
        kakaoId,
        email,
        name: nickname,
        picture: profileImage,
        authType: "kakao",
        createdAt: new Date().toISOString(),
      };
      user = saveAuthUser(user);
    } else {
      // 기존 사용자 정보 업데이트
      user.name = nickname || user.name;
      user.email = email || user.email;
      user.picture = profileImage || user.picture;
      user = saveAuthUser(user);
    }

    // 세션에 사용자 정보 저장
    await establishSession(req, {
      id: user.id,
      name: user.name,
      email: user.email,
      authType: "kakao",
      isAdmin: user.isAdmin || false,
      role: user.role || null
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        authType: "kakao",
        isAdmin: user.isAdmin || false,
        role: user.role || null
      },
    });
  } catch (error) {
    console.error("Kakao OAuth error:", error);
    if (error.response) {
      console.error("Kakao API response:", error.response.data);
    }
    res.status(401).json({ error: "카카오 인증에 실패했습니다." });
  }
});

// 카카오 OAuth 콜백 처리
router.get("/kakao/callback", async (req, res) => {
  try {
    const { code, error } = req.query;

    if (error) {
      console.error("Kakao auth error:", error);
      return res.send(`
        <script>
          if (window.opener) {
            window.opener.postMessage('social_login_failed', window.location.origin);
            window.close();
          } else {
            window.location.href = '/login.html?error=kakao_auth_failed';
          }
        </script>
      `);
    }

    if (!code) {
      console.error("No authorization code received");
      return res.send(`
        <script>
          if (window.opener) {
            window.opener.postMessage('social_login_failed', window.location.origin);
            window.close();
          } else {
            window.location.href = '/login.html?error=no_auth_code';
          }
        </script>
      `);
    }

    // 리다이렉트 URI 생성
    const redirectUri = getKakaoRedirectUri(req);

    // 직접 토큰 교환 및 사용자 정보 조회
    const axios = require("axios");

    // 1. 인증 코드를 액세스 토큰으로 교환
    const tokenResponse = await axios.post(
      "https://kauth.kakao.com/oauth/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.KAKAO_REST_API_KEY,
        redirect_uri: redirectUri,
        code: code,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // 2. 카카오 사용자 정보 조회
    const userInfoResponse = await axios.get(
      "https://kapi.kakao.com/v2/user/me",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        },
      }
    );

    const kakaoUser = userInfoResponse.data;
    const kakaoId = kakaoUser.id.toString();
    const email = kakaoUser.kakao_account?.email;
    const nickname = kakaoUser.kakao_account?.profile?.nickname;
    const profileImage = kakaoUser.kakao_account?.profile?.profile_image_url;

    // 3. 사용자 데이터 처리
    const users = readUsers();
    let user = users.find((u) => u.kakaoId === kakaoId);
    
    // 디버깅: 사용자 검색 로그

    if (!user) {
      // 새 사용자 생성 - UUID 할당
      user = {
        id: generateUUID(), // UUID 생성
        kakaoId,
        email,
        name: nickname,
        picture: profileImage,
        authType: "kakao",
        createdAt: new Date().toISOString(),
      };
      
             // Supabase에 사용자 정보 저장
       try {
         // 1. Supabase Auth에 사용자 생성
         const { data: supabaseUser, error: supabaseError } = await supabase.auth.admin.createUser({
           email: email,
           email_confirm: true,
           user_metadata: {
             kakaoId: kakaoId,
             name: nickname,
             picture: profileImage,
             authType: "kakao"
           }
         });
         
         if (supabaseError) {
           console.error("Supabase Auth 사용자 생성 오류:", supabaseError);
         } else {
           user.supabaseId = supabaseUser.user.id;
           
           // 2. Supabase users 테이블에 사용자 정보 저장
           const { error: tableError } = await supabase
             .from('users')
             .insert({
               id: supabaseUser.user.id,
               email: email,
               name: nickname,
               picture: profileImage,
               auth_type: 'kakao',
               kakao_id: kakaoId,
               profile: {},
               created_at: new Date().toISOString(),
               updated_at: new Date().toISOString()
             });
           
           if (tableError) {
             console.error("Supabase users 테이블 저장 오류:", tableError);
           }
         }
       } catch (supabaseErr) {
         console.error("Supabase 연동 오류:", supabaseErr);
       }
      
      user = saveAuthUser(user);
    } else {
      // 기존 사용자 정보 업데이트
      user.name = nickname || user.name;
      user.email = email || user.email;
      user.picture = profileImage || user.picture;
      
             // Supabase 사용자 정보 업데이트
       if (user.supabaseId) {
         try {
           // 1. Supabase Auth 사용자 메타데이터 업데이트
           const { error: updateError } = await supabase.auth.admin.updateUserById(
             user.supabaseId,
             {
               user_metadata: {
                 kakaoId: kakaoId,
                 name: nickname,
                 picture: profileImage,
                 authType: "kakao"
               }
             }
           );
           
           if (updateError) {
             console.error("Supabase Auth 사용자 업데이트 오류:", updateError);
           }
           
           // 2. Supabase users 테이블 업데이트
           const { error: tableUpdateError } = await supabase
             .from('users')
             .update({
               name: nickname,
               picture: profileImage,
               updated_at: new Date().toISOString()
             })
             .eq('id', user.supabaseId);
           
           if (tableUpdateError) {
             console.error("Supabase users 테이블 업데이트 오류:", tableUpdateError);
           }
         } catch (updateErr) {
           console.error("Supabase 업데이트 연동 오류:", updateErr);
         }
       }
      
      user = saveAuthUser(user);
    }

    // 4. 세션에 사용자 정보 저장
    await establishSession(req, {
      id: user.id,
      name: user.name,
      email: user.email,
      authType: "kakao",
      kakaoId: user.kakaoId, // 카카오 ID 추가
      isAdmin: user.isAdmin || false,
      role: user.role || null
    });

    // 5. 팝업에서 부모창으로 메시지 전송 후 닫기 또는 현재 창에서 리다이렉트
    res.send(renderOAuthSuccess(req.session.user));
  } catch (error) {
    console.error("Kakao callback error:", error);
    if (error.response) {
      console.error("Kakao API error response:", error.response.data);
    }
    res.send(`
      <script>
        if (window.opener) {
          window.opener.postMessage('social_login_failed', window.location.origin);
          window.close();
        } else {
          window.location.href = '/login.html?error=callback_failed';
        }
      </script>
    `);
  }
});

// 카카오 REST API 키 제공 API
router.get("/kakao-rest-key", (req, res) => {
  if (!process.env.KAKAO_REST_API_KEY) {
    return res
      .status(500)
      .json({ error: "카카오 REST API 키가 설정되지 않았습니다." });
  }
  res.json({ apiKey: process.env.KAKAO_REST_API_KEY });
});

// 로그인 상태 확인
router.get("/me", (req, res) => {
  // console.log('사용자 상태 확인 요청:', {
  //   sessionId: req.sessionID,
  //   hasSession: !!req.session,
  //   hasUser: !!req.session?.user,
  //   sessionCookie: req.session?.cookie,
  //   headers: {
  //     cookie: req.headers.cookie,
  //     origin: req.headers.origin,
  //     referer: req.headers.referer
  //   }
  // });
  
  if (req.session.user) {
    // console.log('사용자 상태 확인 - 세션 사용자:', {
    //   id: req.session.user.id,
    //   email: req.session.user.email,
    //   isAdmin: req.session.user.isAdmin,
    //   role: req.session.user.role,
    //   authType: req.session.user.authType
    // });
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    // console.log('사용자 상태 확인 - 로그인되지 않음 (세션 없음)');
    
    // 세션이 없는 경우를 위한 대안 체크 (선택사항)
    // 실제 운영에서는 보안상 권장하지 않지만, Render 환경에서 임시 해결책으로 사용 가능
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // 토큰 검증 로직 (필요시 구현)
    }
    
    res.json({ loggedIn: false });
  }
});

// 아이디 중복 체크
router.get("/check-username", (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: "아이디를 입력하세요." });
  }
  const users = readUsers();
  const exists = users.some(u => u.username === username);
  res.json({ exists });
});

// 가입자 목록 반환 (비밀번호 제외) - Supabase 연동
router.get("/users", adminAuth, async (req, res) => {
  try {
    // Supabase users 테이블에서 사용자 목록 조회
    const { data: supabaseUsers, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase users 조회 오류:', error);
      // Supabase 조회 실패 시 로컬 JSON 파일에서 읽기
      const rawUsers = readUsers();
      const users = rawUsers.map(
        ({ password, googleId, kakaoId, naverId, ...rest }) => {
          // 기존 사용자 호환성: authType이 없는 경우 추가
          if (!rest.authType) {
            if (rest.username) {
              rest.authType = "local";
            } else if (googleId) {
              rest.authType = "google";
            } else if (kakaoId) {
              rest.authType = "kakao";
            } else if (naverId) {
              rest.authType = "naver";
            } else if (rest.email && !rest.username) {
              rest.authType = "google";
            } else {
              rest.authType = "unknown";
            }
          }
          return rest;
        }
      );
      return res.json(users);
    }

    // Supabase 데이터를 프론트엔드 형식으로 변환
    const users = supabaseUsers.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      authType: user.auth_type || 'email',
      createdAt: user.created_at,
      picture: user.picture,
      username: user.username,
      role: user.role,
      isAdmin: user.role === 'admin'
    }));

    res.json(users);
  } catch (err) {
    console.error('사용자 목록 조회 오류:', err);
    // 오류 발생 시 로컬 JSON 파일에서 읽기
    const rawUsers = readUsers();
    const users = rawUsers.map(
      ({ password, googleId, kakaoId, naverId, ...rest }) => {
        if (!rest.authType) {
          if (rest.username) {
            rest.authType = "local";
          } else if (googleId) {
            rest.authType = "google";
          } else if (kakaoId) {
            rest.authType = "kakao";
          } else if (naverId) {
            rest.authType = "naver";
          } else if (rest.email && !rest.username) {
            rest.authType = "google";
          } else {
            rest.authType = "unknown";
          }
        }
        return rest;
      }
    );
    res.json(users);
  }
});

// 관리자: 사용자 삭제 - Supabase 연동
router.delete("/users/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Supabase users 테이블에서 사용자 삭제
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase users 삭제 오류:', error);
      // Supabase 삭제 실패 시 로컬 JSON 파일에서 삭제
      let users = readUsers();
      const prevLen = users.length;
      users = users.filter((u) => u.id !== id);
      if (users.length === prevLen) {
        return res
          .status(404)
          .json({ success: false, error: "사용자를 찾을 수 없습니다." });
      }
      writeUsers(users);
      return res.json({ success: true });
    }

    // 로컬 JSON 파일에서도 삭제
    let users = readUsers();
    users = users.filter((u) => u.id !== id);
    writeUsers(users);

    res.json({ success: true });
  } catch (err) {
    console.error('사용자 삭제 오류:', err);
    res.status(500).json({ success: false, error: "사용자 삭제 중 오류가 발생했습니다." });
  }
});

// 비밀번호 변경
router.post('/change-password', requireLogin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== 'string' || !currentPassword || typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 20) {
      return res.status(400).json({ success: false, message: '현재 비밀번호와 8~20자의 새 비밀번호를 입력하세요.' });
    }
    const user = readUsers().find(candidate => candidate.id === req.session.user.id);
    if (!user) return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    if (req.session.user.authType === 'email') {
      const client = createAuthClient();
      const { data, error } = await client.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (error || !data?.user || data.user.id !== (user.supabaseId || user.id)) {
        return res.status(401).json({ success: false, message: '현재 비밀번호가 올바르지 않습니다.' });
      }
      const { error: updateError } = await client.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
    } else if (user.authType === 'local' || (!user.authType && typeof user.password === 'string')) {
      if (typeof user.password !== 'string' || !await bcrypt.compare(currentPassword, user.password)) {
        return res.status(401).json({ success: false, message: '현재 비밀번호가 올바르지 않습니다.' });
      }
      const hashed = await bcrypt.hash(newPassword, 10);
      const users = readUsers();
      const latest = users.find(candidate => candidate.id === user.id);
      if (!latest) return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
      latest.password = hashed;
      writeUsers(users);
    } else {
      return res.status(400).json({ success: false, message: '소셜 계정의 비밀번호는 해당 서비스에서 변경해주세요.' });
    }
    await establishSession(req, req.session.user);
    res.json({ success: true });
  } catch (error) {
    console.error('비밀번호 변경 오류:', error.message);
    res.status(500).json({ success: false, message: '비밀번호 변경 중 오류가 발생했습니다.' });
  }
});

// 네이버 Client ID 제공 API
router.get("/naver-client-id", (req, res) => {
  if (!NAVER_CLIENT_ID) {
    return res
      .status(500)
      .json({ error: "네이버 Client ID가 설정되지 않았습니다." });
  }
  res.json({ clientId: NAVER_CLIENT_ID });
});

// 네이버 OAuth 로그인
router.post("/naver", async (req, res) => {
  try {
    const { code, state, accessToken } = req.body;
    const axios = require("axios");
    let finalAccessToken = accessToken;

    // 인증 코드가 있으면 액세스 토큰으로 교환
    if (code && !accessToken) {
      const tokenResponse = await axios.post(
        "https://nid.naver.com/oauth2.0/token",
        null,
        {
          params: {
            grant_type: "authorization_code",
            client_id: NAVER_CLIENT_ID,
            client_secret: NAVER_CLIENT_SECRET,
            code: code,
            state: state,
          },
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      finalAccessToken = tokenResponse.data.access_token;
    }

    if (!finalAccessToken) {
      return res
        .status(400)
        .json({ error: "액세스 토큰 또는 인증 코드가 필요합니다." });
    }

    // 네이버 사용자 정보 조회
    const userInfoResponse = await axios.get(
      "https://openapi.naver.com/v1/nid/me",
      {
        headers: {
          Authorization: `Bearer ${finalAccessToken}`,
        },
      }
    );

    if (userInfoResponse.data.resultcode !== "00") {
      throw new Error("네이버 사용자 정보 조회 실패");
    }

    const naverUser = userInfoResponse.data.response;
    const naverId = naverUser.id;
    const email = naverUser.email;
    const nickname = naverUser.nickname || naverUser.name;
    const profileImage = naverUser.profile_image;

    const users = readUsers();
    let user = users.find((u) => u.naverId === naverId);

    if (!user) {
      // 새 사용자 생성 - UUID 할당
      user = {
        id: generateUUID(), // UUID 생성
        naverId,
        email,
        name: nickname,
        picture: profileImage,
        authType: "naver",
        createdAt: new Date().toISOString(),
      };
      user = saveAuthUser(user);
    } else {
      // 기존 사용자 정보 업데이트
      user.name = nickname || user.name;
      user.email = email || user.email;
      user.picture = profileImage || user.picture;
      user = saveAuthUser(user);
    }

    // 세션에 사용자 정보 저장
    await establishSession(req, {
      id: user.id,
      name: user.name,
      email: user.email,
      authType: "naver",
      isAdmin: user.isAdmin || false,
      role: user.role || null
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        authType: "naver",
        isAdmin: user.isAdmin || false,
        role: user.role || null
      },
    });
  } catch (error) {
    console.error("Naver OAuth error:", error);
    if (error.response) {
      console.error("Naver API response:", error.response.data);
    }
    res.status(401).json({ error: "네이버 인증에 실패했습니다." });
  }
});

// 관리자 권한 확인 API
router.get("/check-admin", (req, res) => {
  if (!req.session || !req.session.user) {
    return res.json({ success: false, isAdmin: false, message: "로그인이 필요합니다." });
  }
  
  const users = readUsers();
  const user = users.find(u => u.id === req.session.user.id);
  
  if (!user) {
    return res.json({ success: false, isAdmin: false, message: "사용자를 찾을 수 없습니다." });
  }
  
  // 관리자 권한 확인 (role 필드가 'admin'인 경우)
  const isAdmin = user.role === 'admin';
  
  // 관리자 권한 확인 (개발 환경에서만 로그)

  return res.json({ 
    success: true, 
    isAdmin, 
    message: isAdmin ? "관리자 권한이 확인되었습니다." : "관리자 권한이 없습니다." 
  });
});

// 네이버 OAuth 콜백 처리
router.get("/naver/callback", async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      console.error("Naver auth error:", error, error_description);
      return res.send(`
        <script>
          if (window.opener) {
            window.opener.postMessage('social_login_failed', window.location.origin);
            window.close();
          } else {
            window.location.href = '/login.html?error=naver_auth_failed';
          }
        </script>
      `);
    }

    if (!code) {
      console.error("No authorization code received");
      return res.send(`
        <script>
          if (window.opener) {
            window.opener.postMessage('social_login_failed', window.location.origin);
            window.close();
          } else {
            window.location.href = '/login.html?error=no_auth_code';
          }
        </script>
      `);
    }

    // 직접 토큰 교환 및 사용자 정보 조회
    const axios = require("axios");

    // 1. 인증 코드를 액세스 토큰으로 교환
    const tokenResponse = await axios.post(
      "https://nid.naver.com/oauth2.0/token",
      null,
      {
        params: {
          grant_type: "authorization_code",
          client_id: NAVER_CLIENT_ID,
          client_secret: NAVER_CLIENT_SECRET,
          code: code,
          state: state,
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // 2. 네이버 사용자 정보 조회
    const userInfoResponse = await axios.get(
      "https://openapi.naver.com/v1/nid/me",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (userInfoResponse.data.resultcode !== "00") {
      throw new Error("네이버 사용자 정보 조회 실패");
    }

    const naverUser = userInfoResponse.data.response;
    const naverId = naverUser.id;
    const email = naverUser.email;
    const nickname = naverUser.nickname || naverUser.name;
    const profileImage = naverUser.profile_image;

    // 3. 사용자 데이터 처리
    const users = readUsers();
    let user = users.find((u) => u.naverId === naverId);

    if (!user) {
      // 새 사용자 생성 - UUID 할당
      user = {
        id: generateUUID(), // UUID 생성
        naverId,
        email,
        name: nickname,
        picture: profileImage,
        authType: "naver",
        createdAt: new Date().toISOString(),
      };
      
             // Supabase에 사용자 정보 저장
       try {
         // 1. Supabase Auth에 사용자 생성
         const { data: supabaseUser, error: supabaseError } = await supabase.auth.admin.createUser({
           email: email,
           email_confirm: true,
           user_metadata: {
             naverId: naverId,
             name: nickname,
             picture: profileImage,
             authType: "naver"
           }
         });
         
         if (supabaseError) {
           console.error("Supabase Auth 사용자 생성 오류:", supabaseError);
         } else {
           user.supabaseId = supabaseUser.user.id;
           
           // 2. Supabase users 테이블에 사용자 정보 저장
           const { error: tableError } = await supabase
             .from('users')
             .insert({
               id: supabaseUser.user.id,
               email: email,
               name: nickname,
               picture: profileImage,
               auth_type: 'naver',
               naver_id: naverId,
               profile: {},
               created_at: new Date().toISOString(),
               updated_at: new Date().toISOString()
             });
           
           if (tableError) {
             console.error("Supabase users 테이블 저장 오류:", tableError);
           }
         }
       } catch (supabaseErr) {
         console.error("Supabase 연동 오류:", supabaseErr);
       }
      
      user = saveAuthUser(user);
    } else {
      // 기존 사용자 정보 업데이트
      user.name = nickname || user.name;
      user.email = email || user.email;
      user.picture = profileImage || user.picture;
      
             // Supabase 사용자 정보 업데이트
       if (user.supabaseId) {
         try {
           // 1. Supabase Auth 사용자 메타데이터 업데이트
           const { error: updateError } = await supabase.auth.admin.updateUserById(
             user.supabaseId,
             {
               user_metadata: {
                 naverId: naverId,
                 name: nickname,
                 picture: profileImage,
                 authType: "naver"
               }
             }
           );
           
           if (updateError) {
             console.error("Supabase Auth 사용자 업데이트 오류:", updateError);
           }
           
           // 2. Supabase users 테이블 업데이트
           const { error: tableUpdateError } = await supabase
             .from('users')
             .update({
               name: nickname,
               picture: profileImage,
               updated_at: new Date().toISOString()
             })
             .eq('id', user.supabaseId);
           
           if (tableUpdateError) {
             console.error("Supabase users 테이블 업데이트 오류:", tableUpdateError);
           }
         } catch (updateErr) {
           console.error("Supabase 업데이트 연동 오류:", updateErr);
         }
       }
      
      user = saveAuthUser(user);
    }

    // 4. 세션에 사용자 정보 저장
    await establishSession(req, {
      id: user.id,
      name: user.name,
      email: user.email,
      authType: "naver",
      naverId: user.naverId, // 네이버 ID 추가
      isAdmin: user.isAdmin || false,
      role: user.role || null
    });

    // 5. 팝업에서 부모창으로 메시지 전송 후 닫기 또는 현재 창에서 리다이렉트
    res.send(renderOAuthSuccess(req.session.user));
  } catch (error) {
    console.error("Naver callback error:", error);
    if (error.response) {
      console.error("Naver API error response:", error.response.data);
    }
    res.send(`
      <script>
        if (window.opener) {
          window.opener.postMessage('social_login_failed', window.location.origin);
          window.close();
        } else {
          window.location.href = '/login.html?error=callback_failed';
        }
      </script>
    `);
  }
});
module.exports = router;
