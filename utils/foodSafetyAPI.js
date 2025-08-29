const axios = require('axios');
const fs = require('fs');
const path = require('path');

class FoodSafetyAPI {
    constructor() {
        this.baseURL = 'http://openapi.foodsafetykorea.go.kr/api';
        this.serviceKey = process.env.FOOD_SAFETY_API_KEY;
        this.serviceId = 'C003'; // 건강기능식품 품목제조신고 정보 서비스 ID
        
        // 캐시 설정
        this.cacheDir = path.join(__dirname, '../data/cache');
        this.cacheFile = path.join(this.cacheDir, 'food_safety_products.json');
        this.cacheExpiryHours = 24; // 24시간 캐시 유지
        
        // 캐시 디렉토리 생성
        this.ensureCacheDir();
    }

    /**
     * 캐시 디렉토리 생성
     */
    ensureCacheDir() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    /**
     * 건강기능식품 정보 조회
     * @param {number} startIdx - 시작 인덱스 (기본값: 1)
     * @param {number} endIdx - 끝 인덱스 (기본값: 1000)
     * @returns {Object|null} API 응답 데이터 또는 null
     */
    async getHealthFunctionalFoods(startIdx = 1, endIdx = 1000) {
        let url;
        try {
            if (!this.serviceKey) {
                console.error('식약처 API 키가 설정되지 않았습니다.');
                return null;
            }

            url = `${this.baseURL}/${this.serviceKey}/${this.serviceId}/json/${startIdx}/${endIdx}`;
            console.log('식약처 API 호출:', url);
            
            const response = await axios.get(url, {
                timeout: 10000, // 10초 타임아웃
                headers: {
                    'User-Agent': 'meal-plan-app/1.0'
                }
            });

            console.log('API 응답 상태:', response.status);
            console.log('API 응답 헤더:', response.headers);
            console.log('API 응답 데이터 (처음 500자):', JSON.stringify(response.data).substring(0, 500));

            if (response.data && response.data.C003) {
                console.log(`식약처 API 성공: ${response.data.C003.total_count || 0}개 제품 조회`);
                console.log('응답 구조:', {
                    hasC003: !!response.data.C003,
                    hasRow: !!response.data.C003.row,
                    rowLength: response.data.C003.row ? response.data.C003.row.length : 0,
                    totalCount: response.data.C003.total_count
                });
                return response.data;
            } else {
                console.error('식약처 API 응답 형식 오류:', response.data);
                console.error('응답 상태:', response.status);
                console.error('응답 헤더:', response.headers);
                return null;
            }
        } catch (error) {
            console.error('식약처 API 호출 실패:', {
                message: error.message,
                code: error.code,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                url: url || 'URL 생성 실패'
            });
            
            // API 응답이 있는 경우 상세 정보 출력
            if (error.response) {
                console.error('API 오류 응답:', error.response.data);
            }
            
            return null;
        }
    }

    /**
     * 캐시에서 데이터 읽기
     */
    getCachedData() {
        try {
            if (!fs.existsSync(this.cacheFile)) {
                return null;
            }

            const cacheData = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
            const now = new Date();
            const cacheTime = new Date(cacheData.timestamp);
            const hoursDiff = (now - cacheTime) / (1000 * 60 * 60);

            // 캐시가 만료되었으면 null 반환
            if (hoursDiff > this.cacheExpiryHours) {
                console.log('캐시가 만료되었습니다. 새로운 데이터를 가져옵니다.');
                return null;
            }

            console.log(`캐시된 데이터를 사용합니다. (${cacheData.products.length}개 제품, ${hoursDiff.toFixed(1)}시간 전)`);
            return cacheData.products;
        } catch (error) {
            console.error('캐시 데이터 읽기 실패:', error);
            return null;
        }
    }

    /**
     * 캐시에 데이터 저장 (메모리 최적화)
     */
    setCachedData(products) {
        try {
            // 메모리 절약을 위해 불필요한 필드 제거
            const optimizedProducts = products.map(product => ({
                PRDLST_REPORT_NO: product.PRDLST_REPORT_NO,
                PRDT_NM: product.PRDT_NM,
                PRDLST_NM: product.PRDLST_NM,
                BSSH_NM: product.BSSH_NM,
                PRIMARY_FNCLTY: product.PRIMARY_FNCLTY,
                PRDT_SHAP_CD_NM: product.PRDT_SHAP_CD_NM,
                RAWMTRL_NM: product.RAWMTRL_NM,
                NTK_MTHD: product.NTK_MTHD,
                IFTKN_ATNT_MATR_CN: product.IFTKN_ATNT_MATR_CN,
                PRDLST_REPORT_DE: product.PRDLST_REPORT_DE,
                POG_DAYCNT: product.POG_DAYCNT,
                INTAKE_HINT_MPB: product.INTAKE_HINT_MPB,
                DISPOS: product.DISPOS
                // 다른 불필요한 필드들은 제외
            }));

            const cacheData = {
                timestamp: new Date().toISOString(),
                products: optimizedProducts,
                count: optimizedProducts.length
            };
            
            // JSON을 압축하지 않고 저장 (공백 제거로 용량 절약)
            fs.writeFileSync(this.cacheFile, JSON.stringify(cacheData));
            
            const fileSizeMB = (fs.statSync(this.cacheFile).size / 1024 / 1024).toFixed(2);
            console.log(`${optimizedProducts.length}개 제품을 캐시에 저장했습니다. (파일 크기: ${fileSizeMB}MB)`);
        } catch (error) {
            console.error('캐시 데이터 저장 실패:', error);
        }
    }

