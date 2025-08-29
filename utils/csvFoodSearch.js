const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

class CSVFoodSearch {
  constructor() {
    this.csvFilePath = path.join(__dirname, '식품의약품안전처_통합식품영양성분정보_20250630.csv');
    this.foodData = [];
    this.isLoaded = false;
    this.loadPromise = null;
  }

  async loadCSV() {
    // 이미 로딩 중이거나 완료된 경우 기존 Promise 반환
    if (this.loadPromise) {
      return this.loadPromise;
    }

    if (this.isLoaded) {
      return Promise.resolve(this.foodData);
    }

    this.loadPromise = new Promise((resolve, reject) => {
      const results = [];
      
      if (!fs.existsSync(this.csvFilePath)) {
        reject(new Error(`CSV 파일을 찾을 수 없습니다: ${this.csvFilePath}`));
        return;
      }

      fs.createReadStream(this.csvFilePath, { encoding: 'utf8' })
        .pipe(csv())
        .on('data', (data) => {
          // 통합식품영양성분정보 CSV 구조에 맞게 데이터 정제 및 구조화
          const processedData = {
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
          results.push(processedData);
        })
        .on('end', () => {
          this.foodData = results;
          this.isLoaded = true;
          console.log(`[CSVFoodSearch] CSV 로드 완료: ${results.length}개 항목`);
          resolve(results);
        })
        .on('error', (error) => {
          console.error('[CSVFoodSearch] CSV 로드 실패:', error);
          reject(error);
        });
    });

    return this.loadPromise;
  }

  /**
   * 검색어와 식품명의 유사도 점수 계산
   * @param {string} searchTerm - 검색어
   * @param {string} foodName - 식품명
   * @returns {number} - 유사도 점수 (높을수록 더 유사)
   */
  calculateSimilarityScore(searchTerm, foodName) {
    const search = searchTerm.toLowerCase();
    const food = foodName.toLowerCase();
    
    // 정확한 일치 (가장 높은 점수)
    if (food === search) return 100;
    
    // 검색어가 식품명의 시작 부분에 있는 경우
    if (food.startsWith(search)) return 90;
    
    // 검색어가 식품명에 포함된 경우
    if (food.includes(search)) {
      const index = food.indexOf(search);
      // 앞쪽에 있을수록 높은 점수
      return 80 - (index * 2);
    }
    
    // 검색어의 각 단어가 식품명에 포함된 경우
    const searchWords = search.split(/\s+/).filter(word => word.length > 0);
    const foodWords = food.split(/\s+/).filter(word => word.length > 0);
    
    let matchedWords = 0;
    for (const searchWord of searchWords) {
      if (foodWords.some(foodWord => foodWord.includes(searchWord))) {
        matchedWords++;
      }
    }
    
    if (matchedWords > 0) {
      return 60 + (matchedWords / searchWords.length) * 20;
    }
    
    // 부분 일치 (글자 단위)
    let partialMatch = 0;
    for (let i = 0; i < search.length; i++) {
      if (food.includes(search[i])) {
        partialMatch++;
      }
    }
    
    if (partialMatch > 0) {
      return (partialMatch / search.length) * 40;
    }
    
    return 0;
  }

  // 개선된 부분일치 검색
  async search(keyword, options = {}) {
    const { limit = 5000, exactMatch = false, includePartial = true } = options;
    
    // CSV가 로드되지 않은 경우 로드
    if (!this.isLoaded) {
      await this.loadCSV();
    }

    const searchTerm = keyword.toLowerCase().trim();
    if (!searchTerm) return [];

    console.log(`[CSVFoodSearch] 검색 시작: "${keyword}" (${exactMatch ? '정확일치' : '부분일치'})`);

    let results = [];
    
    if (exactMatch) {
      // 정확일치 검색
      results = this.foodData.filter(item => {
        const foodName = (item.식품명 || '').toLowerCase();
        return foodName === searchTerm;
      });
    } else {
      // 부분일치 검색 (개선된 로직)
      results = this.foodData.filter(item => {
        const foodName = (item.식품명 || '').toLowerCase();
        
        // 1. 정확한 포함 검색
        if (foodName.includes(searchTerm)) return true;
        
        // 2. 단어 단위 검색
        const searchWords = searchTerm.split(/\s+/).filter(word => word.length > 0);
        const foodWords = foodName.split(/\s+/).filter(word => word.length > 0);
        
        for (const searchWord of searchWords) {
          if (foodWords.some(foodWord => foodWord.includes(searchWord))) {
            return true;
          }
        }
        
        // 3. 부분 일치 검색 (includePartial이 true인 경우)
        if (includePartial) {
          let matchCount = 0;
          for (let i = 0; i < searchTerm.length; i++) {
            if (foodName.includes(searchTerm[i])) {
              matchCount++;
            }
          }
          // 30% 이상 일치하면 포함 (더 관대하게)
          if (matchCount / searchTerm.length >= 0.3) {
            return true;
          }
        }
        
        return false;
      });
    }

    // 유사도 점수 계산 및 정렬
    results = results.map(item => ({
      ...item,
      similarityScore: this.calculateSimilarityScore(searchTerm, item.식품명 || '')
    }));

    // 유사도 점수로 정렬 (높은 점수 우선)
    results.sort((a, b) => {
      if (b.similarityScore !== a.similarityScore) {
        return b.similarityScore - a.similarityScore;
      }
      
      // 점수가 같으면 식품명 길이로 정렬 (짧은 것 우선)
      return (a.식품명 || '').length - (b.식품명 || '').length;
    });

    // 유사도 점수가 너무 낮은 결과 제거 (5점 미만으로 완화)
    results = results.filter(item => item.similarityScore >= 5);

    const limitedResults = results.slice(0, limit);
    console.log(`[CSVFoodSearch] 검색 완료: ${limitedResults.length}개 결과 반환 (전체 ${results.length}개 중)`);
    
    // 유사도 점수 제거하고 반환
    return limitedResults.map(item => {
      const { similarityScore, ...rest } = item;
      return rest;
    });
  }

  // 특정 식품의 상세 정보 조회
  async getDetail(foodCode, foodName, manufacturer) {
    if (!this.isLoaded) {
      await this.loadCSV();
    }

    // 식품코드로 먼저 검색
    if (foodCode) {
      const result = this.foodData.find(item => item.식품코드 === foodCode);
      if (result) return result;
    }

    // 식품명과 제조사명으로 정확일치 검색
    if (foodName && manufacturer) {
      const result = this.foodData.find(item => 
        item.식품명 === foodName && 
        item.제조사명 === manufacturer
      );
      if (result) return result;
    }

    // 식품명으로만 검색 (제조사명이 없는 경우)
    if (foodName) {
      const result = this.foodData.find(item => item.식품명 === foodName);
      if (result) return result;
    }

    return null;
  }

  // 통계 정보
  async getStats() {
    if (!this.isLoaded) {
      await this.loadCSV();
    }

    const categories = {};
    this.foodData.forEach(item => {
      const category = item.식품대분류명 || '기타';
      categories[category] = (categories[category] || 0) + 1;
    });

    return {
      totalItems: this.foodData.length,
      categories: categories,
      lastUpdated: this.foodData[0]?.데이터기준일자 || 'Unknown'
    };
  }

  // 검색 통계 정보
  async getSearchStats(keyword) {
    if (!this.isLoaded) {
      await this.loadCSV();
    }

    const searchTerm = keyword.toLowerCase().trim();
    const allResults = this.foodData.filter(item => {
      const foodName = (item.식품명 || '').toLowerCase();
      return foodName.includes(searchTerm);
    });

    const categories = {};
    allResults.forEach(item => {
      const category = item.식품대분류명 || '기타';
      categories[category] = (categories[category] || 0) + 1;
    });

    return {
      keyword: keyword,
      totalMatches: allResults.length,
      categories: categories
    };
  }
}

module.exports = CSVFoodSearch;