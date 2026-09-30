const express = require('express');
const request = require('supertest');
jest.mock('../utils/serviceUsageTracker', () => ({
    getUserServiceUsage: jest.fn(() => ({ mealPlan: 2 })),
    getAllUsersServiceUsage: jest.fn(async () => ({ totalUsers: 2 }))
}));
const tracker = require('../utils/serviceUsageTracker');
const router = require('../routes/stats');
function app(user) {
    const app = express();
    app.use((req, res, next) => { req.session = { user }; next(); });
    app.use('/stats', router);
    return app;
}
beforeEach(() => jest.clearAllMocks());

test('private statistics require a session and ownership', async () => {
    expect((await request(app()).get('/stats/user/alice')).status).toBe(401);
    expect((await request(app({ id: 'bob' })).get('/stats/user/alice')).status).toBe(403);
    expect(tracker.getUserServiceUsage).not.toHaveBeenCalled();
    expect((await request(app({ id: 'alice' })).get('/stats/user/alice')).status).toBe(200);
});
test('aggregate statistics require an administrator', async () => {
    expect((await request(app({ id: 'alice' })).get('/stats/all')).status).toBe(403);
    expect(tracker.getAllUsersServiceUsage).not.toHaveBeenCalled();
    expect((await request(app({ id: 'admin', role: 'admin' })).get('/stats/all')).status).toBe(200);
});
