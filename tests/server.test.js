const { result: aiResult } = require('./fixtures/aiResults');
const express = require('express');
const request = require('supertest');
const fs = require('fs');

// Exercise the actual server middleware without starting schedulers, provider calls or data writes.
jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../utils/realtimeMonitoringSystem', () => ({ getRealtimeMonitoring: () => ({}) }));
jest.mock('../utils/memoryMonitor', () => ({ getMemoryMonitor: () => ({}) }));
jest.mock('../utils/supabaseNutritionDataManager', () => ({ getSupabaseNutritionDataManager: () => ({}) }));
jest.mock('../utils/nutritionRecommendationService', () => jest.fn());
jest.mock('../routes/auth', () => {
    const router = require('express').Router();
    router.post('/test-login', (req, res) => {
        req.session.user = { id: 'test-admin', role: 'admin' };
        res.json({ ok: true });
    });
    return router;
});

let app;
let wss;
const originalOpenAIKey = process.env.OPENAI_API_KEY;
function aiResponse(text) {
    return { data: { status: 'completed', model: 'gpt-6-luna', output: [
        { type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] },
    ] } };
}
beforeAll(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    for (const route of ['profile', 'saved-meals', 'supplements', 'restaurants', 'stats', 'contact', 'points',
        'games', 'admin-nutrition-info', 'admin-manual-posting', 'monitoring', 'food-nutrition-external']) {
        jest.doMock(`../routes/${route}`, () => express.Router());
    }
    for (const route of ['nutrition-info', 'rss', 'sitemap']) {
        jest.doMock(`../routes/${route}`, () => () => express.Router());
    }
    ({ app, wss } = require('../server'));
});
afterAll(async () => {
    if (originalOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAIKey;
    await new Promise(resolve => wss.close(resolve));
    require('../utils/cacheManager').memoryCache.close();
    jest.restoreAllMocks();
});

test('HTML links retain query strings and redirect only within this site', async () => {
    const normal = await request(app).get('/login.html?next=profile');
    expect(normal.status).toBe(301);
    expect(normal.headers.location).toBe('/login?next=profile');
    const malicious = await request(app).get('//attacker.test.html');
    expect(malicious.headers.location).toBe('/attacker.test');
});

test('requests from an unrelated website are denied', async () => {
    const response = await request(app).post('/api/auth/test-login').set('Origin', 'https://attacker.test');
    expect(response.status).toBe(403);
});

test('image uploads and operational metadata require admin authentication', async () => {
    expect((await request(app).post('/api/upload-images')).status).toBe(403);
    expect((await request(app).get('/api/env-status')).status).toBe(403);
    expect((await request(app).get('/api/ai-queue/status')).status).toBe(403);
});

test('the admin cache API calls implemented methods and can invalidate an empty cache', async () => {
    const admin = request.agent(app);
    await admin.post('/api/auth/test-login');
    const response = await admin.get('/api/admin/cache-stats');
    expect(response.status).toBe(200);
    expect(response.body.stats).toHaveProperty('totalKeys');
    expect((await admin.post('/api/admin/cache-invalidate').send({ type: 'api' })).body.success).toBe(true);
});

test('invalid uploaded image bytes never fall back to writing a public file', async () => {
    const admin = request.agent(app);
    await admin.post('/api/auth/test-login');
    const writes = jest.spyOn(fs, 'writeFileSync');
    const response = await admin.post('/api/upload-images')
        .attach('images', Buffer.from('<script>invalid image</script>'), { filename: 'fake.jpg', contentType: 'image/jpeg' });
    expect(response.status).toBe(400);
    expect(writes).not.toHaveBeenCalled();
    writes.mockRestore();
});

test('image tooling rejects files outside the upload directory', async () => {
    const admin = request.agent(app);
    await admin.post('/api/auth/test-login');
    const response = await admin.post('/api/admin/optimize-images').send({ inputPath: '../../outside.jpg', outputPath: 'result.jpg' });
    expect(response.status).toBe(500);
    expect(response.body.error).toMatch(/업로드 폴더 밖/);
});

test('ingredient prompts with an identical prefix do not reuse each other\'s AI results', async () => {
    const axios = require('axios');
    const provider = jest.spyOn(axios, 'post')
        .mockResolvedValueOnce(aiResponse(JSON.stringify({ ...aiResult('ingredient'), storage: 'first' })))
        .mockResolvedValueOnce(aiResponse(JSON.stringify({ ...aiResult('ingredient'), storage: 'second' })));
    try {
        const prefix = 'Analyze this ingredient with my preferences: '.repeat(4);
        const first = { ingredient: 'apple', prompt: prefix + 'first preference' };
        const second = { ingredient: 'apple', prompt: prefix + 'second preference' };
        expect((await request(app).post('/api/analyze-ingredient').send(first)).body.result.storage).toBe('first');
        expect((await request(app).post('/api/analyze-ingredient').send(second)).body.result.storage).toBe('second');
        expect((await request(app).post('/api/analyze-ingredient').send(first)).body.result.storage).toBe('first');
        expect(provider).toHaveBeenCalledTimes(2);
        expect(provider.mock.calls[0][2].signal).toBeDefined();
    } finally {
        provider.mockRestore();
    }
});

test.each(['/api/generate-meal-plan', '/api/generate-supplement-recommendation'])(
    '%s returns provider-independent text and caches only a completed answer', async (endpoint) => {
        const provider = jest.spyOn(require('axios'), 'post')
            .mockResolvedValueOnce({ data: { status: 'incomplete', output: [] } })
            .mockResolvedValueOnce(aiResponse(JSON.stringify(aiResult(endpoint.includes('meal-plan') ? 'meal' : 'supplements'))));
        const body = { prompt: `Recommendation for ${endpoint}` };
        try {
            expect((await request(app).post(endpoint).send(body)).status).toBe(502);
            const response = await request(app).post(endpoint).send(body);
            expect(response.status).toBe(200);
            expect(response.body.model).toBe('gpt-6-luna');
            expect(response.body.data).toEqual(aiResult(endpoint.includes('meal-plan') ? 'meal' : 'supplements'));
            expect(typeof response.body.text).toBe('string');
            expect(response.body.candidates[0].content.parts[0].text).toBe(response.body.text);
            expect((await request(app).post(endpoint).send(body)).body).toEqual(response.body);
            expect(provider).toHaveBeenCalledTimes(2);
        } finally {
            provider.mockRestore();
        }
    }
);

test('missing AI credentials return an actionable service error', async () => {
    delete process.env.OPENAI_API_KEY;
    try {
        const response = await request(app).post('/api/generate-meal-plan').send({ prompt: 'No credentials test' });
        expect(response.status).toBe(503);
        expect(response.body.code).toBe('AI_NOT_CONFIGURED');
    } finally {
        process.env.OPENAI_API_KEY = 'test-key';
    }
});

test.each(['/api/generate-meal-plan', '/api/generate-supplement-recommendation', '/api/analyze-ingredient'])(
    '%s still rejects script injection', async (endpoint) => {
        const response = await request(app).post(endpoint).send({ ingredient: 'apple', prompt: '<script>alert(1)</script>' });
        expect(response.status).toBe(400);
    }
);
