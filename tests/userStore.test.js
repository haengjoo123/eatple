const fs = require('fs');
const os = require('os');
const path = require('path');
const { readUsers, writeUsers } = require('../utils/userStore');
let directory;
let file;

beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meal-plan-store-'));
    file = path.join(directory, 'users.json');
});
afterEach(() => {
    jest.restoreAllMocks();
    for (const entry of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, entry));
    fs.rmdirSync(directory);
});

test('reads fresh data after another service updates the same user', () => {
    writeUsers([{ id: 'one', profile: { age: 30 } }], file);
    const firstRead = readUsers(file);
    writeUsers([{ id: 'one', profile: { age: 31 }, gamePoints: { totalPoints: 500 } }], file);
    expect(readUsers(file)[0].gamePoints.totalPoints).toBe(500);
    expect(firstRead[0].profile.age).toBe(30);
});

test('supports the original keyed users format', () => {
    fs.writeFileSync(file, JSON.stringify({ users: { one: { id: 'one' } } }));
    expect(readUsers(file)).toEqual([{ id: 'one' }]);
});

test.each(['', '{', 'null', '{}', '[null]'])('rejects corrupt data %p instead of replacing it with an empty list', content => {
    fs.writeFileSync(file, content);
    expect(() => readUsers(file)).toThrow();
    expect(fs.readFileSync(file, 'utf8')).toBe(content);
});

test('failed replacement preserves the old file and removes its temporary file', () => {
    writeUsers([{ id: 'one' }], file);
    jest.spyOn(fs, 'renameSync').mockImplementation(() => { throw new Error('disk failure'); });
    expect(() => writeUsers([{ id: 'two' }], file)).toThrow('disk failure');
    expect(readUsers(file)).toEqual([{ id: 'one' }]);
    expect(fs.readdirSync(directory)).toEqual(['users.json']);
});
