const express = require('express');
const router = express.Router();
const PointsService = require('../utils/pointsService');
const { requireLogin } = require('../utils/authMiddleware');

// 일일 한도 정보 반환
router.get('/daily-limit', requireLogin, (req, res) => {
  try {
    const userId = req.session.user.id;
    const pointsInfo = PointsService.getPointsBalance(userId);

    // 자정까지 남은 ms 계산
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 0, 0);
    const timeUntilReset = tomorrow - now;

    res.json({
      dailyLimit: pointsInfo.dailyLimit,
      dailyEarned: pointsInfo.dailyEarned,
      dailyRemaining: pointsInfo.dailyRemaining,
      timeUntilReset
    });
  } catch (error) {
    console.error('일일 한도 정보 조회 오류:', error);
    res.status(500).json({ error: '일일 한도 정보 조회 실패' });
  }
});

// 포인트 잔액 반환
router.get('/balance', (req, res) => {
  try {
    // 로그인하지 않은 사용자는 포인트 0으로 반환
    if (!req.session.user) {
      return res.json({
        success: true,
        balance: 0
      });
    }
    
    const userId = req.session.user.id;
    const pointsInfo = PointsService.getPointsBalance(userId);
    res.json({
      success: true,
      balance: pointsInfo.totalPoints
    });
  } catch (error) {
    console.error('포인트 잔액 조회 오류:', error);
    res.status(500).json({ success: false, error: '포인트 잔액 조회 실패' });
  }
});

// 포인트 내역 조회
router.get('/history', (req, res) => {
  try {
    // 로그인하지 않은 사용자는 빈 배열 반환
    if (!req.session.user) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    const userId = req.session.user.id;
    const history = PointsService.getPointsHistory(userId);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('포인트 내역 조회 오류:', error);
    res.status(500).json({ success: false, error: '포인트 내역 조회 실패' });
  }
});

module.exports = router; 