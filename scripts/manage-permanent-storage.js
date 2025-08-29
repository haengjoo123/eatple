#!/usr/bin/env node

/**
 * 영구 저장소 관리 스크립트
 * 건강기능식품 API 데이터를 영구 저장소에 저장하고 관리하는 기능
 */

const PermanentStorageManager = require('../utils/permanentStorageManager');
const path = require('path');

class PermanentStorageManagerCLI {
    constructor() {
        this.manager = new PermanentStorageManager();
    }

    /**
     * 영구 저장소 상태 확인
     */
    async checkStatus() {
        console.log('\n=== 영구 저장소 상태 확인 ===');
        
        const status = this.manager.getPermanentStorageStatus();
        
        if (status.exists) {
            console.log(`✅ 영구 저장소 존재: ${status.count}개 제품`);
            console.log(`📅 저장 시간: ${status.timestamp}`);
            console.log(`⏰ 저장 후 경과: ${status.ageInDays}일`);
            console.log(`📝 설명: ${status.description}`);
        } else {
            console.log('❌ 영구 저장소에 데이터가 없습니다.');
        }

        // 캐시 상태도 함께 확인
        console.log('\n=== 캐시 상태 확인 ===');
        const cacheStatus = this.manager.foodSafetyAPI.getCacheStatus();
        
        if (cacheStatus.exists) {
            console.log(`✅ 캐시 존재: ${cacheStatus.count}개 제품`);
            console.log(`📅 캐시 시간: ${cacheStatus.timestamp}`);
            console.log(`⏰ 캐시 후 경과: ${cacheStatus.age}시간`);
            console.log(`🔄 만료 여부: ${cacheStatus.expired ? '만료됨' : '유효함'}`);
        } else {
            console.log('❌ 캐시에 데이터가 없습니다.');
        }
    }

    /**
     * 기존 캐시 데이터를 영구 저장소로 복사
     */
    async copyCacheToPermanent() {
        console.log('\n=== 기존 캐시 데이터를 영구 저장소로 복사 ===');
        
        try {
            const result = this.manager.copyCacheToPermanentStorage();
            
            if (result && result.success) {
                console.log(`✅ 성공: ${result.message}`);
                console.log(`📊 복사된 제품 수: ${result.count}개`);
                console.log(`📅 저장 시간: ${result.timestamp}`);
            } else {
                console.log('❌ 캐시 데이터 복사에 실패했습니다.');
            }
        } catch (error) {
            console.error('❌ 오류 발생:', error.message);
        }
    }

    /**
     * API에서 새 데이터를 받아 영구 저장소에 저장
     */
    async refreshAndSave() {
        console.log('\n=== API에서 새 데이터를 받아 영구 저장소에 저장 ===');
        
        try {
            const result = await this.manager.refreshAndSaveToPermanentStorage();
            
            if (result && result.success) {
                console.log(`✅ 성공: ${result.message}`);
                console.log(`📊 저장된 제품 수: ${result.count}개`);
                console.log(`📅 저장 시간: ${result.timestamp}`);
                if (result.source) {
                    console.log(`📡 데이터 소스: ${result.source === 'api' ? 'API 서버' : '캐시 데이터'}`);
                }
            } else {
                console.log('❌ 영구 저장소 저장에 실패했습니다.');
            }
        } catch (error) {
            console.error('❌ 오류 발생:', error.message);
        }
    }

    /**
     * 영구 저장소에서 데이터 조회 (API 연결 없이)
     */
    async loadFromPermanentStorage() {
        console.log('\n=== 영구 저장소에서 데이터 조회 ===');
        
        try {
            const data = this.manager.getDataFromPermanentStorage();
            
            if (data && data.C003) {
                console.log(`✅ 성공: ${data.C003.total_count}개 제품을 로드했습니다.`);
                console.log(`📊 데이터 소스: ${data.C003.source}`);
                
                // 샘플 데이터 출력
                if (data.C003.row && data.C003.row.length > 0) {
                    console.log('\n📋 샘플 제품 정보:');
                    const sample = data.C003.row[0];
                    console.log(`- 제품명: ${sample.PRDT_NM}`);
                    console.log(`- 제조사: ${sample.BSSH_NM}`);
                    console.log(`- 주요기능: ${sample.PRIMARY_FNCLTY}`);
                }
            } else {
                console.log('❌ 영구 저장소에서 데이터를 로드하지 못했습니다.');
            }
        } catch (error) {
            console.error('❌ 오류 발생:', error.message);
        }
    }

    /**
     * 영구 저장소 삭제
     */
    async clearPermanentStorage() {
        console.log('\n=== 영구 저장소 삭제 ===');
        
        try {
            const success = this.manager.clearPermanentStorage();
            
            if (success) {
                console.log('✅ 영구 저장소가 삭제되었습니다.');
            } else {
                console.log('❌ 영구 저장소 삭제에 실패했습니다.');
            }
        } catch (error) {
            console.error('❌ 오류 발생:', error.message);
        }
    }

    /**
     * 캐시 삭제
     */
    async clearCache() {
        console.log('\n=== 캐시 삭제 ===');
        
        try {
            const success = this.manager.foodSafetyAPI.clearCache();
            
            if (success) {
                console.log('✅ 캐시가 삭제되었습니다.');
            } else {
                console.log('❌ 캐시 삭제에 실패했습니다.');
            }
        } catch (error) {
            console.error('❌ 오류 발생:', error.message);
        }
    }

    /**
     * 도움말 출력
     */
    showHelp() {
        console.log(`
=== 영구 저장소 관리 도구 ===

사용법: node scripts/manage-permanent-storage.js [명령어]

명령어:
  status                    - 영구 저장소와 캐시 상태 확인
  copy-cache               - 기존 캐시 데이터를 영구 저장소로 복사
  refresh                  - API에서 새 데이터를 받아 영구 저장소에 저장
  load                     - 영구 저장소에서 데이터 조회 (API 연결 없이)
  clear-permanent          - 영구 저장소 삭제
  clear-cache              - 캐시 삭제
  help                     - 이 도움말 출력

예시:
  node scripts/manage-permanent-storage.js status
  node scripts/manage-permanent-storage.js copy-cache
  node scripts/manage-permanent-storage.js refresh
  node scripts/manage-permanent-storage.js load
        `);
    }

    /**
     * 메인 실행 함수
     */
    async run() {
        const command = process.argv[2];

        switch (command) {
            case 'status':
                await this.checkStatus();
                break;
            case 'copy-cache':
                await this.copyCacheToPermanent();
                break;
            case 'refresh':
                await this.refreshAndSave();
                break;
            case 'load':
                await this.loadFromPermanentStorage();
                break;
            case 'clear-permanent':
                await this.clearPermanentStorage();
                break;
            case 'clear-cache':
                await this.clearCache();
                break;
            case 'help':
            case '--help':
            case '-h':
                this.showHelp();
                break;
            default:
                console.log('❌ 잘못된 명령어입니다.');
                this.showHelp();
                break;
        }
    }
}

// 스크립트 실행
if (require.main === module) {
    const manager = new PermanentStorageManagerCLI();
    manager.run().catch(error => {
        console.error('❌ 스크립트 실행 중 오류 발생:', error);
        process.exit(1);
    });
}

module.exports = PermanentStorageManagerCLI;