    /**
     * 순차적으로 배치 데이터 조회 (병렬 처리 제거)
     * @param {Array} batches - 배치 정보 배열 [{start, end}, ...]
     * @returns {Array} 모든 배치의 제품 데이터
     */
    async fetchBatchesSequentially(batches) {
        const results = [];
        let failedBatches = [];
        
        console.log(`총 ${batches.length}개 배치를 순차적으로 처리합니다...`);
        
        // 각 배치를 순차적으로 처리
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            console.log(`순차 처리 중... [${i + 1}/${batches.length}] 배치 ${batch.start}-${batch.end}`);
            
            // 재시도 로직 (최대 3회)
            let success = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const batchResult = await this.getHealthFunctionalFoods(batch.start, batch.end);
                    if (batchResult && batchResult.C003 && batchResult.C003.row) {
                        console.log(`✅ 배치 ${batch.start}-${batch.end}: ${batchResult.C003.row.length}개 제품 (시도 ${attempt}/3)`);
                        results.push(...batchResult.C003.row);
                        success = true;
                        break;
                    } else {
                        console.log(`❌ 배치 ${batch.start}-${batch.end}: 데이터 없음 (시도 ${attempt}/3)`);
                    }
                } catch (error) {
                    console.log(`❌ 배치 ${batch.start}-${batch.end} 실패 (시도 ${attempt}/3):`, error.message);
                    
                    // 마지막 시도가 아니면 대기 후 재시도
                    if (attempt < 3) {
                        const retryDelay = attempt * 1000 + Math.random() * 1000; // 1-2초, 2-3초
                        console.log(`재시도까지 ${retryDelay.toFixed(0)}ms 대기...`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                    }
                }
            }
            
            if (!success) {
                console.error(`❌ 배치 ${batch.start}-${batch.end}: 모든 시도 실패`);
                failedBatches.push(batch);
            }
            
