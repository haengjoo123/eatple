const express = require('express');
const request = require('supertest');
jest.mock('../utils/userStore', () => ({ readUsers: jest.fn(), writeUsers: jest.fn() }));
jest.mock('../utils/profileCompletionService', () => ({ checkAndRewardCompletion: jest.fn(() => ({ success: true })) }));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
const { createClient } = require('@supabase/supabase-js');
const { readUsers, writeUsers } = require('../utils/userStore');
let users;
let cloud;
let router;

beforeAll(() => {
    const query = { select: jest.fn(), update: jest.fn(), eq: jest.fn(), single: jest.fn() };
    query.select.mockReturnValue(query);
    query.update.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    cloud = query;
    createClient.mockReturnValue({ from: () => query });
    router = require('../routes/profile');
});
beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    users = [{ id: 'alice', supabaseId: 'cloud-alice', profile: { age: 30 } }];
    readUsers.mockImplementation(() => structuredClone(users));
    writeUsers.mockImplementation(next => { users = structuredClone(next); });
    cloud.update.mockClear();
    cloud.single.mockClear();
    delete cloud.error;
});
afterEach(() => jest.restoreAllMocks());
function app() {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.session = { user: { id: 'alice' } }; next(); });
    app.use('/profile', router);
    return app;
}

test('a saved local profile is not replaced by a stale cloud profile', async () => {
    cloud.single.mockResolvedValue({ data: { profile: { age: 20 } } });
    expect((await request(app()).get('/profile')).body).toEqual({ age: 30 });
    expect(cloud.single).not.toHaveBeenCalled();
});
test('reset clears the cloud and local profile so it cannot reappear on the next read', async () => {
    expect((await request(app()).delete('/profile')).status).toBe(200);
    expect(cloud.update).toHaveBeenCalledWith(expect.objectContaining({ profile: {} }));
    expect((await request(app()).get('/profile')).body).toEqual({});
});
test('a failed cloud reset is reported and preserves the local profile', async () => {
    cloud.error = new Error('cloud unavailable');
    expect((await request(app()).delete('/profile')).status).toBe(500);
    expect(users[0].profile).toEqual({ age: 30 });
});
test('cloud hydration preserves point changes that happened during the network call', async () => {
    delete users[0].profile;
    cloud.single.mockImplementation(async () => {
        users[0].gamePoints = { totalPoints: 500 };
        users.push({ id: 'bob' });
        return { data: { profile: { age: 31 } } };
    });
    expect((await request(app()).get('/profile')).body).toEqual({ age: 31 });
    expect(users[0].gamePoints.totalPoints).toBe(500);
    expect(users[1].id).toBe('bob');
});

test('a failed cloud save preserves the new local profile and reports synchronization status', async () => {
    cloud.error = new Error('cloud unavailable');
    const response = await request(app()).post('/profile').send({ age: 31 });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ profileSaved: true, cloudSynced: false });
    expect((await request(app()).get('/profile')).body).toEqual({ age: 31 });
});
