const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const ProfileCompletionService = require('../utils/profileCompletionService');
const USERS_FILE = path.join(__dirname, '../data/users.json');

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  global: {
    headers: {
      'x-client-info': 'meal-plan-app/1.0.0'
    }
  }
});

function readUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  const data = fs.readFileSync(USERS_FILE, 'utf-8');
  return JSON.parse(data);
}
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// 내 프로필 조회
router.get('/', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: '로그인 필요' });
  
  try {
    const users = readUsers();
    console.log('프로필 조회 요청 - 세션 사용자 ID:', req.session.user.id);
    
    // 사용자 검색 (여러 방법으로 시도)
    let user = users.find(u => u.id === req.session.user.id);
    
    // ID로 찾지 못한 경우 이메일로 검색
    if (!user && req.session.user.email) {
      user = users.find(u => u.email === req.session.user.email);
      console.log('이메일로 사용자 검색 결과:', user ? '찾음' : '없음');
    }
    
    // 카카오/네이버 ID로 검색
    if (!user && req.session.user.authType === 'kakao' && req.session.user.kakaoId) {
      user = users.find(u => u.kakaoId === req.session.user.kakaoId);
      console.log('세션 카카오 ID로 사용자 검색 결과:', user ? '찾음' : '없음');
    }
    
    if (!user && req.session.user.authType === 'naver' && req.session.user.naverId) {
      user = users.find(u => u.naverId === req.session.user.naverId);
      console.log('세션 네이버 ID로 사용자 검색 결과:', user ? '찾음' : '없음');
    }
    
    if (!user) {
      console.error('사용자를 찾을 수 없음. 전체 사용자 목록:', users.map(u => ({ id: u.id, email: u.email, authType: u.authType })));
      return res.status(404).json({ error: '사용자 없음' });
    }
    
    console.log('사용자 찾음 - 사용자 ID:', user.id);
    
    // Supabase에서 최신 프로필 데이터 가져오기
    if (user.supabaseId) {
      try {
        console.log('Supabase에서 프로필 데이터 조회 시작...');
        const { data: supabaseProfile, error: fetchError } = await supabase
          .from('users')
          .select('profile')
          .eq('id', user.supabaseId)
          .single();
        
        if (fetchError) {
          console.error('Supabase 프로필 조회 오류:', fetchError);
        } else if (supabaseProfile && supabaseProfile.profile) {
          console.log('Supabase에서 프로필 데이터 가져옴');
          // 로컬 데이터도 업데이트
          user.profile = supabaseProfile.profile;
          writeUsers(users);
          return res.json(supabaseProfile.profile);
        }
      } catch (supabaseErr) {
        console.error('Supabase 프로필 조회 연동 오류:', supabaseErr);
      }
    }
    
    if (!user.profile) user.profile = {};
    res.json(user.profile);
  } catch (error) {
    console.error('프로필 조회 오류:', error);
    res.status(500).json({ error: '프로필 조회 중 오류가 발생했습니다.' });
  }
});

