const { filterProductsByNewOrder } = require('../utils/healthKeywordMatcher');

describe('government-approved supplement search', () => {
  test('respects the requested response limit even without a supplement name', () => {
    const products = Array.from({ length: 600 }, (_, index) => ({ PRDLST_REPORT_NO: String(index) }));

    const results = filterProductsByNewOrder(products, [], null, [], null, { maxResults: 500 });

    expect(results).toHaveLength(500);
    expect(results[0]).toBe(products[0]);
    expect(results[499]).toBe(products[499]);
    expect(products).toHaveLength(600);
  });
});
