const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const ProfileCompletionService = require('../utils/profileCompletionService');
const USERS_FILE = path.join(__dirname, '../data/users.json');

function readUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  const data = fs.readFileSync(USERS_FILE, 'utf-8');
  return JSON.parse(data);
}
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// 내 프로필 조회
router.get('/', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: '로그인 필요' });
  const users = readUsers();
  const user = users.find(u => u.id === req.session.user.id);
  if (!user) return res.status(404).json({ error: '사용자 없음' });
  if (!user.profile) user.profile = {};
  res.json(user.profile);
});

// 내 프로필 저장
router.post('/', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: '로그인 필요' });
  
  try {
    const users = readUsers();
    const idx = users.findIndex(u => u.id === req.session.user.id);
    if (idx === -1) return res.status(404).json({ error: '사용자 없음' });
    
    // 프로필 업데이트
    if (!users[idx].profile) users[idx].profile = {};
    users[idx].profile = req.body;
    writeUsers(users);
    
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