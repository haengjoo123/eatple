jest.mock('../utils/openaiClient', () => ({
    generateText: jest.fn(), resolveOpenAIModel: () => 'gpt-6-luna',
}));
const { generateText } = require('../utils/openaiClient');
const OpenAIAnalyzer = require('../utils/openaiAnalyzer');

beforeEach(() => jest.clearAllMocks());

test('more requests than the concurrency limit complete and release their slots', async () => {
    let active = 0;
    let peak = 0;
    generateText.mockImplementation(async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise(resolve => setTimeout(resolve, 5));
        active--;
        return { text: JSON.stringify({ tags: ['칼슘', '비타민D'] }) };
    });
    const analyzer = new OpenAIAnalyzer({ maxConcurrentRequests: 2, rateLimitDelay: 0 });
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => analyzer.generateTags(`nutrition ${i}`)));
    expect(results).toEqual(Array(5).fill(['칼슘', '비타민D']));
    expect(peak).toBeLessThanOrEqual(2);
    expect(analyzer.getPerformanceStats()).toMatchObject({ activeRequests: 0, queueLength: 0 });
});

test('failed requests release their slots and do not enable mock recommendations', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    generateText.mockRejectedValueOnce(Object.assign(new Error('AI not configured'), { code: 'AI_NOT_CONFIGURED', status: 503 }))
        .mockResolvedValueOnce({ text: JSON.stringify({ tags: ['칼슘'] }) });
    const analyzer = new OpenAIAnalyzer({ maxConcurrentRequests: 1, rateLimitDelay: 0 });
    try {
        await expect(analyzer.analyzeNutritionContent('first')).rejects.toThrow('AI not configured');
        await expect(analyzer.generateTags('second')).resolves.toEqual(['칼슘']);
        expect(analyzer.mockMode).toBe(false);
        expect(analyzer.getPerformanceStats().activeRequests).toBe(0);
        expect(require('../utils/geminiAnalyzer')).toBe(OpenAIAnalyzer);
    } finally {
        log.mockRestore();
    }
});
