jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
jest.mock('../utils/supabaseImageManager', () => jest.fn());
jest.mock('../utils/permanentStorageManager', () => jest.fn());

const express = require('express');
const request = require('supertest');
const Manager = require('../utils/supabaseNutritionDataManager');
const routerFactory = require('../routes/nutrition-info');
const Recommendation = require('../utils/nutritionRecommendationService');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createNutritionDatabase } = require('./helpers/nutritionDatabase');

let manager, app, recommendation;
const posts = [
    { id: 'one', title: 'sleep one', summary: 'first', content: '<p>First</p>', source_type: 'manual', is_active: true, is_draft: false, view_count: 0, like_count: 9, bookmark_count: 7, category_id: 'category-sleep', collected_date: '2026-10-01', categories: { name: 'sleep' } },
    { id: 'two', title: 'sleep two', summary: 'second', content: '<p>Second</p>', source_type: 'manual', is_active: true, is_draft: false, view_count: 0, like_count: 0, bookmark_count: 0, category_id: 'category-brain', collected_date: '2026-10-01', categories: { name: 'brain_health' } },
    { id: 'draft', title: 'secret draft', content: '<p>Secret</p>', is_active: true, is_draft: true, category_id: 'category-sleep' },
    { id: 'hidden', title: 'hidden', content: '<p>Hidden</p>', is_active: false, is_draft: false, category_id: 'category-sleep' }
];
function mount(router, prefix = '/api/nutrition-info') {
    const server = express();
    server.use(express.json());
    server.use((req, res, next) => { req.session = { user: req.headers['x-user'] ? { id: req.headers['x-user'], role: 'admin' } : null }; next(); });
    server.use(prefix, router);
    return server;
}
beforeEach(() => {
    manager = Object.create(Manager.prototype);
    manager.supabase = createNutritionDatabase(posts);
    recommendation = {
        getUserPreferences: jest.fn(async () => ({ interactions: { bookmarks: ['one', 'draft', 'hidden'], likes: [] } })),
        recordUserInteraction: jest.fn(async () => ({})), removeUserInteraction: jest.fn(async () => ({})),
        getRecommendedNutritionInfo: jest.fn(async user => [{ id: `recommendation-${user}` }])
    };
    app = mount(routerFactory(manager, null, null, recommendation));
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test.each(['draft', 'hidden', 'missing'])("blocks %s on detail, interaction and stream endpoints", async id => {
    for (const suffix of ['', '/interaction-status', '/stream']) {
        const response = await request(app).get(`/api/nutrition-info/${id}${suffix}`);
        expect(response.status).toBe(404);
        expect(response.text).not.toContain('<p>Secret</p>');
    }
    for (const action of ['bookmark', 'like']) {
        expect((await request(app).post(`/api/nutrition-info/${action}`).set('x-user', 'user').send({ nutritionInfoId: id, action: 'add' })).status).toBe(404);
    }
});

test('public list, recommendations and bookmarks contain only published active posts', async () => {
    const list = await request(app).get('/api/nutrition-info');
    expect(list.body.data.map(item => item.id)).toEqual(['one', 'two']);
    const detail = await request(app).get('/api/nutrition-info/one');
    expect(detail.body.recommended.map(item => item.id)).toEqual(['two']);
    const bookmarks = await request(app).get('/api/nutrition-info/bookmarks').set('x-user', 'user');
    expect(bookmarks.body.data.map(item => item.id)).toEqual(['one']);
    const count = await request(app).get('/api/nutrition-info/bookmarks/count').set('x-user', 'user');
    expect(count.body.count).toBe(1);
});

test('list ETags differ across pages and matching ETags return 304', async () => {
    const first = await request(app).get('/api/nutrition-info?page=1&limit=1');
    const second = await request(app).get('/api/nutrition-info?page=2&limit=1').set('If-None-Match', first.headers.etag);
    expect(second.status).toBe(200);
    expect(second.headers.etag).not.toBe(first.headers.etag);
    expect(second.body.data[0].id).toBe('two');
    expect((await request(app).get('/api/nutrition-info?page=1&limit=1').set('If-None-Match', first.headers.etag)).status).toBe(304);
    expect(first.headers['cache-control']).toBe('public, no-cache');
});

test('detail updates and personalized responses do not share an ETag or public cache', async () => {
    manager.incrementViewCount = jest.fn(async () => {});
    const first = await request(app).get('/api/nutrition-info/one').set('x-user', 'a');
    const otherUser = await request(app).get('/api/nutrition-info/one').set('x-user', 'b').set('If-None-Match', first.headers.etag);
    expect(otherUser.status).toBe(200);
    expect(otherUser.headers.etag).not.toBe(first.headers.etag);
    expect(otherUser.headers['cache-control']).toBe('private, no-store');
    manager.supabase.tables.nutrition_posts[0].content = '<p>Edited</p>';
    const edited = await request(app).get('/api/nutrition-info/one').set('x-user', 'a').set('If-None-Match', first.headers.etag);
    expect(edited.status).toBe(200);
    expect(edited.body.data.content).toBe('<p>Edited</p>');
});

test.each(['GET', 'POST'])('%s search preserves pagination', async method => {
    const response = method === 'GET'
        ? await request(app).get('/api/nutrition-info/search?q=sleep&page=2&limit=1')
        : await request(app).post('/api/nutrition-info/search').send({ query: 'sleep', page: 2, limit: 1 });
    expect(response.body.data.map(item => item.id)).toEqual(['two']);
    expect(response.body.pagination).toMatchObject({ page: 2, limit: 1 });
});

test('counts and draft status survive both list and detail conversion', async () => {
    const list = await manager.getNutritionInfoList({ includeInactive: true });
    expect(list.data.find(item => item.id === 'draft').toJSON().isDraft).toBe(true);
    const detail = await manager.getNutritionInfoById('one');
    expect(detail.toJSON()).toMatchObject({ likeCount: 9, bookmarkCount: 7, categoryId: 'category-sleep' });
    expect(list.data[0].toJSON()).toMatchObject({ likeCount: 9, bookmarkCount: 7 });
    expect(await manager.getNutritionInfoById('missing')).toBeNull();
});

test('conditional updates retain concurrent counter increments and clamp removals', async () => {
    await Promise.all(Array.from({ length: 5 }, () => manager.adjustInteractionCount('one', 'bookmarks', 1)));
    expect(manager.supabase.tables.nutrition_posts[0].bookmark_count).toBe(12);
    expect(await manager.adjustInteractionCount('two', 'likes', -1)).toEqual({ previous: 0, current: 0 });
});

test('bookmark HTTP requests persist unique users and update each count once', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nutrition-api-'));
    try {
        const service = new Recommendation(manager);
        service.userPreferencesFile = path.join(directory, 'preferences.json');
        const server = mount(routerFactory(manager, null, null, service));
        const add = user => request(server).post('/api/nutrition-info/bookmark').set('x-user', user).send({ nutritionInfoId: 'one', action: 'add' });
        const results = await Promise.all([add('a'), add('a'), add('b')]);
        expect(results.every(result => result.status === 200)).toBe(true);
        expect(manager.supabase.tables.nutrition_posts[0].bookmark_count).toBe(9);
        for (const user of ['a', 'b']) {
            const status = await request(server).get('/api/nutrition-info/one/interaction-status').set('x-user', user);
            expect(status.body.data.isBookmarked).toBe(true);
        }
        await request(server).post('/api/nutrition-info/bookmark').set('x-user', 'a').send({ nutritionInfoId: 'one', action: 'remove' });
        expect(manager.supabase.tables.nutrition_posts[0].bookmark_count).toBe(8);
    } finally {
        for (const name of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, name));
        fs.rmdirSync(directory);
    }
});

test('administrator filters can retrieve hidden posts, drafts and category names or IDs', async () => {
    jest.spyOn(Manager, 'getSupabaseNutritionDataManager').mockImplementation(() => manager);
    const admin = mount(require('../routes/admin-manual-posting'), '/admin');
    const get = url => request(admin).get(url).set('x-user', 'admin');
    const all = await get('/admin/posts');
    expect(all.body.data.posts.map(item => item.id)).toEqual(['one', 'two', 'draft', 'hidden']);
    expect((await get('/admin/posts?status=inactive')).body.data.posts.map(item => item.id)).toEqual(['hidden']);
    const drafts = await get('/admin/posts?status=draft');
    expect(drafts.body.data.posts).toHaveLength(1);
    expect(drafts.body.data.posts[0]).toMatchObject({ id: 'draft', is_draft: true, status: 'draft' });
    expect((await get('/admin/posts?status=published&category=sleep')).body.data.posts.map(item => item.id)).toEqual(['one']);
    expect((await get('/admin/posts?categoryId=category-brain')).body.data.posts.map(item => item.id)).toEqual(['two']);
    expect((await get('/admin/posts/draft')).body.data.is_draft).toBe(true);
});
