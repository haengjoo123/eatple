/**
 * 영구 저장소 관리자
 * 건강기능식품 API 데이터를 영구적으로 저장하고 관리하는 기능
 */

const fs = require('fs');
const path = require('path');
const FoodSafetyAPI = require('./foodSafetyAPI');

class PermanentStorageManager {
    constructor() {
        this.foodSafetyAPI = new FoodSafetyAPI();
        
        // 영구 저장소 설정
        this.permanentStorageDir = path.join(__dirname, '../data/permanent-storage');
        this.permanentStorageFile = path.join(this.permanentStorageDir, 'health_functional_foods_permanent.json');
        
        // 영구 저장소 디렉토리 생성
        this.ensurePermanentStorageDir();
    }

    /**
     * 영구 저장소 디렉토리 생성
     */
    ensurePermanentStorageDir() {
        if (!fs.existsSync(this.permanentStorageDir)) {
            fs.mkdirSync(this.permanentStorageDir, { recursive: true });
        }
    }

    /**
     * 영구 저장소에서 데이터 읽기
     * @returns {Array|null} 영구 저장된 제품 데이터 또는 null
     */
    getPermanentData() {
        try {
            if (!fs.existsSync(this.permanentStorageFile)) {
                console.log('영구 저장소에 데이터가 없습니다.');
                return null;
            }

            const permanentData = JSON.parse(fs.readFileSync(this.permanentStorageFile, 'utf-8'));
            console.log(`영구 저장소에서 ${permanentData.products.length}개 제품을 로드했습니다.`);
            return permanentData.products;
        } catch (error) {
            console.error('영구 저장소 데이터 읽기 실패:', error);
            return null;
        }
    }

    /**
     * 영구 저장소에 데이터 저장
     * @param {Array} products - 저장할 제품 데이터
     * @returns {boolean} 저장 성공 여부
     */
    setPermanentData(products) {
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
            }));

            const permanentData = {
                timestamp: new Date().toISOString(),
                products: optimizedProducts,
                count: optimizedProducts.length,
                description: '영구 저장소 - API 연결 없이 사용 가능한 건강기능식품 데이터'
            };
            
            // JSON을 압축하지 않고 저장 (공백 제거로 용량 절약)
            fs.writeFileSync(this.permanentStorageFile, JSON.stringify(permanentData));
            
            const fileSizeMB = (fs.statSync(this.permanentStorageFile).size / 1024 / 1024).toFixed(2);
            console.log(`${optimizedProducts.length}개 제품을 영구 저장소에 저장했습니다. (파일 크기: ${fileSizeMB}MB)`);
            return true;
        } catch (error) {
            console.error('영구 저장소 데이터 저장 실패:', error);
            return false;
        }
    }

    /**
     * 영구 저장소 상태 확인
     * @returns {Object} 영구 저장소 상태 정보
     */
    getPermanentStorageStatus() {
        try {
            if (!fs.existsSync(this.permanentStorageFile)) {
                return { exists: false, count: 0, timestamp: null };
            }

            const permanentData = JSON.parse(fs.readFileSync(this.permanentStorageFile, 'utf-8'));
            const now = new Date();
            const storageTime = new Date(permanentData.timestamp);
            const daysDiff = (now - storageTime) / (1000 * 60 * 60 * 24);

            return {
                exists: true,
                count: permanentData.count || 0,
                timestamp: permanentData.timestamp,
                ageInDays: daysDiff.toFixed(1),
                description: permanentData.description
            };
        } catch (error) {
            console.error('영구 저장소 상태 확인 실패:', error);
            return { exists: false, count: 0, timestamp: null };
        }
    }

    /**
     * 영구 저장소 삭제
     * @returns {boolean} 삭제 성공 여부
     */
    clearPermanentStorage() {
        try {
            if (fs.existsSync(this.permanentStorageFile)) {
                fs.unlinkSync(this.permanentStorageFile);
                console.log('영구 저장소가 삭제되었습니다.');
                return true;
            }
            return false;
        } catch (error) {
            console.error('영구 저장소 삭제 실패:', error);
            return false;
        }
    }

    /**
     * 기존 캐시 데이터를 영구 저장소로 복사
     * @returns {Object|null} 복사 결과 정보 또는 null
     */
    copyCacheToPermanentStorage() {
        try {
            console.log('기존 캐시 데이터를 영구 저장소로 복사합니다...');
            
            // 캐시에서 데이터 읽기
            const cachedData = this.foodSafetyAPI.getCachedData();
            
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
     * API에서 새 데이터를 받아서 영구 저장소에 저장
     * @param {number} maxItems - 최대 조회할 제품 수 (기본값: 42000)
     * @returns {Object|null} 저장된 데이터 정보 또는 null
     */
    async refreshAndSaveToPermanentStorage(maxItems = 42000) {
        try {
            console.log('API에서 새 데이터를 받아 영구 저장소에 저장을 시작합니다...');
            
            // API에서 모든 데이터 새로 받기 (API 우선 + 강제 새로고침)
            const apiData = await this.foodSafetyAPI.getAllHealthFunctionalFoods(maxItems, true, true);
            
            if (!apiData || !apiData.C003 || !apiData.C003.row) {
                console.error('API에서 데이터를 받아오지 못했습니다.');
                console.log('캐시 데이터를 사용하여 영구 저장소를 업데이트합니다...');
                
                // 캐시 데이터를 사용하여 영구 저장소 업데이트
                const cachedData = this.foodSafetyAPI.getCachedData();
                if (cachedData) {
                    console.log(`캐시에서 ${cachedData.length}개 제품을 발견했습니다.`);
                    
                    // 영구 저장소에 저장
                    const saveSuccess = this.setPermanentData(cachedData);
                    
                    if (saveSuccess) {
                        const status = this.getPermanentStorageStatus();
                        console.log('✅ 캐시 데이터로 영구 저장소 업데이트 완료:', status);
                        
                        return {
                            success: true,
                            count: cachedData.length,
                            timestamp: status.timestamp,
                            message: `${cachedData.length}개 제품이 캐시에서 영구 저장소로 복사되었습니다. (API 서버 일시적 오류)`,
                            source: 'cache'
                        };
                    }
                }
                
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
                    message: `${products.length}개 제품이 영구 저장소에 저장되었습니다.`,
                    source: 'api'
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
     * 영구 저장소에서 데이터 조회 (API 연결 없이)
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

module.exports = PermanentStorageManager;
