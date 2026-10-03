// In-memory Supabase contract double: conditional updates are applied atomically.
function createNutritionDatabase(posts) {
    const tables = {
        nutrition_posts: structuredClone(posts),
        categories: [{ id: 'category-sleep', name: 'sleep' }, { id: 'category-brain', name: 'brain_health' }],
        post_tags: [], post_related_products: [], nutrition_post_views: []
    };
    const calls = [];
    const client = { tables, calls, from(table) {
        const conditions = [];
        let update, inserted, range, head = false;
        const builder = {
            select(columns, options = {}) { head = options.head === true; return builder; },
            eq(key, value) { conditions.push(row => row[key] === value); return builder; },
            is(key, value) { conditions.push(row => row[key] == value); return builder; },
            in(key, values) { conditions.push(row => values.includes(row[key])); return builder; },
            gte(key, value) { conditions.push(row => row[key] >= value); return builder; },
            lte(key, value) { conditions.push(row => row[key] <= value); return builder; },
            or(expression) {
                const match = /title\.ilike\.%(.*?)%,summary/.exec(expression);
                const term = match?.[1] || '';
                conditions.push(row => `${row.title} ${row.summary}`.toLowerCase().includes(term));
                return builder;
            },
            order() { return builder; },
            range(start, end) { range = [start, end]; return builder; },
            limit(limit) { range = [0, limit - 1]; return builder; },
            update(data) { update = data; return builder; },
            insert(data) { inserted = data; return builder; },
            maybeSingle() { return execute(true); },
            single() { return execute(true); },
            then(resolve, reject) { return execute(false).then(resolve, reject); }
        };
        async function execute(single) {
            await Promise.resolve();
            if (inserted) {
                const rows = Array.isArray(inserted) ? inserted : [inserted];
                tables[table].push(...structuredClone(rows));
                return { data: single ? rows[0] : rows, error: null };
            }
            let rows = tables[table].filter(row => conditions.every(condition => condition(row)));
            const count = rows.length;
            if (update) rows.forEach(row => Object.assign(row, update));
            if (range) rows = rows.slice(range[0], range[1] + 1);
            calls.push({ table, update, range });
            const data = structuredClone(rows);
            return { data: head ? null : single ? data[0] || null : data, count, error: null };
        }
        return builder;
    } };
    return client;
}
module.exports = { createNutritionDatabase };
