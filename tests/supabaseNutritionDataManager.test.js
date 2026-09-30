jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({})) }));
jest.mock('../utils/supabaseImageManager', () => jest.fn());

const { createClient } = require('@supabase/supabase-js');
const SupabaseImageManager = require('../utils/supabaseImageManager');
const { getSupabaseNutritionDataManager } = require('../utils/supabaseNutritionDataManager');

test('shares one nutrition manager and image manager across route consumers', () => {
    const previousUrl = process.env.SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
        const first = getSupabaseNutritionDataManager();
        expect(getSupabaseNutritionDataManager()).toBe(first);
        expect(createClient).toHaveBeenCalledTimes(1);
        expect(SupabaseImageManager).toHaveBeenCalledTimes(1);
        expect(first.imageManager).toBeInstanceOf(SupabaseImageManager);
    } finally {
        log.mockRestore();
        if (previousUrl === undefined) delete process.env.SUPABASE_URL;
        else process.env.SUPABASE_URL = previousUrl;
        if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    }
});
