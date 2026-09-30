const express = require('express');
const request = require('supertest');
const session = require('express-session');

jest.mock('../utils/userStore', () => ({
    readUsers: jest.fn(), writeUsers: jest.fn()
}));
jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn()
}));
const { readUsers, writeUsers } = require('../utils/userStore');
const { createClient } = require('@supabase/supabase-js');

function mockClient() {
    const query = {};
    for (const method of ['select', 'delete']) query[method] = jest.fn(() => query);
    query.order = jest.fn(async () => ({ data: [], error: null }));
    query.eq = jest.fn(async () => ({ error: null }));
    query.insert = jest.fn(async () => ({ error: null }));
    return {
        from: jest.fn(() => query),
        auth: {
            signInWithPassword: jest.fn(async ({ email }) => ({ data: {
                user: { id: email.split('@')[0], email, email_confirmed_at: '2026-01-01' }
            }, error: null })),
            updateUser: jest.fn(async () => ({ error: null })),
            signOut: jest.fn(async () => ({ error: null }))
        }
    };
}

let authRouter;
let databaseClient;
let users;
beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    createClient.mockImplementation(mockClient);
    authRouter = require('../routes/auth');
    databaseClient = createClient.mock.results[0].value;
});
beforeEach(() => {
    users = [];
    readUsers.mockImplementation(() => structuredClone(users));
    writeUsers.mockImplementation(next => { users = structuredClone(next); });
    databaseClient.from.mockClear();
    databaseClient.auth.signInWithPassword.mockClear();
    databaseClient.auth.signOut.mockClear();
});
afterAll(() => jest.restoreAllMocks());

function createApp(user) {
    const app = express();
    app.use(express.json());
    app.use(session({ name: 'mealplan_session', secret: 'test-only-secret', resave: false, saveUninitialized: false }));
    app.use((req, res, next) => { if (user) req.session.user = user; next(); });
    app.get('/test-session', (req, res) => { req.session.marker = true; res.json({ ok: true }); });
    app.use('/api/auth', authRouter);
    app.use('/api/admin', authRouter);
    return app;
}

test.each(['/api/auth/users', '/api/admin/users'])(
    '%s rejects anonymous and regular users before reading or deleting accounts', async url => {
        for (const user of [undefined, { id: 'regular-user', role: 'user' }]) {
            const app = createApp(user);
            expect((await request(app).get(url)).status).toBe(403);
            expect((await request(app).delete(`${url}/test-user`)).status).toBe(403);
        }
        expect(databaseClient.from).not.toHaveBeenCalled();
    }
);

test('an administrator can still list accounts', async () => {
    expect((await request(createApp({ id: 'admin', role: 'admin' })).get('/api/admin/users')).status).toBe(200);
    expect(databaseClient.from).toHaveBeenCalledWith('users');
});

test('separate sign-ins keep their Supabase clients and Express sessions isolated', async () => {
    const app = createApp();
    const alice = request.agent(app);
    const bob = request.agent(app);
    const previous = await alice.get('/test-session');
    const [a, b] = await Promise.all([
        alice.post('/api/auth/login').send({ email: 'alice@example.test', password: 'password1' }),
        bob.post('/api/auth/login').send({ email: 'bob@example.test', password: 'password2' })
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.headers['set-cookie'][0].split(';')[0]).not.toBe(previous.headers['set-cookie'][0].split(';')[0]);
    expect(databaseClient.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(users.map(user => user.id).sort()).toEqual(['alice', 'bob']);
    expect((await alice.get('/api/auth/me')).body.user.id).toBe('alice');
    expect((await bob.get('/api/auth/me')).body.user.id).toBe('bob');
    expect((await alice.post('/api/auth/logout')).status).toBe(200);
    expect(databaseClient.auth.signOut).not.toHaveBeenCalled();
    expect((await bob.get('/api/auth/me')).body.user.id).toBe('bob');
});

test('email login preserves the local ID, profile and point balance of a linked account', async () => {
    users = [{ id: 'local-id', supabaseId: 'alice', email: 'alice@example.test', authType: 'email',
        profile: { age: 30 }, gamePoints: { totalPoints: 500 } }];
    const response = await request(createApp()).post('/api/auth/login').send({ email: 'alice@example.test', password: 'password1' });
    expect(response.status).toBe(200);
    expect(response.body.user.id).toBe('local-id');
    expect(users[0]).toMatchObject({ profile: { age: 30 }, gamePoints: { totalPoints: 500 } });
});

test('email password changes use the authenticated Supabase account', async () => {
    users = [{ id: 'local-id', supabaseId: 'alice', email: 'alice@example.test', authType: 'email' }];
    const response = await request(createApp({ id: 'local-id', authType: 'email' }))
        .post('/api/auth/change-password').send({ currentPassword: 'old-password', newPassword: 'new-password' });
    expect(response.status).toBe(200);
    const client = createClient.mock.results.at(-1).value;
    expect(client.auth.updateUser).toHaveBeenCalledWith({ password: 'new-password' });
    expect(users[0].password).toBeUndefined();
});

test('a different verified Supabase ID cannot change this account password', async () => {
    users = [{ id: 'local-id', supabaseId: 'somebody-else', email: 'alice@example.test', authType: 'email' }];
    const response = await request(createApp({ id: 'local-id', authType: 'email' }))
        .post('/api/auth/change-password').send({ currentPassword: 'old-password', newPassword: 'new-password' });
    expect(response.status).toBe(401);
    expect(createClient.mock.results.at(-1).value.auth.updateUser).not.toHaveBeenCalled();
});
