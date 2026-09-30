const { randomBytes } = require('crypto');

function getSessionConfig(env = process.env) {
    const production = env.NODE_ENV === 'production';
    if (production && !env.SESSION_SECRET) {
        throw new Error('프로덕션에서는 SESSION_SECRET을 설정해야 합니다.');
    }
    return {
        secret: env.SESSION_SECRET || randomBytes(32).toString('hex'),
        resave: false,
        saveUninitialized: false,
        name: 'mealplan_session',
        rolling: true,
        cookie: {
            httpOnly: true,
            secure: production,
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000,
            ...(env.SESSION_COOKIE_DOMAIN ? { domain: env.SESSION_COOKIE_DOMAIN } : {})
        }
    };
}

function createOriginChecker(env = process.env) {
    const allowed = new Set([
        'https://eatple.onrender.com', 'https://eatple.net', 'https://www.eatple.net',
        ...[env.FRONTEND_URL, env.RENDER_EXTERNAL_URL].filter(Boolean).map(value => new URL(value).origin)
    ]);
    return origin => {
        if (!origin || allowed.has(origin)) return true;
        if (env.NODE_ENV !== 'production') {
            try {
                const url = new URL(origin);
                return ['http:', 'https:'].includes(url.protocol) &&
                    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
            } catch { return false; }
        }
        return false;
    };
}

module.exports = { getSessionConfig, createOriginChecker };