// 내 프로필 저장
router.post('/', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: '로그인 필요' });
  
  try {
    const users = readUsers();
    console.log('프로필 저장 요청 - 세션 사용자 ID:', req.session.user.id);
    console.log('세션 사용자 정보:', req.session.user);
    
    // 사용자 검색 (여러 방법으로 시도)
    let idx = users.findIndex(u => u.id === req.session.user.id);
    
    // ID로 찾지 못한 경우 이메일로 검색
    if (idx === -1 && req.session.user.email) {
      idx = users.findIndex(u => u.email === req.session.user.email);
      console.log('이메일로 사용자 검색 결과:', idx);
    }
    
    // 카카오/네이버 ID로 검색
    if (idx === -1 && req.session.user.authType === 'kakao' && req.session.user.kakaoId) {
      // 세션의 카카오 ID로 직접 검색
      idx = users.findIndex(u => u.kakaoId === req.session.user.kakaoId);
      console.log('세션 카카오 ID로 사용자 검색 결과:', idx);
    }
    
    if (idx === -1 && req.session.user.authType === 'naver' && req.session.user.naverId) {
      // 세션의 네이버 ID로 직접 검색
      idx = users.findIndex(u => u.naverId === req.session.user.naverId);
      console.log('세션 네이버 ID로 사용자 검색 결과:', idx);
    }
    
    if (idx === -1) {
      console.error('사용자를 찾을 수 없음. 전체 사용자 목록:', users.map(u => ({ id: u.id, email: u.email, authType: u.authType })));
      return res.status(404).json({ error: '사용자 없음' });
    }
    
    console.log('사용자 찾음 - 인덱스:', idx, '사용자 ID:', users[idx].id);
    
    // 프로필 업데이트
    if (!users[idx].profile) users[idx].profile = {};
    users[idx].profile = req.body;
    writeUsers(users);
    
    // Supabase에 프로필 데이터 저장
    const user = users[idx];
    if (user.supabaseId) {
      try {
        console.log('Supabase에 프로필 데이터 저장 시작...');
        console.log('Supabase 사용자 ID:', user.supabaseId);
        
        // Supabase users 테이블에 프로필 데이터 업데이트
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            profile: req.body,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.supabaseId);
        
        if (updateError) {
          console.error('Supabase 프로필 업데이트 오류:', updateError);
        } else {
          console.log('Supabase 프로필 데이터 저장 성공');
        }
      } catch (supabaseErr) {
        console.error('Supabase 프로필 저장 연동 오류:', supabaseErr);
      }
    } else {
      console.log('Supabase ID가 없어 로컬에만 저장됨');
    }
    
    // 프로필 완성도 체크 및 보상 지급
    console.log('프로필 저장 완료, 완성도 체크 시작');
    console.log('저장된 프로필 데이터:', JSON.stringify(req.body, null, 2));
    
    const completionResult = ProfileCompletionService.checkAndRewardCompletion(
      req.session.user.id, 
      req.body
    );
    
    console.log('완성도 체크 결과:', JSON.stringify(completionResult, null, 2));
    
    // 응답에 완성도 정보와 보상 정보 포함
    res.json({ 
      success: true,
      profileSaved: true,
      completion: completionResult
    });
    
  } catch (error) {
    console.error('프로필 저장 오류:', error);
    res.status(500).json({ 
      error: '프로필 저장 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// 내 프로필 삭제(초기화)
router.delete('/', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: '로그인 필요' });
  const users = readUsers();
  const idx = users.findIndex(u => u.id === req.session.user.id);
  if (idx === -1) return res.status(404).json({ error: '사용자 없음' });
  users[idx].profile = {};
  writeUsers(users);
  res.json({ success: true });
});

// 프로필 완성도 조회
router.get('/completion-status', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: '로그인 필요' });
  
  try {
    const completionStatus = ProfileCompletionService.getProfileCompletionStatus(req.session.user.id);
    res.json(completionStatus);
  } catch (error) {
    console.error('프로필 완성도 조회 오류:', error);
    res.status(500).json({ 
      error: '프로필 완성도 조회 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// 프로필 완성 가이드 조회
router.get('/completion-guide', (req, res) => {
  console.log('프로필 완성 가이드 요청 받음');
  console.log('세션 사용자:', req.session?.user?.id);
  
  if (!req.session.user) {
    console.log('로그인되지 않은 사용자');
    return res.status(401).json({ error: '로그인 필요' });
  }
  
  try {
    const users = readUsers();
    const user = users.find(u => u.id === req.session.user.id);
    if (!user) {
      console.log('사용자를 찾을 수 없음:', req.session.user.id);
      return res.status(404).json({ error: '사용자 없음' });
    }
    
    const profile = user.profile || {};
    console.log('프로필 데이터:', Object.keys(profile));
    
    const guide = ProfileCompletionService.getCompletionGuide(profile);
    console.log('가이드 생성 완료');
    
    res.json({
      success: true,
      guide
    });
  } catch (error) {
    console.error('프로필 완성 가이드 조회 오류:', error);
    res.status(500).json({ 
      error: '프로필 완성 가이드 조회 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

module.exports = router; 