const vm = require('vm');
const { renderOAuthSuccess } = require('../utils/oauthResponse');

test('social names are serialized as data without breaking the callback script', () => {
    const user = { id: 'one', name: "O'Neil </script><script>throw new Error('injected')</script>\u2028", authType: 'kakao' };
    const html = renderOAuthSuccess(user);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    const postMessage = jest.fn();
    vm.runInNewContext(html.slice('<script>'.length, -'</script>'.length), {
        window: { opener: { postMessage }, location: { origin: 'https://eatple.net' }, close() {} }
    });
    expect(postMessage).toHaveBeenCalledWith({ type: 'social_login_success', user }, 'https://eatple.net');
});
