const express = require('express');
const session = require('express-session');
const http = require('http');
const WebSocket = require('ws');
const request = require('supertest');
const { createMonitoringWebSocket } = require('../utils/monitoringWebSocket');

let server;
let wss;
beforeEach(async () => {
    const app = express();
    const middleware = session({ secret: 'test-only-secret', resave: false, saveUninitialized: false });
    app.use(middleware);
    app.get('/test-session/:role', (req, res) => {
        req.session.user = { id: 'test-user', role: req.params.role };
        res.json({ ok: true });
    });
    server = http.createServer(app);
    wss = createMonitoringWebSocket(server, middleware, origin => !origin || origin === 'http://localhost');
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
});
afterEach(async () => {
    for (const client of wss.clients) client.terminate();
    await new Promise(resolve => wss.close(resolve));
    await new Promise(resolve => server.close(resolve));
});

function connect(cookie, origin = 'http://localhost') {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}/monitoring-ws`, {
            headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}) }
        });
        ws.once('open', () => { ws.close(); resolve(101); });
        ws.once('unexpected-response', (req, res) => { res.resume(); ws.terminate(); resolve(res.statusCode); });
        ws.on('error', reject);
    });
}

test('anonymous users cannot subscribe to system monitoring', async () => {
    expect(await connect()).toBe(403);
});
test.each(['user', 'admin'])('monitoring authorizes a %s session', async role => {
    const response = await request(server).get(`/test-session/${role}`);
    const cookie = response.headers['set-cookie'][0].split(';')[0];
    expect(await connect(cookie)).toBe(role === 'admin' ? 101 : 403);
});
test('an admin cookie cannot be used from another website', async () => {
    const response = await request(server).get('/test-session/admin');
    const cookie = response.headers['set-cookie'][0].split(';')[0];
    expect(await connect(cookie, 'https://attacker.test')).toBe(403);
});
