const { getSessionConfig, createOriginChecker } = require('../utils/httpSecurity');

test('production requires a secret and sets a secure host-only cookie by default', () => {
    expect(() => getSessionConfig({ NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/);
    const config = getSessionConfig({ NODE_ENV: 'production', SESSION_SECRET: 'test-secret' });
    expect(config.cookie).toMatchObject({ secure: true, httpOnly: true, sameSite: 'lax' });
    expect(config.cookie.domain).toBeUndefined();
});

test('an optional cookie domain is used only when configured', () => {
    expect(getSessionConfig({ SESSION_COOKIE_DOMAIN: '.example.test' }).cookie.domain).toBe('.example.test');
});

test('only explicit production origins can make credentialed requests', () => {
    const allowed = createOriginChecker({ NODE_ENV: 'production', FRONTEND_URL: 'https://frontend.example.test/path' });
    expect(allowed('https://eatple.net')).toBe(true);
    expect(allowed('https://frontend.example.test')).toBe(true);
    expect(allowed(undefined)).toBe(true);
    expect(allowed('https://someone-else.onrender.com')).toBe(false);
    expect(allowed('https://eatple.net.attacker.test')).toBe(false);
    expect(allowed('http://localhost:3000')).toBe(false);
    expect(allowed('null')).toBe(false);
});

test('development allows local ports without allowing arbitrary websites', () => {
    const allowed = createOriginChecker({});
    expect(allowed('http://localhost:43210')).toBe(true);
    expect(allowed('http://127.0.0.1:43210')).toBe(true);
    expect(allowed('https://attacker.test')).toBe(false);
});
