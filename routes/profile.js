const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const ProfileCompletionService = require('../utils/profileCompletionService');
const { readUsers, writeUsers } = require('../utils/userStore');
const { requireLogin } = require('../utils/authMiddleware');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
});
router.use(requireLogin);

function findSessionUser(users, sessionUser) {
  return users.find(user => user.id === sessionUser.id || user.supabaseId === sessionUser.id);
}

// Local profile changes remain authoritative if a previous cloud sync failed.
router.get('/', async (req, res) => {
  try {
    let user = findSessionUser(readUsers(), req.session.user);
    if (!user) return res.status(404).json({ error: '사용자 없음' });
    if (user.profile && typeof user.profile === 'object') return res.json(user.profile);
    if (user.supabaseId) {
      const { data, error } = await supabase.from('users').select('profile').eq('id', user.supabaseId).single();
      if (error) throw error;
      if (data?.profile) {
        // Reload after the network request so other users and point updates are preserved.
        const users = readUsers();
        user = findSessionUser(users, req.session.user);
        if (!user) return res.status(404).json({ error: '사용자 없음' });
        if (!user.profile) {
          user.profile = data.profile;
          writeUsers(users);
        }
      }
    }
    res.json(user.profile || {});
  } catch (error) {
    console.error('프로필 조회 오류:', error.message);
    res.status(500).json({ error: '프로필 조회 중 오류가 발생했습니다.' });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: '유효한 프로필이 필요합니다.' });
    }
    const users = readUsers();
    const user = findSessionUser(users, req.session.user);
    if (!user) return res.status(404).json({ error: '사용자 없음' });
    user.profile = req.body;
    writeUsers(users);
    const completion = ProfileCompletionService.checkAndRewardCompletion(user.id, req.body);
    let cloudSynced = !user.supabaseId;
    if (user.supabaseId) {
      try {
        const { error } = await supabase.from('users').update({
          profile: req.body, updated_at: new Date().toISOString()
        }).eq('id', user.supabaseId);
        if (error) throw error;
        cloudSynced = true;
      } catch (error) {
        console.error('프로필 클라우드 저장 오류:', error.message);
      }
    }
    res.json({ success: true, profileSaved: true, cloudSynced, completion });
  } catch (error) {
    console.error('프로필 저장 오류:', error.message);
    res.status(500).json({ error: '프로필 저장 중 오류가 발생했습니다.' });
  }
});

router.delete('/', async (req, res) => {
  try {
    let user = findSessionUser(readUsers(), req.session.user);
    if (!user) return res.status(404).json({ error: '사용자 없음' });
    if (user.supabaseId) {
      const { error } = await supabase.from('users').update({
        profile: {}, updated_at: new Date().toISOString()
      }).eq('id', user.supabaseId);
      if (error) throw error;
    }
    const users = readUsers();
    user = findSessionUser(users, req.session.user);
    if (!user) return res.status(404).json({ error: '사용자 없음' });
    user.profile = {};
    writeUsers(users);
    res.json({ success: true });
  } catch (error) {
    console.error('프로필 초기화 오류:', error.message);
    res.status(500).json({ error: '프로필 초기화 중 오류가 발생했습니다.' });
  }
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
