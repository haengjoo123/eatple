const { result } = require('./fixtures/aiResults');
const express = require('express');
const request = require('supertest');
const axios = require('axios');

jest.mock('axios');
jest.mock('../utils/serviceUsageTracker', () => ({ incrementServiceUsage: jest.fn(), SERVICE_TYPES: {} }));

const app = express();
app.use(express.json());
app.use('/api/supplements', require('../routes/supplements'));
const originalKey = process.env.OPENAI_API_KEY;

beforeAll(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    jest.restoreAllMocks();
});

function respond(text) {
    axios.post.mockResolvedValue({ data: { status: 'completed', output: [
        { type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] },
    ] } });
}

test('supplement recommendations preserve the frontend contract through OpenAI', async () => {
    const answer = result('supplements');
    respond(JSON.stringify(answer));
    const response = await request(app).post('/api/supplements/recommend').send({ healthGoals: [], profile: {} });
    expect(response.status).toBe(200);
    expect(response.body).toEqual(answer);
    expect(axios.post.mock.lastCall[1]).toMatchObject({ model: 'gpt-6-luna', text: { format: { type: 'json_schema', name: 'supplements', strict: true } } });
    expect(axios.post.mock.lastCall[2].signal).toBeDefined();
});

test.each(['not json', '{}', '{"supplements":"invalid"}'])(
    'invalid AI output returns an error without invented recommendations: %s', async (answer) => {
        respond(answer);
        const response = await request(app).post('/api/supplements/recommend').send({ healthGoals: [] });
        expect(response.status).toBe(502);
        expect(response.body).not.toHaveProperty('supplements');
    }
);
