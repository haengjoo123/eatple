const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadClass(file, name, fetch) {
    const context = {
        document: { readyState: 'loading', addEventListener() {} },
        URLSearchParams, AbortController, fetch,
        console: { error() {}, log() {}, warn() {} }
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8') + `\nthis.ReviewClass = ${name};`, context);
    return Object.create(context.ReviewClass.prototype);
}

test('the latest filter loads immediately and a delayed older response cannot replace it', async () => {
    const requests = [];
    const fetch = jest.fn((url, options) => new Promise(resolve => requests.push({ url, options, resolve })));
    const manager = loadClass('nutrition-info.js', 'NutritionInfoManager', fetch);
    Object.assign(manager, { currentPage: 1, itemsPerPage: 12, currentFilters: {}, currentSort: 'collectedDate', currentSortOrder: 'desc' });
    manager.showLoading = jest.fn(); manager.showError = jest.fn(); manager.renderNutritionInfo = jest.fn();
    const old = manager.loadNutritionInfo();
    manager.currentFilters.category = 'sleep';
    const current = manager.loadNutritionInfo();
    expect(requests).toHaveLength(2);
    expect(requests[0].options.signal.aborted).toBe(true);
    expect(requests[1].url).toContain('category=sleep');
    requests[1].resolve({ ok: true, json: async () => ({ success: true, data: [{ id: 'latest' }], pagination: {} }) });
    await current;
    requests[0].resolve({ ok: true, json: async () => ({ success: true, data: [{ id: 'old' }], pagination: {} }) });
    await old;
    expect(manager.renderNutritionInfo).toHaveBeenCalledTimes(1);
    expect(manager.renderNutritionInfo.mock.calls[0][0][0].id).toBe('latest');
    expect(manager.isLoading).toBe(false);
    expect(manager.showError).not.toHaveBeenCalled();
});

test('a withdrawn post is not displayed from a saved client cache', async () => {
    const fetch = jest.fn(async () => ({ ok: false, status: 404 }));
    const manager = loadClass('nutrition-info-detail.js', 'NutritionInfoDetailManager', fetch);
    manager.nutritionInfoId = 'hidden';
    manager.nutritionInfo = { title: 'Previously public' };
    manager.readCache = jest.fn(() => ({ data: { title: 'Cached hidden content' } }));
    manager.showLoading = jest.fn(); manager.showError = jest.fn(); manager.renderProgressively = jest.fn();
    await manager.loadNutritionInfoFallback();
    expect(manager.readCache).not.toHaveBeenCalled();
    expect(manager.renderProgressively).not.toHaveBeenCalled();
    expect(manager.nutritionInfo).toBeNull();
    expect(manager.showError).toHaveBeenCalled();
    expect(fetch.mock.calls[0][1].cache).toBe('no-store');
});
