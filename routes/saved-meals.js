const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const USERS_FILE = path.join(__dirname, '../data/users.json');

function readUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  const data = fs.readFileSync(USERS_FILE, 'utf-8');
  return JSON.parse(data);
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// 저장된 식단 목록 조회
router.get('/', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: '로그인 필요' });
  const users = readUsers();
  const user = users.find(u => u.id === req.session.user.id);
  if (!user) return res.status(404).json({ error: '사용자 없음' });
  if (!user.savedMeals) user.savedMeals = [];
  res.json(user.savedMeals);
});

// 식단 저장
router.post('/', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: '로그인 필요' });
  const users = readUsers();
  const idx = users.findIndex(u => u.id === req.session.user.id);
  if (idx === -1) return res.status(404).json({ error: '사용자 없음' });
  
  if (!users[idx].savedMeals) users[idx].savedMeals = [];
  
  const newMeal = {
    id: Date.now().toString(),
    title: req.body.title || '저장된 식단',
    content: req.body.content,
    savedAt: new Date().toISOString(),
    mealType: req.body.mealType || 'lunch',
    nutrition: req.body.nutrition || {}
  };
  
  users[idx].savedMeals.unshift(newMeal); // 최신 순으로 저장
  // 최대 20개까지만 저장
  if (users[idx].savedMeals.length > 20) {
    users[idx].savedMeals = users[idx].savedMeals.slice(0, 20);
  }
  writeUsers(users);
  res.json({ success: true, meal: newMeal });
});

// 저장된 식단 삭제
router.delete('/:mealId', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: '로그인 필요' });
  const users = readUsers();
  const idx = users.findIndex(u => u.id === req.session.user.id);
  if (idx === -1) return res.status(404).json({ error: '사용자 없음' });
  
  if (!users[idx].savedMeals) users[idx].savedMeals = [];
  
  const mealIndex = users[idx].savedMeals.findIndex(meal => meal.id === req.params.mealId);
  if (mealIndex === -1) return res.status(404).json({ error: '저장된 식단을 찾을 수 없습니다' });
  
  users[idx].savedMeals.splice(mealIndex, 1);
  writeUsers(users);
  res.json({ success: true });
});

module.exports = router; 