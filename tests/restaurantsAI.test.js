const express = require('express');
const request = require('supertest');
const axios = require('axios');
jest.mock('axios');
jest.mock('../utils/openaiClient', () => ({ generateText: jest.fn() }));
jest.mock('../utils/serviceUsageTracker', () => ({ incrementServiceUsage: jest.fn(), SERVICE_TYPES: {} }));
const { generateText } = require('../utils/openaiClient');
const originalKakaoKey = process.env.KAKAO_REST_API_KEY;
const originalGoogleKey = process.env.GOOGLE_PLACES_API_KEY;
process.env.KAKAO_REST_API_KEY = 'test-restaurant-key';
delete process.env.GOOGLE_PLACES_API_KEY;
const app = express();
app.use(express.json());
app.use('/restaurants', require('../routes/restaurants'));
const original = { id: 'place-1', place_name: '한글 식당', address_name: '서울 실제 주소', category_name: '한식', distance: '120', phone: '02-123', x: '127', y: '37' };
beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: { documents: [original], meta: { is_end: true } } });
});
beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
    jest.restoreAllMocks();
    if (originalKakaoKey === undefined) delete process.env.KAKAO_REST_API_KEY;
    else process.env.KAKAO_REST_API_KEY = originalKakaoKey;
    if (originalGoogleKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = originalGoogleKey;
});
const choice = candidateId => ({ candidateId, reason: '#선호음식', recommendedMenus: [{ name: '비빔밥 (예시)', price: '정보 없음' }], healthConsiderations: '알레르기는 매장 확인 필요', score: 85 });
test('maps stable candidate IDs to authoritative place details and preserves Korean', async () => {
    generateText.mockResolvedValue({ text: JSON.stringify({ reason: '#개인화', recommendations: [choice('0')] }) });
    const response = await request(app).post('/restaurants/recommend').send({ userProfile: {}, requirements: {} });
    expect(response.status).toBe(200);
    expect(response.body.recommendations[0]).toMatchObject({ name: original.place_name, address: original.address_name, phone: original.phone, googleRating: null, reason: '#선호음식' });
    expect(generateText.mock.lastCall[1]).toMatchObject({ schemaName: 'restaurants' });
});
test.each([{ ids: ['unknown'] }, { ids: ['0', '0'] }])('rejects unknown or duplicate candidate IDs $ids', async ({ ids }) => {
    generateText.mockResolvedValue({ text: JSON.stringify({ reason: '#개인화', recommendations: ids.map(choice) }) });
    const response = await request(app).post('/restaurants/recommend').send({ userProfile: {}, requirements: {} });
    expect(response.status).toBe(200);
    expect(response.body.recommendations).toHaveLength(1);
    expect(response.body.recommendations[0].place_name).toBe(original.place_name);
    expect(response.body.recommendations[0]).not.toHaveProperty('recommendedMenus');
});
