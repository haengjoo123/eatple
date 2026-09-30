const path = require('path');
const CSVFoodSearch = require('../utils/csvFoodSearch');

const fixture = path.join(__dirname, 'fixtures', 'foods.csv');

describe('CSV food search', () => {
  const search = new CSVFoodSearch(fixture);

  test('ranks and limits partial results while preserving source order for ties', async () => {
    const results = await search.search('닭', { limit: 3, includePartial: false });
    expect(results.map(item => item.식품코드)).toEqual(['1', '4', '2']);
    expect(results[0]).toMatchObject({ 식품명: '닭', 에너지: '100', 단백질: '20' });

    const exact = await search.search('닭', { exactMatch: true });
    expect(exact.map(item => item.식품코드)).toEqual(['1', '4']);
    expect(await search.search('닭', { limit: 0 })).toEqual([]);
  });

  test('finds details by code before the name and manufacturer fallbacks', async () => {
    expect((await search.getDetail('4', '닭 가슴살', '회사A')).식품코드).toBe('4');
    expect((await search.getDetail(null, '닭 가슴살', '회사B')).식품코드).toBe('6');
    expect((await search.getDetail(null, '닭 가슴살')).식품코드).toBe('2');
    expect((await search.getDetail(null, '없는 식품'))).toBeNull();
  });

  test('counts all rows for statistics without keeping them in memory', async () => {
    expect(await search.getStats()).toEqual({
      totalItems: 6,
      categories: { 육류: 4, 가공: 1, 과일: 1 },
      lastUpdated: '2025-01-01'
    });
    expect(await search.getSearchStats('닭')).toEqual({
      keyword: '닭', totalMatches: 5, categories: { 육류: 4, 가공: 1 }
    });
  });

  test('reports a missing CSV instead of hanging', async () => {
    const missing = new CSVFoodSearch(path.join(__dirname, 'fixtures', 'missing.csv'));
    await expect(missing.search('닭')).rejects.toThrow();
  });
});
