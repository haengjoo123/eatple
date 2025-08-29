function requireLogin(req, res, next) {
  if (req.session && req.session.user) {
    next();
  } else {
    res.status(401).json({ error: '로그인이 필요합니다.' });
  }
}

function adminAuth(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }
}

module.exports = { requireLogin, adminAuth }; 