const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Keep only the best requested results. Loading every CSV row into a process-wide
// array used more than 150 MB of heap after a single food search.
function compareCandidates(a, b) {
  if (a.score !== b.score) return a.score - b.score;
  if (a.nameLength !== b.nameLength) return b.nameLength - a.nameLength;
  return b.index - a.index;
}

function addCandidate(heap, candidate, limit) {
  if (heap.length < limit) {
    heap.push(candidate);
    let index = heap.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (compareCandidates(heap[index], heap[parent]) >= 0) break;
      [heap[index], heap[parent]] = [heap[parent], heap[index]];
      index = parent;
    }
    return;
  }

  if (compareCandidates(candidate, heap[0]) <= 0) return;
  heap[0] = candidate;
  let index = 0;
  while (true) {
    const left = index * 2 + 1;
    const right = left + 1;
    let worst = index;
    if (left < heap.length && compareCandidates(heap[left], heap[worst]) < 0) worst = left;
    if (right < heap.length && compareCandidates(heap[right], heap[worst]) < 0) worst = right;
    if (worst === index) break;
    [heap[index], heap[worst]] = [heap[worst], heap[index]];
    index = worst;
  }
}

class CSVFoodSearch {
  constructor(csvFilePath = path.join(__dirname, '식품의약품안전처_통합식품영양성분정보_20250630.csv')) {
    this.csvFilePath = csvFilePath;
  }

  async *readRows() {
    const source = fs.createReadStream(this.csvFilePath, { encoding: 'utf8' });
    const parser = csv();
    source.on('error', error => parser.destroy(error));
    source.pipe(parser);

    try {
      for await (const row of parser) yield row;
    } finally {
      source.destroy();
      parser.destroy();
    }
  }

  normalizeRow(data) {
    return {
      식품코드: data.식품코드 || '',
      식품명: data.식품명 || '',
      에너지: data['에너지(kcal)'] || '',
      단백질: data['단백질(g)'] || '',
      지방: data['지방(g)'] || '',
      탄수화물: data['탄수화물(g)'] || '',
      당류: data['당류(g)'] || '',
      나트륨: data['나트륨(mg)'] || '',
      콜레스테롤: data['콜레스테롤(mg)'] || '',
      포화지방산: data['포화지방산(g)'] || '',
      트랜스지방산: data['트랜스지방산(g)'] || '',
      식품중량: data.식품중량 || '',
      제조사명: data.제조사명 || '',
      유통업체명: data.유통업체명 || '',
      업체명: data.업체명 || '',
      수입업체명: data.수입업체명 || '',
      식품대분류명: data.데이터구분명 || '',
      식품중분류명: data.출처명 || '',
      식품소분류명: data.원산지국명 || '',
      일회섭취참고량: data.영양성분함량기준량 || '',
      데이터기준일자: data.데이터기준일자 || '',
      출처: data.출처명 || '식품의약품안전처',
      수분: data['수분(g)'] || '',
      회분: data['회분(g)'] || '',
      식이섬유: data['식이섬유(g)'] || '',
      칼슘: data['칼슘(mg)'] || '',
      철: data['철(mg)'] || '',
      인: data['인(mg)'] || '',
      칼륨: data['칼륨(mg)'] || '',
      비타민A: data['비타민 A(μg RAE)'] || '',
      레티놀: data['레티놀(μg)'] || '',
      베타카로틴: data['베타카로틴(μg)'] || '',
      티아민: data['티아민(mg)'] || '',
      리보플라빈: data['리보플라빈(mg)'] || '',
      니아신: data['니아신(mg)'] || '',
      비타민C: data['비타민 C(mg)'] || '',
      비타민D: data['비타민 D(μg)'] || '',
      폐기율: data['폐기율(%)'] || '',
      수입여부: data.수입여부 || '',
      원산지국명: data.원산지국명 || '',
      품목제조보고번호: data.품목제조보고번호 || '',
      데이터생성방법명: data.데이터생성방법명 || '',
      데이터생성일자: data.데이터생성일자 || ''
    };
  }

