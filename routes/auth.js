const express = require("express");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const session = require("express-session");
const { OAuth2Client } = require("google-auth-library");
const { createClient } = require('@supabase/supabase-js');
const { getCacheManager } = require("../utils/cacheManager");
const cacheManager = getCacheManager();
const router = express.Router();

// UUID 생성 함수
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const USERS_FILE = path.join(__dirname, "../data/users.json");

// Supabase 클라이언트 초기화 (성능 최적화 옵션 추가)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false, // 자동 토큰 갱신 비활성화로 성능 향상
    persistSession: false,   // 세션 지속성 비활성화로 메모리 사용량 감소
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

// 유저 데이터 읽기/쓰기 함수 (캐싱 적용)
function readUsers() {
  // 캐시에서 먼저 확인
  const cachedUsers = cacheManager.getUserData('all_users');
  if (cachedUsers) {
    return cachedUsers;
  }
  
  // 캐시에 없으면 파일에서 읽기
  if (!fs.existsSync(USERS_FILE)) {
    const emptyUsers = [];
    cacheManager.cacheUserData('all_users', emptyUsers, 300); // 5분 캐싱
    return emptyUsers;
  }
  
  const data = fs.readFileSync(USERS_FILE, "utf-8");
  const parsed = JSON.parse(data);
  let users;
  
  // users가 객체(users 필드)면 배열로 변환해서 반환
  if (parsed.users && typeof parsed.users === "object") {
    users = Object.values(parsed.users);
  } else {
    // 배열 형태면 그대로 반환
    users = Array.isArray(parsed) ? parsed : [];
  }
  
  // 캐시에 저장 (5분)
  cacheManager.cacheUserData('all_users', users, 300);
  return users;
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  // 캐시 무효화
  cacheManager.invalidateUserCache('all_users');
  // 새 데이터로 캐시 업데이트
  cacheManager.cacheUserData('all_users', users, 300);
}

// 사용자 데이터 처리를 비동기로 수행하는 함수
async function processUserDataAsync(user) {
  return new Promise((resolve) => {
    // 백그라운드에서 사용자 데이터 처리
    setImmediate(() => {
      try {
        const users = readUsers();
        let existingUser = users.find(u => u.email === user.email);
        
        if (!existingUser) {
          // 새 사용자 생성
          const newUser = {
            id: user.id,
            email: user.email,
            authType: "email",
            emailConfirmed: true,
            createdAt: new Date().toISOString(),
            supabaseId: user.id,
            isAdmin: false,
            role: null
          };
          
          users.push(newUser);
          writeUsers(users);
          
          console.log("이메일 로그인 시 새 사용자 저장:", newUser.id);
          resolve(newUser);
        } else {
          // 기존 사용자 정보 업데이트
          existingUser.emailConfirmed = user.email_confirmed_at ? true : false;
          existingUser.supabaseId = user.id;
          
          // isAdmin과 role 필드가 없으면 기본값 설정
          if (existingUser.isAdmin === undefined) {
            existingUser.isAdmin = false;
          }
          if (existingUser.role === undefined) {
            existingUser.role = null;
          }
          
          writeUsers(users);
          
          console.log("기존 사용자 정보 업데이트:", existingUser.id, "isAdmin:", existingUser.isAdmin, "role:", existingUser.role);
          resolve(existingUser);
        }
      } catch (error) {
        console.error("사용자 데이터 처리 오류:", error);
        // 오류 시 기본 사용자 데이터 반환
        resolve({
          id: user.id,
          email: user.email,
          authType: "email",
          emailConfirmed: true,
          isAdmin: false,
          role: null
        });
      }
    });
  });
}

