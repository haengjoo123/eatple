const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const USERS_FILE = path.join(__dirname, '../data/users.json');

// Read fresh data: a cached whole-file snapshot can overwrite newer profile or point updates.
function readUsers(filePath = USERS_FILE) {
    let content;
    try {
        content = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }

    const parsed = JSON.parse(content);
    const users = Array.isArray(parsed) ? parsed
        : parsed && parsed.users && typeof parsed.users === 'object'
            ? Object.values(parsed.users) : null;
    if (!users || users.some(user => !user || typeof user !== 'object' || Array.isArray(user))) {
        throw new Error('사용자 데이터 형식이 올바르지 않습니다.');
    }
    return users;
}

// Replace the file only after the complete JSON has been written successfully.
function writeUsers(users, filePath = USERS_FILE) {
    if (!Array.isArray(users)) throw new TypeError('사용자 목록은 배열이어야 합니다.');
    const contents = JSON.stringify(users, null, 2);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryFile = `${filePath}.${randomUUID()}.tmp`;
    try {
        fs.writeFileSync(temporaryFile, contents, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
        fs.renameSync(temporaryFile, filePath);
    } finally {
        if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
    }
}

module.exports = { readUsers, writeUsers };
