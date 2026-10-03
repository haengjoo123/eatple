jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
jest.mock('../utils/supabaseImageManager', () => jest.fn());

const fs = require('fs');
const os = require('os');
const path = require('path');
const Recommendation = require('../utils/nutritionRecommendationService');
const Manager = require('../utils/supabaseNutritionDataManager');
const { createNutritionDatabase } = require('./helpers/nutritionDatabase');
const { readPreferences } = require('../utils/nutritionPreferenceStore');
const NutritionInfo = require('../models/NutritionInfo');

let directory, service, manager;
beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nutrition-preferences-'));
    manager = Object.create(Manager.prototype);
    manager.supabase = createNutritionDatabase([{ id: 'post', bookmark_count: 7, like_count: 0 }]);
    service = new Recommendation(manager);
    service.userPreferencesFile = path.join(directory, 'preferences.json');
});
afterEach(() => {
    jest.restoreAllMocks();
    for (const name of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, name));
    fs.rmdirSync(directory);
});

test('concurrent additions across service instances preserve all users and counts', async () => {
    const other = new Recommendation(manager);
    other.userPreferencesFile = service.userPreferencesFile;
    await Promise.all(Array.from({ length: 12 }, (_, index) =>
        (index % 2 ? service : other).recordUserInteraction(`user-${index}`, 'post', 'bookmarks')));
    const stored = await readPreferences(service.userPreferencesFile);
    expect(Object.keys(stored)).toHaveLength(12);
    expect(Object.values(stored).every(user => user.interactions.bookmarks.includes('post'))).toBe(true);
    expect(manager.supabase.tables.nutrition_posts[0].bookmark_count).toBe(19);
});

test.each(['bookmarks', 'likes'])('%s add and remove requests are idempotent', async type => {
    const column = type === 'bookmarks' ? 'bookmark_count' : 'like_count';
    const initial = manager.supabase.tables.nutrition_posts[0][column];
    await Promise.all([service.recordUserInteraction('user', 'post', type), service.recordUserInteraction('user', 'post', type)]);
    expect(manager.supabase.tables.nutrition_posts[0][column]).toBe(initial + 1);
    await Promise.all([service.removeUserInteraction('user', 'post', type), service.removeUserInteraction('user', 'post', type)]);
    expect(manager.supabase.tables.nutrition_posts[0][column]).toBe(initial);
    expect((await service.getUserPreferences('user')).interactions[type]).toEqual([]);
});

test('concurrent preference edits and bookmark writes do not overwrite one another', async () => {
    await Promise.all([
        service.updateUserPreferences('user', { categories: ['sleep'] }),
        service.recordUserInteraction('user', 'post', 'bookmarks')
    ]);
    const user = await service.getUserPreferences('user');
    expect(user.preferences.categories).toEqual(['sleep']);
    expect(user.interactions.bookmarks).toEqual(['post']);
});

test('a failed file replacement preserves previous preferences and restores the counter', async () => {
    await service.updateUserPreferences('existing', { categories: ['sleep'] });
    const previous = fs.readFileSync(service.userPreferencesFile, 'utf8');
    const rename = jest.spyOn(fs.promises, 'rename').mockRejectedValueOnce(new Error('disk failure'));
    await expect(service.recordUserInteraction('user', 'post', 'bookmarks')).rejects.toThrow('disk failure');
    expect(fs.readFileSync(service.userPreferencesFile, 'utf8')).toBe(previous);
    expect(manager.supabase.tables.nutrition_posts[0].bookmark_count).toBe(7);
    expect(fs.readdirSync(directory)).toEqual(['preferences.json']);
    rename.mockRestore();
    await service.recordUserInteraction('user', 'post', 'bookmarks');
    expect(manager.supabase.tables.nutrition_posts[0].bookmark_count).toBe(8);
});

test('counter update failure does not persist the bookmark', async () => {
    manager.adjustInteractionCount = jest.fn().mockRejectedValue(new Error('database unavailable'));
    await expect(service.recordUserInteraction('user', 'post', 'bookmarks')).rejects.toThrow('database unavailable');
    expect(await readPreferences(service.userPreferencesFile)).toEqual({});
});

test('corrupt preferences are reported and preserved instead of overwritten', async () => {
    fs.writeFileSync(service.userPreferencesFile, '{broken');
    await expect(service.recordUserInteraction('user', 'post', 'bookmarks')).rejects.toThrow();
    expect(fs.readFileSync(service.userPreferencesFile, 'utf8')).toBe('{broken');
    expect(manager.supabase.tables.nutrition_posts[0].bookmark_count).toBe(7);
});

test('recommendations use the injected Supabase manager and exclude drafts', async () => {
    manager.getNutritionInfoList = jest.fn(async () => ({ data: [new NutritionInfo({ id: 'current', title: 'Latest', category: 'sleep', sourceType: 'manual', trustScore: 100 })] }));
    const result = await service.getRecommendedNutritionInfo('user', 5);
    expect(manager.getNutritionInfoList).toHaveBeenCalledWith(expect.objectContaining({ isActive: true, excludeDrafts: true }), { limit: 1000 });
    expect(result[0].id).toBe('current');
    expect(service.nutritionDataManager).toBe(manager);
});