// 이메일 기반 회원가입 (Supabase)
router.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // 입력값 검증
    if (!email || !password) {
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
    const { data, error } = await supabase.auth.signUp({
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
  const startTime = Date.now();
  
  try {
    const { email, password } = req.body;
    
    // 입력값 검증
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: "이메일과 비밀번호를 입력하세요." 
      });
    }

    // Supabase를 통한 로그인 (타임아웃 설정)
    const loginPromise = supabase.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    // 10초 타임아웃 설정
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('로그인 요청 시간 초과')), 10000);
    });
    
    const { data, error } = await Promise.race([loginPromise, timeoutPromise]);

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
    req.session.user = { 
      id: user.id, 
      email: user.email, 
      authType: "email",
      emailConfirmed: user.email_confirmed_at ? true : false,
      isAdmin: userData.isAdmin || false,
      role: userData.role || null
    };

    // 즉시 응답 반환
    res.json({ 
      success: true, 
      user: { 
        id: user.id, 
        email: user.email, 
        authType: "email",
        emailConfirmed: user.email_confirmed_at ? true : false,
        isAdmin: userData.isAdmin || false,
        role: userData.role || null
      } 
    });


  } catch (err) {
    const duration = Date.now() - startTime;
    console.error('Login error:', err);
    console.log(`로그인 실패 - 소요시간: ${duration}ms`);
    
    res.status(500).json({ 
      success: false, 
      error: "서버 오류가 발생했습니다." 
    });
  } finally {
    const duration = Date.now() - startTime;
    console.log(`로그인 처리 완료 - 소요시간: ${duration}ms`);
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

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
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

    const { error } = await supabase.auth.resend({
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
router.post("/sync-email-user", async (req, res) => {
  try {
    const { access_token } = req.body;
    
    if (!access_token) {
      return res.status(400).json({ error: "액세스 토큰이 필요합니다." });
    }
    
    // Supabase에서 사용자 정보 가져오기
    const { data: { user }, error } = await supabase.auth.getUser(access_token);
    
    if (error || !user) {
      console.error("사용자 정보 가져오기 오류:", error);
      return res.status(400).json({ error: "사용자 정보를 가져올 수 없습니다." });
    }
    
    // 이메일 인증이 완료되지 않은 경우
    if (!user.email_confirmed_at) {
      return res.status(400).json({ error: "이메일 인증이 완료되지 않았습니다." });
    }
    
    // 로컬 JSON 파일에서 기존 사용자 확인
    const users = readUsers();
    let existingUser = users.find(u => u.email === user.email && u.authType === "email");
    
    if (!existingUser) {
      // 새 사용자 생성
      const newUser = {
        id: user.id,
        email: user.email,
        authType: "email",
        emailConfirmed: true,
        createdAt: new Date().toISOString(),
        supabaseId: user.id
      };
      
      users.push(newUser);
      writeUsers(users);
      
      console.log("이메일 인증 완료된 새 사용자 저장:", newUser.id);
      
      res.json({ 
        success: true, 
        message: "사용자 정보가 동기화되었습니다.",
        user: newUser
      });
    } else {
      // 기존 사용자 업데이트
      existingUser.emailConfirmed = true;
      existingUser.supabaseId = user.id;
      writeUsers(users);
      
      console.log("기존 사용자 이메일 인증 상태 업데이트:", existingUser.id);
      
      res.json({ 
        success: true, 
        message: "사용자 정보가 업데이트되었습니다.",
        user: existingUser
      });
    }
    
  } catch (err) {
    console.error("사용자 동기화 서버 오류:", err);
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

// 비밀번호 업데이트 (재설정 시)
router.post("/update-password", async (req, res) => {
  try {
    const { accessToken, refreshToken, newPassword } = req.body;
    
    console.log('비밀번호 업데이트 요청:', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      passwordLength: newPassword ? newPassword.length : 0
    });
    
    if (!accessToken || !newPassword) {
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
    const tempSupabase = createClient(supabaseUrl, supabaseKey);
    
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

    console.log('세션 설정 성공:', {
      userId: sessionData.user?.id,
      email: sessionData.user?.email
    });

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

    console.log('비밀번호 업데이트 성공:', {
      userId: updateData.user?.id,
      email: updateData.user?.email
    });

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

// 로그아웃
router.post("/logout", async (req, res) => {
  try {
    // Supabase 세션 종료
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Supabase logout error:', error);
    }
    
    // Express 세션 종료
    req.session.destroy(() => {
      res.json({ success: true });
    });
  } catch (err) {
    console.error('Logout error:', err);
    // 세션은 여전히 종료
    req.session.destroy(() => {
      res.json({ success: true });
    });
  }
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
      users.push(user);
      writeUsers(users);
      console.log("새 구글 사용자 생성 (UUID):", user.id);
    }

    // 세션에 사용자 정보 저장
    req.session.user = {
      id: user.id,
      name: user.name || user.email,
      email: user.email,
      authType: "google",
      isAdmin: user.isAdmin || false,
      role: user.role || null
    };

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
      const tokenResponse = await axios.post(
        "https://kauth.kakao.com/oauth/token",
        new URLSearchParams({
          grant_type: "authorization_code",
          client_id: process.env.KAKAO_REST_API_KEY,
          redirect_uri: `${req.protocol}://${req.get(
            "host"
          )}/api/auth/kakao/callback`,
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
      users.push(user);
      writeUsers(users);
      console.log("새 카카오 사용자 생성 (UUID):", user.id);
    } else {
      // 기존 사용자 정보 업데이트
      user.name = nickname || user.name;
      user.email = email || user.email;
      user.picture = profileImage || user.picture;
      writeUsers(users);
    }

    // 세션에 사용자 정보 저장
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      authType: "kakao",
      isAdmin: user.isAdmin || false,
      role: user.role || null
    };

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
            window.opener.postMessage('social_login_failed', '*');
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
            window.opener.postMessage('social_login_failed', '*');
            window.close();
          } else {
            window.location.href = '/login.html?error=no_auth_code';
          }
        </script>
      `);
    }

    console.log("Received kakao auth code:", code);
    console.log("Using KAKAO_REST_API_KEY:", process.env.KAKAO_REST_API_KEY);
    console.log(
      "Redirect URI:",
      `${req.protocol}://${req.get("host")}/api/auth/kakao/callback`
    );

    // 직접 토큰 교환 및 사용자 정보 조회
    const axios = require("axios");

    // 1. 인증 코드를 액세스 토큰으로 교환
    const tokenResponse = await axios.post(
      "https://kauth.kakao.com/oauth/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.KAKAO_REST_API_KEY,
        redirect_uri: `${req.protocol}://${req.get(
          "host"
        )}/api/auth/kakao/callback`,
        code: code,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;
    console.log("Got access token:", accessToken ? "✓" : "✗");

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

    console.log("Kakao user info:", {
      kakaoId,
      nickname,
      email: email ? "✓" : "✗",
    });

    // 3. 사용자 데이터 처리
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
      users.push(user);
      writeUsers(users);
      console.log("Created new kakao user (UUID):", user.id);
    } else {
      // 기존 사용자 정보 업데이트
      user.name = nickname || user.name;
      user.email = email || user.email;
      user.picture = profileImage || user.picture;
      writeUsers(users);
      console.log("Updated existing kakao user:", user.id);
    }

    // 4. 세션에 사용자 정보 저장
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      authType: "kakao",
      isAdmin: user.isAdmin || false,
      role: user.role || null
    };

    console.log("Session user set:", req.session.user);

    // 5. 팝업에서 부모창으로 메시지 전송 후 닫기
    res.send(`
      <script>
        if (window.opener) {
          window.opener.postMessage('social_login_success', '*');
          window.close();
        } else {
          window.location.href = '/index.html?login=success';
        }
      </script>
    `);
  } catch (error) {
    console.error("Kakao callback error:", error);
    if (error.response) {
      console.error("Kakao API error response:", error.response.data);
    }
    res.send(`
      <script>
        if (window.opener) {
          window.opener.postMessage('social_login_failed', '*');
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
  if (req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
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

// 가입자 목록 반환 (비밀번호 제외)
router.get("/users", (req, res) => {
  const rawUsers = readUsers();
  console.log(
    "Raw users data:",
    rawUsers.map((u) => ({
      id: u.id,
      authType: u.authType,
      kakaoId: !!u.kakaoId,
      googleId: !!u.googleId,
      naverId: !!u.naverId,
      username: !!u.username,
    }))
  );

  const users = rawUsers.map(
    ({ password, googleId, kakaoId, naverId, ...rest }) => {
      console.log(
        `Processing user ${rest.id}: authType=${
          rest.authType
        }, kakaoId=${!!kakaoId}, googleId=${!!googleId}, naverId=${!!naverId}, username=${!!rest.username}`
      );

      // 기존 사용자 호환성: authType이 없는 경우 추가
      if (!rest.authType) {
        if (rest.username) {
          rest.authType = "local"; // 일반 로그인 사용자
          console.log(`Set authType to 'local' for user ${rest.id}`);
        } else if (googleId) {
          rest.authType = "google"; // 구글 사용자
          console.log(`Set authType to 'google' for user ${rest.id}`);
        } else if (kakaoId) {
          rest.authType = "kakao"; // 카카오 사용자
          console.log(`Set authType to 'kakao' for user ${rest.id}`);
        } else if (naverId) {
          rest.authType = "naver"; // 네이버 사용자
          console.log(`Set authType to 'naver' for user ${rest.id}`);
        } else if (rest.email && !rest.username) {
          rest.authType = "google"; // 이메일만 있고 username이 없으면 구글 사용자로 추정
          console.log(
            `Set authType to 'google' (email only) for user ${rest.id}`
          );
        } else {
          rest.authType = "unknown"; // 알 수 없는 경우
          console.log(`Set authType to 'unknown' for user ${rest.id}`);
        }
      } else {
        console.log(`User ${rest.id} already has authType: ${rest.authType}`);
      }

      return rest;
    }
  );

  console.log(
    "Final users data:",
    users.map((u) => ({ id: u.id, authType: u.authType, name: u.name }))
  );
  res.json(users);
});

// 관리자: 사용자 삭제
router.delete("/users/:id", (req, res) => {
  const { id } = req.params;
  let users = readUsers();
  const prevLen = users.length;
  users = users.filter((u) => u.id !== id);
  if (users.length === prevLen) {
    return res
      .status(404)
      .json({ success: false, error: "사용자를 찾을 수 없습니다." });
  }
  writeUsers(users);
  res.json({ success: true });
});

// 비밀번호 변경
router.post("/change-password", async (req, res) => {
  if (!req.session.user) {
    return res
      .status(401)
      .json({ success: false, message: "로그인이 필요합니다." });
  }

  // Google 사용자는 비밀번호 변경 불가
  if (req.session.user.authType === "google") {
    return res.status(400).json({
      success: false,
      message: "구글 계정은 비밀번호 변경이 불가능합니다.",
    });
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ success: false, message: "모든 항목을 입력하세요." });
  }
  const users = readUsers();
  const userIdx = users.findIndex(
    (u) => u.username === req.session.user.username
  );
  if (userIdx === -1) {
    return res
      .status(404)
      .json({ success: false, message: "사용자를 찾을 수 없습니다." });
  }
  const user = users[userIdx];
  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) {
    return res
      .status(401)
      .json({ success: false, message: "현재 비밀번호가 올바르지 않습니다." });
  }
  const hashed = await bcrypt.hash(newPassword, 10);
  users[userIdx].password = hashed;
  writeUsers(users);
  res.json({ success: true });
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
      users.push(user);
      writeUsers(users);
      console.log("새 네이버 사용자 생성 (UUID):", user.id);
    } else {
      // 기존 사용자 정보 업데이트
      user.name = nickname || user.name;
      user.email = email || user.email;
      user.picture = profileImage || user.picture;
      writeUsers(users);
    }

    // 세션에 사용자 정보 저장
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      authType: "naver",
      isAdmin: user.isAdmin || false,
      role: user.role || null
    };

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
  
  // 디버깅 정보 출력
  console.log('관리자 권한 확인:', {
    userId: user.id,
    username: user.username,
    role: user.role,
    isAdmin: isAdmin
  });
  
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
            window.opener.postMessage('social_login_failed', '*');
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
            window.opener.postMessage('social_login_failed', '*');
            window.close();
          } else {
            window.location.href = '/login.html?error=no_auth_code';
          }
        </script>
      `);
    }

    console.log("Received naver auth code:", code);
    console.log("Using NAVER_CLIENT_ID:", NAVER_CLIENT_ID);
    console.log(
      "Redirect URI:",
      `${req.protocol}://${req.get("host")}/api/auth/naver/callback`
    );

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
    console.log("Got access token:", accessToken ? "✓" : "✗");

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

    console.log("Naver user info:", {
      naverId,
      nickname,
      email: email ? "✓" : "✗",
    });

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
      users.push(user);
      writeUsers(users);
      console.log("Created new naver user (UUID):", user.id);
    } else {
      // 기존 사용자 정보 업데이트
      user.name = nickname || user.name;
      user.email = email || user.email;
      user.picture = profileImage || user.picture;
      writeUsers(users);
      console.log("Updated existing naver user:", user.id);
    }

    // 4. 세션에 사용자 정보 저장
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      authType: "naver",
      isAdmin: user.isAdmin || false,
      role: user.role || null
    };

    console.log("Session user set:", req.session.user);

    // 5. 팝업에서 부모창으로 메시지 전송 후 닫기
    res.send(`
      <script>
        if (window.opener) {
          window.opener.postMessage('social_login_success', '*');
          window.close();
        } else {
          window.location.href = '/index.html?login=success';
        }
      </script>
    `);
  } catch (error) {
    console.error("Naver callback error:", error);
    if (error.response) {
      console.error("Naver API error response:", error.response.data);
    }
    res.send(`
      <script>
        if (window.opener) {
          window.opener.postMessage('social_login_failed', '*');
          window.close();
        } else {
          window.location.href = '/login.html?error=callback_failed';
        }
      </script>
    `);
  }
});
module.exports = router;