  calculateSimilarityScore(searchTerm, foodName) {
    const search = searchTerm.toLowerCase();
    const food = foodName.toLowerCase();

    if (food === search) return 100;
    if (food.startsWith(search)) return 90;
    if (food.includes(search)) return 80 - (food.indexOf(search) * 2);

    const searchWords = search.split(/\s+/).filter(Boolean);
    const foodWords = food.split(/\s+/).filter(Boolean);
    let matchedWords = 0;
    for (const searchWord of searchWords) {
      if (foodWords.some(foodWord => foodWord.includes(searchWord))) matchedWords++;
    }
    if (matchedWords > 0) return 60 + (matchedWords / searchWords.length) * 20;

    let partialMatch = 0;
    for (const char of search) {
      if (food.includes(char)) partialMatch++;
    }
    return partialMatch > 0 ? (partialMatch / search.length) * 40 : 0;
  }

  async search(keyword, options = {}) {
    const { limit = 5000, exactMatch = false, includePartial = true } = options;
    const searchTerm = keyword.toLowerCase().trim();
    const resultLimit = Number.isFinite(Number(limit))
      ? Math.max(0, Math.min(5000, Math.trunc(Number(limit)))) : 0;
    if (!searchTerm || resultLimit === 0) return [];

    const searchWords = searchTerm.split(/\s+/).filter(Boolean);
    const best = [];
    let matchCount = 0;
    let index = 0;

    for await (const row of this.readRows()) {
      const foodName = (row.식품명 || '').toLowerCase();
      let matches = exactMatch ? foodName === searchTerm : foodName.includes(searchTerm);
      if (!exactMatch && !matches) {
        const foodWords = foodName.split(/\s+/).filter(Boolean);
        matches = searchWords.some(word => foodWords.some(foodWord => foodWord.includes(word)));
        if (!matches && includePartial) {
          let partialMatch = 0;
          for (const char of searchTerm) {
            if (foodName.includes(char)) partialMatch++;
          }
          matches = partialMatch / searchTerm.length >= 0.3;
        }
      }

      if (matches) {
        const score = this.calculateSimilarityScore(searchTerm, row.식품명 || '');
        if (score >= 5) {
          matchCount++;
          addCandidate(best, { row, score, nameLength: (row.식품명 || '').length, index }, resultLimit);
        }
      }
      index++;
    }

    best.sort((a, b) => compareCandidates(b, a));
    return best.map(({ row }) => this.normalizeRow(row));
  }

  async getDetail(foodCode, foodName, manufacturer) {
    let nameAndManufacturer = null;
    let nameOnly = null;

    for await (const row of this.readRows()) {
      if (foodCode && row.식품코드 === foodCode) return this.normalizeRow(row);
      if (foodName && row.식품명 === foodName) {
        if (!nameOnly) nameOnly = row;
        if (manufacturer && row.제조사명 === manufacturer && !nameAndManufacturer) {
          nameAndManufacturer = row;
          if (!foodCode) return this.normalizeRow(row);
        }
        if (!foodCode && !manufacturer) return this.normalizeRow(row);
      }
    }

    return nameAndManufacturer ? this.normalizeRow(nameAndManufacturer)
      : nameOnly ? this.normalizeRow(nameOnly) : null;
  }

  async getStats() {
    const categories = {};
    let totalItems = 0;
    let lastUpdated = 'Unknown';

    for await (const row of this.readRows()) {
      if (totalItems === 0) lastUpdated = row.데이터기준일자 || 'Unknown';
      const category = row.데이터구분명 || '기타';
      categories[category] = (categories[category] || 0) + 1;
      totalItems++;
    }

    return { totalItems, categories, lastUpdated };
  }

  async getSearchStats(keyword) {
    const searchTerm = keyword.toLowerCase().trim();
    const categories = {};
    let totalMatches = 0;

    for await (const row of this.readRows()) {
      if (!(row.식품명 || '').toLowerCase().includes(searchTerm)) continue;
      const category = row.데이터구분명 || '기타';
      categories[category] = (categories[category] || 0) + 1;
      totalMatches++;
    }

    return { keyword, totalMatches, categories };
  }
}

module.exports = CSVFoodSearch;
