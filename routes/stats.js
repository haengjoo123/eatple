const express = require('express');
const router = express.Router();
const { getUserServiceUsage, getAllUsersServiceUsage } = require('../utils/serviceUsageTracker');

// 사용자별 서비스 이용 통계 조회
router.get('/user/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const usage = getUserServiceUsage(userId);
        
        if (!usage) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }
        
        res.json({
            success: true,
            userId,
            serviceUsage: usage
        });
    } catch (error) {
        console.error('사용자 통계 조회 오류:', error);
        res.status(500).json({ error: '통계 조회 중 오류가 발생했습니다.' });
    }
});

// 전체 서비스 이용 통계 조회 (관리자용)
router.get('/all', (req, res) => {
    try {
        const stats = getAllUsersServiceUsage();
        
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('전체 통계 조회 오류:', error);
        res.status(500).json({ error: '통계 조회 중 오류가 발생했습니다.' });
    }
});

// 현재 로그인한 사용자의 서비스 이용 통계 조회
router.get('/my', (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ error: '로그인이 필요합니다.' });
        }
        
        const usage = getUserServiceUsage(req.session.user.id);
        
        res.json({
            success: true,
            userId: req.session.user.id,
            serviceUsage: usage
        });
    } catch (error) {
        console.error('내 통계 조회 오류:', error);
        res.status(500).json({ error: '통계 조회 중 오류가 발생했습니다.' });
    }
});

module.exports = router; 