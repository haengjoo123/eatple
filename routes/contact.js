const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// 문의 데이터 저장 경로
const CONTACT_DATA_PATH = path.join(__dirname, '../data/contacts.json');

// 문의 데이터 파일 초기화 (없는 경우)
function initContactDataFile() {
  if (!fs.existsSync(CONTACT_DATA_PATH)) {
    fs.writeFileSync(CONTACT_DATA_PATH, JSON.stringify({ contacts: [] }), 'utf8');
    console.log('문의 데이터 파일이 생성되었습니다.');
  }
}

// 문의 데이터 저장
function saveContact(contactData) {
  try {
    initContactDataFile();
    
    // 기존 데이터 읽기
    const data = JSON.parse(fs.readFileSync(CONTACT_DATA_PATH, 'utf8'));
    
    // 새 문의 추가
    data.contacts.push({
      id: `contact_${Date.now()}`,
      ...contactData
    });
    
    // 파일에 저장
    fs.writeFileSync(CONTACT_DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('문의 데이터 저장 오류:', error);
    return false;
  }
}

// 문의 제출 API 엔드포인트
router.post('/submit', (req, res) => {
  // 로그인 확인
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
  }
  
  const { category, subject, message, email } = req.body;
  
  // 필수 필드 검증
  if (!category || !subject || !message) {
    return res.status(400).json({ success: false, message: '필수 정보가 누락되었습니다.' });
  }
  
  // 문의 데이터 구성
  const contactData = {
    userId: req.session.user.id,
    username: req.session.user.username,
    email: email || req.session.user.email,
    category,
    subject,
    message,
    status: 'pending', // 처리 상태 (pending, in-progress, resolved)
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // 문의 저장
  if (saveContact(contactData)) {
    res.status(200).json({ success: true, message: '문의가 성공적으로 접수되었습니다.' });
  } else {
    res.status(500).json({ success: false, message: '문의 저장 중 오류가 발생했습니다.' });
  }
});

// 관리자용 문의 목록 조회 API
router.get('/admin/list', (req, res) => {
  try {
    // 세션 확인
    if (!req.session || !req.session.user) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }
    
    // 사용자 정보 확인
    const userId = req.session.user.id;
    const USERS_FILE = path.join(__dirname, '../data/users.json');
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const user = users.find(u => u.id === userId);
    
    // 관리자 권한 확인
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
    }
    
    initContactDataFile();
    
    // 문의 데이터 읽기
    const data = JSON.parse(fs.readFileSync(CONTACT_DATA_PATH, 'utf8'));
    
    // 최신순으로 정렬
    const sortedContacts = data.contacts.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    res.status(200).json({ success: true, data: sortedContacts });
  } catch (error) {
    console.error('문의 목록 조회 오류:', error);
    res.status(500).json({ success: false, message: '문의 목록을 불러오는 중 오류가 발생했습니다.' });
  }
});

// 관리자용 문의 상세 조회 API
router.get('/admin/detail/:id', (req, res) => {
  try {
    // 세션 확인
    if (!req.session || !req.session.user) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }
    
    // 사용자 정보 확인
    const userId = req.session.user.id;
    const USERS_FILE = path.join(__dirname, '../data/users.json');
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const user = users.find(u => u.id === userId);
    
    // 관리자 권한 확인
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
    }
  
    const contactId = req.params.id;
    
    // 문의 데이터 읽기
    const data = JSON.parse(fs.readFileSync(CONTACT_DATA_PATH, 'utf8'));
    
    // ID로 문의 찾기
    const contact = data.contacts.find(c => c.id === contactId);
    
    if (!contact) {
      return res.status(404).json({ success: false, message: '해당 문의를 찾을 수 없습니다.' });
    }
    
    res.status(200).json({ success: true, data: contact });
  } catch (error) {
    console.error('문의 상세 조회 오류:', error);
    res.status(500).json({ success: false, message: '문의 상세 정보를 불러오는 중 오류가 발생했습니다.' });
  }
});

// 관리자용 문의 상태 업데이트 API
router.put('/admin/update/:id', (req, res) => {
  try {
    // 세션 확인
    if (!req.session || !req.session.user) {
      return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }
    
    // 사용자 정보 확인
    const userId = req.session.user.id;
    const USERS_FILE = path.join(__dirname, '../data/users.json');
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const user = users.find(u => u.id === userId);
    
    // 관리자 권한 확인
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
    }
  
    const contactId = req.params.id;
    const { status, adminComment } = req.body;
    
    // 문의 데이터 읽기
    const data = JSON.parse(fs.readFileSync(CONTACT_DATA_PATH, 'utf8'));
    
    // ID로 문의 찾기
    const contactIndex = data.contacts.findIndex(c => c.id === contactId);
    
    if (contactIndex === -1) {
      return res.status(404).json({ success: false, message: '해당 문의를 찾을 수 없습니다.' });
    }
    
    // 문의 상태 업데이트
    data.contacts[contactIndex] = {
      ...data.contacts[contactIndex],
      status: status || data.contacts[contactIndex].status,
      adminComment: adminComment || data.contacts[contactIndex].adminComment,
      updatedAt: new Date().toISOString()
    };
    
    // 파일에 저장
    fs.writeFileSync(CONTACT_DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
    
    res.status(200).json({ success: true, message: '문의 상태가 업데이트되었습니다.' });
  } catch (error) {
    console.error('문의 상태 업데이트 오류:', error);
    res.status(500).json({ success: false, message: '문의 상태 업데이트 중 오류가 발생했습니다.' });
  }
});

module.exports = router;