            // 다음 배치 처리 전 대기 시간 (API 부하 방지)
            if (i + 1 < batches.length) {
                const waitTime = 1000 + Math.random() * 500; // 1-1.5초 랜덤 대기
                console.log(`API 부하 방지를 위해 ${waitTime.toFixed(0)}ms 대기 중...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        
        // 실패한 배치들 재시도 (1회만)
        if (failedBatches.length > 0 && failedBatches.length < batches.length * 0.5) { // 50% 미만 실패 시만 재시도
            console.log(`${failedBatches.length}개 실패 배치 재시도 중...`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기 후 재시도
            
            for (const batch of failedBatches) {
                try {
                    console.log(`재시도: 배치 ${batch.start}-${batch.end}`);
                    const retryResult = await this.getHealthFunctionalFoods(batch.start, batch.end);
                    if (retryResult && retryResult.C003 && retryResult.C003.row) {
                        console.log(`✅ 재시도 성공 ${batch.start}-${batch.end}: ${retryResult.C003.row.length}개 제품`);
                        results.push(...retryResult.C003.row);
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000)); // 재시도 간 1초 대기
                } catch (error) {
                    console.error(`재시도 실패 ${batch.start}-${batch.end}:`, error.message);
                }
            }
        }
        
        return results;
    }

    /**
     * 전체 건강기능식품 정보 조회 (순차 처리 + 캐싱)
     * @param {number} maxItems - 최대 조회할 제품 수 (기본값: 42000)
     * @param {boolean} forceRefresh - 캐시 무시하고 새로 조회 (기본값: false)
     * @returns {Object|null} 전체 제품 데이터 또는 null
     */
    async getAllHealthFunctionalFoods(maxItems = 42000, forceRefresh = false) {
        try {
            console.log('전체 건강기능식품 데이터 조회 시작...');
            
            // 캐시 확인 (강제 새로고침이 아닌 경우) - 캐시 우선 사용
            if (!forceRefresh) {
                const cachedData = this.getCachedData();
                if (cachedData) {
                    console.log(`✅ 캐시 데이터 사용: ${cachedData.length}개 제품`);
                    // 캐시된 데이터 최적화 - 필요한 필드만 유지
                    const optimizedData = cachedData.map(product => ({
                        PRDLST_NM: product.PRDLST_NM,
                        PRDT_NM: product.PRDT_NM,
                        PRIMARY_FNCLTY: product.PRIMARY_FNCLTY,
                        PRDT_SHAP_CD_NM: product.PRDT_SHAP_CD_NM,
                        BSSH_NM: product.BSSH_NM,
                        PRDLST_REPORT_NO: product.PRDLST_REPORT_NO,
                        RAWMTRL_NM: product.RAWMTRL_NM,  // 원재료명 필수!
                        NTK_MTHD: product.NTK_MTHD,      // 섭취방법
                        IFTKN_ATNT_MATR_CN: product.IFTKN_ATNT_MATR_CN  // 섭취시주의사항
                    }));
                    
                    return {
                        C003: {
                            total_count: optimizedData.length,
                            row: optimizedData
                        }
                    };
                }
            }
            
            // 먼저 소량 데이터로 전체 개수 확인
            const firstBatch = await this.getHealthFunctionalFoods(1, 100);
            if (!firstBatch || !firstBatch.C003) {
                console.error('초기 데이터 조회 실패');
                return null;
            }

            const totalCount = firstBatch.C003.total_count || 0;
            console.log(`전체 데이터 개수: ${totalCount}개`);

            if (totalCount === 0) {
                return firstBatch;
            }

            // 실제로 가져올 개수 결정
            const itemsToFetch = Math.min(totalCount, maxItems);
            console.log(`실제 조회할 개수: ${itemsToFetch}개`);

            // 배치 정보 생성 (42개 배치로 분할)
            const batchSize = 1000;
            const batches = [];
            for (let start = 1; start <= itemsToFetch; start += batchSize) {
                const end = Math.min(start + batchSize - 1, itemsToFetch);
                batches.push({ start, end });
            }

            console.log(`총 ${batches.length}개 배치를 순차적으로 처리합니다...`);
            console.log(`배치 크기: ${batchSize}개, 전체 개수: ${itemsToFetch}개`);
            console.log(`예상 배치 수: ${Math.ceil(itemsToFetch / batchSize)}개`);
            const startTime = Date.now();

            // 순차적으로 모든 배치 조회 (병렬 처리 제거)
            const allProducts = await this.fetchBatchesSequentially(batches);

            const endTime = Date.now();
            const duration = ((endTime - startTime) / 1000).toFixed(1);
            console.log(`✅ 순차 처리 완료: ${allProducts.length}개 제품 (${duration}초 소요)`);

            // 결과 데이터 구성
            const result = {
                C003: {
                    total_count: totalCount,
                    row: allProducts
                }
            };

            // 캐시에 저장
            this.setCachedData(allProducts);

            return result;

        } catch (error) {
            console.error('전체 건강기능식품 조회 실패:', error);
            return null;
        }
    }

    /**
     * 캐시 상태 확인
     */
    getCacheStatus() {
        try {
            if (!fs.existsSync(this.cacheFile)) {
                return { exists: false, expired: true, age: null, count: 0 };
            }

            const cacheData = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
            const now = new Date();
            const cacheTime = new Date(cacheData.timestamp);
            const hoursDiff = (now - cacheTime) / (1000 * 60 * 60);
            const expired = hoursDiff > this.cacheExpiryHours;

            return {
                exists: true,
                expired: expired,
                age: hoursDiff,
                count: cacheData.count || 0,
                timestamp: cacheData.timestamp
            };
        } catch (error) {
            console.error('캐시 상태 확인 실패:', error);
            return { exists: false, expired: true, age: null, count: 0 };
        }
    }

    /**
     * 캐시 삭제
     */
    clearCache() {
        try {
            if (fs.existsSync(this.cacheFile)) {
                fs.unlinkSync(this.cacheFile);
                console.log('캐시가 삭제되었습니다.');
                return true;
            }
            return false;
        } catch (error) {
            console.error('캐시 삭제 실패:', error);
            return false;
        }
    }

    /**
     * 특정 제품 상세 정보 조회 (캐시 활용)
     * @param {string} reportNo - 제품 신고번호
     * @returns {Object|null} 제품 상세 정보 또는 null
     */
    async getProductDetail(reportNo) {
        try {
            // 먼저 캐시에서 전체 데이터 조회
            const data = await this.getAllHealthFunctionalFoods();
            if (!data || !data.C003 || !data.C003.row) {
                return null;
            }

            const product = data.C003.row.find(item => 
                item.PRDLST_REPORT_NO === reportNo
            );

            return product || null;
        } catch (error) {
            console.error('제품 상세 정보 조회 실패:', error);
            return null;
        }
    }

    /**
     * 기존 캐시 데이터를 영구 저장소로 복사 (새로 추가)
     * @returns {Object|null} 복사 결과 정보 또는 null
     */
    copyCacheToPermanentStorage() {
        try {
            console.log('기존 캐시 데이터를 영구 저장소로 복사합니다...');
            
            // 캐시에서 데이터 읽기
            const cachedData = this.getCachedData();
            
            if (!cachedData) {
                console.log('캐시에 데이터가 없습니다.');
                return null;
            }

            console.log(`캐시에서 ${cachedData.length}개 제품을 발견했습니다.`);

            // 영구 저장소에 저장
            const saveSuccess = this.setPermanentData(cachedData);
            
            if (saveSuccess) {
                const status = this.getPermanentStorageStatus();
                console.log('✅ 캐시 데이터를 영구 저장소로 복사 완료:', status);
                
                return {
                    success: true,
                    count: cachedData.length,
                    timestamp: status.timestamp,
                    message: `${cachedData.length}개 제품이 캐시에서 영구 저장소로 복사되었습니다.`
                };
            } else {
                console.error('영구 저장소 저장에 실패했습니다.');
                return null;
            }
        } catch (error) {
            console.error('캐시 데이터 복사 실패:', error);
            return null;
        }
    }

    /**
     * API에서 새 데이터를 받아서 영구 저장소에 저장 (새로 추가)
     * @param {number} maxItems - 최대 조회할 제품 수 (기본값: 42000)
     * @returns {Object|null} 저장된 데이터 정보 또는 null
     */
    async refreshAndSaveToPermanentStorage(maxItems = 42000) {
        try {
            console.log('API에서 새 데이터를 받아 영구 저장소에 저장을 시작합니다...');
            
            // API에서 모든 데이터 새로 받기 (강제 새로고침)
            const apiData = await this.getAllHealthFunctionalFoods(maxItems, true);
            
            if (!apiData || !apiData.C003 || !apiData.C003.row) {
                console.error('API에서 데이터를 받아오지 못했습니다.');
                return null;
            }

            const products = apiData.C003.row;
            console.log(`API에서 ${products.length}개 제품을 받았습니다.`);

            // 영구 저장소에 저장
            const saveSuccess = this.setPermanentData(products);
            
            if (saveSuccess) {
                const status = this.getPermanentStorageStatus();
                console.log('✅ 영구 저장소 저장 완료:', status);
                
                return {
                    success: true,
                    count: products.length,
                    timestamp: status.timestamp,
                    message: `${products.length}개 제품이 영구 저장소에 저장되었습니다.`
                };
            } else {
                console.error('영구 저장소 저장에 실패했습니다.');
                return null;
            }
        } catch (error) {
            console.error('영구 저장소 새로고침 실패:', error);
            return null;
        }
    }

    /**
     * 영구 저장소에서 데이터 조회 (API 연결 없이) (새로 추가)
     * @returns {Object|null} 영구 저장된 제품 데이터 또는 null
     */
    getDataFromPermanentStorage() {
        try {
            const permanentData = this.getPermanentData();
            
            if (!permanentData) {
                console.log('영구 저장소에 데이터가 없습니다.');
                return null;
            }

            // 영구 저장된 데이터 최적화 - 필요한 필드만 유지
            const optimizedData = permanentData.map(product => ({
                PRDLST_NM: product.PRDLST_NM,
                PRDT_NM: product.PRDT_NM,
                PRIMARY_FNCLTY: product.PRIMARY_FNCLTY,
                PRDT_SHAP_CD_NM: product.PRDT_SHAP_CD_NM,
                BSSH_NM: product.BSSH_NM,
                PRDLST_REPORT_NO: product.PRDLST_REPORT_NO,
                RAWMTRL_NM: product.RAWMTRL_NM,
                NTK_MTHD: product.NTK_MTHD,
                IFTKN_ATNT_MATR_CN: product.IFTKN_ATNT_MATR_CN
            }));
            
            console.log(`✅ 영구 저장소에서 ${optimizedData.length}개 제품을 로드했습니다.`);
            
            return {
                C003: {
                    total_count: optimizedData.length,
                    row: optimizedData,
                    source: 'permanent_storage'
                }
            };
        } catch (error) {
            console.error('영구 저장소 데이터 조회 실패:', error);
            return null;
        }
    }
}

module.exports = FoodSafetyAPI;
