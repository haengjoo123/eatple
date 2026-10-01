const axios = require('axios');
const { generateText } = require('../utils/openaiClient');

jest.mock('axios');

const originalKey = process.env.OPENAI_API_KEY;
const originalModel = process.env.OPENAI_RESPONSES_MODEL;
const completed = content => ({ data: {
    status: 'completed', model: 'gpt-6-luna',
    output: [{ type: 'reasoning', summary: [] }, { type: 'message', role: 'assistant', content }],
} });

beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    delete process.env.OPENAI_RESPONSES_MODEL;
    jest.clearAllMocks();
});
afterAll(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.OPENAI_RESPONSES_MODEL;
    else process.env.OPENAI_RESPONSES_MODEL = originalModel;
});

test('uses Luna Responses without storing prompts, forwards cancellation and combines output text', async () => {
    axios.post.mockResolvedValue(completed([
        { type: 'output_text', text: 'first ' }, { type: 'output_text', text: 'second' },
    ]));
    const signal = new AbortController().signal;
    await expect(generateText('Return JSON.', { signal, json: true })).resolves.toEqual({
        text: 'first second', model: 'gpt-6-luna',
    });
    expect(axios.post).toHaveBeenCalledWith('https://api.openai.com/v1/responses', expect.objectContaining({
        model: 'gpt-6-luna', input: 'Return JSON.', store: false, reasoning: { effort: 'none' },
        text: { format: { type: 'json_object' } },
    }), expect.objectContaining({ signal, timeout: 60000, headers: {
        Authorization: 'Bearer test-key', 'Content-Type': 'application/json',
    } }));
});

test.each([
    [{ status: 'incomplete', output: [] }, 'INCOMPLETE_RESPONSE'],
    [completed([{ type: 'refusal', refusal: 'No.' }]).data, 'RESPONSE_REFUSED'],
    [completed([]).data, 'EMPTY_RESPONSE'],
])('rejects incomplete, refused and empty responses', async (data, code) => {
    axios.post.mockResolvedValue({ data });
    await expect(generateText('Analyze food')).rejects.toMatchObject({ code, status: 502 });
});

test('missing credentials fail explicitly before any network request', async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(generateText('Analyze food')).rejects.toMatchObject({ code: 'AI_NOT_CONFIGURED', status: 503 });
    expect(axios.post).not.toHaveBeenCalled();
});

test('forwards a strict response schema and trusted instructions separately from user input', async () => {
    const { schemas } = require('../utils/aiContracts');
    axios.post.mockResolvedValue(completed([{ type: 'output_text', text: '{"tags":["칼슘"]}' }]));
    await generateText('user content', { schema: schemas.tags, schemaName: 'tags', instructions: 'trusted rules' });
    expect(axios.post.mock.lastCall[1]).toMatchObject({
        input: 'user content', instructions: 'trusted rules',
        text: { format: { type: 'json_schema', name: 'tags', strict: true, schema: schemas.tags } },
    });
});

test.each([
    [{ response: { status: 429, data: { error: 'private prompt' } } }, 429, 'AI_RATE_LIMITED'],
    [{ response: { status: 401, data: { error: 'secret credential' } } }, 502, 'AI_UNAVAILABLE'],
    [{ code: 'ECONNABORTED' }, 504, 'AI_TIMEOUT'],
    [{ code: 'ERR_CANCELED' }, 504, 'AI_TIMEOUT'],
])('maps provider failures without exposing payloads', async (failure, status, code) => {
    axios.post.mockRejectedValue(failure);
    await expect(generateText('Analyze food')).rejects.toMatchObject({ status, code });
    await generateText('Analyze food').catch(error => {
        expect(error.message).not.toMatch(/private prompt|secret credential/);
        expect(error.response).toBeUndefined();
    });
});
