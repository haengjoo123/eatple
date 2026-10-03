const { createClient } = require('@supabase/supabase-js');
const Manager = require('../utils/supabaseNutritionDataManager');

test('the real Supabase client retries a conditional update that lost a race', async () => {
    let count = 7;
    let conflicted = false;
    const fetch = jest.fn(async (input, options) => {
        const url = new URL(input);
        expect(url.pathname).toBe('/rest/v1/nutrition_posts');
        expect(url.searchParams.get('id')).toBe('eq.post');
        if (options.method === 'GET') {
            return new Response(JSON.stringify([{ bookmark_count: count }]), { status: 200 });
        }
        expect(options.method).toBe('PATCH');
        expect(url.searchParams.get('select')).toBe('bookmark_count');
        const expected = Number(url.searchParams.get('bookmark_count').slice(3));
        if (!conflicted) {
            count++;
            conflicted = true;
        }
        if (expected !== count) {
            return new Response(JSON.stringify({ code: 'PGRST116', details: 'The result contains 0 rows', message: 'No rows' }), { status: 406 });
        }
        count = JSON.parse(options.body).bookmark_count;
        return new Response(JSON.stringify({ bookmark_count: count }), { status: 200 });
    });
    const manager = Object.create(Manager.prototype);
    manager.supabase = createClient('https://nutrition-test.invalid', 'test-key', {
        global: { fetch }, auth: { persistSession: false, autoRefreshToken: false }
    });
    expect(await manager.adjustInteractionCount('post', 'bookmarks', 1)).toEqual({ previous: 8, current: 9 });
    expect(count).toBe(9);
    expect(fetch).toHaveBeenCalledTimes(4);
});
