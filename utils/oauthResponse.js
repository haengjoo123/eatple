function serializeForScript(value) {
    return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, character =>
        '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'));
}

function renderOAuthSuccess(user) {
    const message = serializeForScript({ type: 'social_login_success', user });
    return `<script>
        if (window.opener) {
            window.opener.postMessage(${message}, window.location.origin);
            window.close();
        } else {
            const isSignup = sessionStorage.getItem('socialSignup');
            sessionStorage.removeItem('socialSignup');
            window.location.href = isSignup
                ? '/index?signup=success&provider=' + encodeURIComponent(${serializeForScript(user.authType)})
                : '/index?login=success';
        }
    </script>`;
}

module.exports = { renderOAuthSuccess };
