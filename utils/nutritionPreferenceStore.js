const fs = require('fs').promises;
const path = require('path');
const { randomUUID } = require('crypto');

// Shared across service instances; every read/modify/write uses the same queue.
const pendingWrites = new Map();
async function withPreferenceLock(file, operation) {
    const key = path.resolve(file);
    const previous = pendingWrites.get(key) || Promise.resolve();
    const next = previous.catch(() => {}).then(operation);
    pendingWrites.set(key, next);
    try {
        return await next;
    } finally {
        if (pendingWrites.get(key) === next) pendingWrites.delete(key);
    }
}

async function readPreferences(file) {
    let content;
    try {
        content = await fs.readFile(file, 'utf8');
    } catch (error) {
        if (error.code === 'ENOENT') return {};
        throw error;
    }
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('사용자 선호도 데이터 형식이 올바르지 않습니다.');
    }
    return parsed;
}

async function writePreferences(file, preferences) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporaryFile = `${file}.${randomUUID()}.tmp`;
    try {
        await fs.writeFile(temporaryFile, JSON.stringify(preferences, null, 2), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
        await fs.rename(temporaryFile, file);
    } finally {
        await fs.unlink(temporaryFile).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
}

module.exports = { withPreferenceLock, readPreferences, writePreferences };
