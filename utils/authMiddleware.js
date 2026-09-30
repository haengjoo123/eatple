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

async function establishSession(req, user) {
  await new Promise((resolve, reject) => {
    req.session.regenerate(error => error ? reject(error) : resolve());
  });
  req.session.user = user;
  await new Promise((resolve, reject) => {
    req.session.save(error => error ? reject(error) : resolve());
  });
}

module.exports = { requireLogin, adminAuth, establishSession };
