/**
 * File-based Cache Manager for Nutrition Information
 * 파일 기반 캐시 매니저 - 서버 재시작 후에도 캐시 유지
 */

const fs = require('fs').promises;
const path = require('path');

class FileCacheManager {
    constructor() {
        this.cacheDir = path.join(__dirname, '../data/cache');
        this.nutritionCacheDir = path.join(this.cacheDir, 'nutrition');
        this.ensureCacheDirectories();
        
        // 메모리 캐시도 함께 사용 (성능 향상)
        this.memoryCache = new Map();
        this.memoryCacheExpiry = new Map();
        
        // 파일 캐시 설정
        this.cacheConfig = {
            nutrition: { ttl: 1800 }, // 30분
            user: { ttl: 300 } // 5분
        };
        
        // 캐시 통계
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0
        };
        
        // 주기적으로 메모리 캐시 정리 (5분마다)
        setInterval(() => this.cleanupMemoryCache(), 5 * 60 * 1000);
    }

    async ensureCacheDirectories() {
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
            await fs.mkdir(this.nutritionCacheDir, { recursive: true });
        } catch (error) {
            console.error('캐시 디렉토리 생성 오류:', error);
        }
    }

    /**
     * 캐시 키 생성
     */
    generateKey(namespace, identifier, params = {}) {
        const baseKey = `${namespace}_${identifier}`;
        
        if (Object.keys(params).length === 0) {
            return baseKey;
        }

        const sortedParams = Object.keys(params)
            .sort()
            .map(key => `${key}=${params[key]}`)
            .join('&');

        return `${baseKey}_${Buffer.from(sortedParams).toString('base64').replace(/[+/=]/g, '_')}`;
    }

    /**
     * 파일 경로 생성
     */
    getFilePath(key) {
        return path.join(this.nutritionCacheDir, `${key}.json`);
    }

    /**
     * 캐시에서 값 조회
     */
    async get(namespace, identifier, params = {}) {
        const key = this.generateKey(namespace, identifier, params);
        
        // 1. 메모리 캐시에서 먼저 확인
        if (this.memoryCache.has(key)) {
            const expiry = this.memoryCacheExpiry.get(key);
            if (expiry && Date.now() < expiry) {
                this.stats.hits++;
                console.log(`[MEMORY CACHE HIT] ${key}`);
                return this.memoryCache.get(key);
            } else {
                // 만료된 메모리 캐시 제거
                this.memoryCache.delete(key);
                this.memoryCacheExpiry.delete(key);
            }
        }

        try {
            // 2. 파일 캐시에서 확인
            const filePath = this.getFilePath(key);
            const fileContent = await fs.readFile(filePath, 'utf8');
            const cacheData = JSON.parse(fileContent);
            
            // TTL 확인
            const ttl = this.cacheConfig[namespace]?.ttl || 300;
            if (Date.now() - cacheData.cachedAt > ttl * 1000) {
                // 만료된 캐시 파일 삭제
                await this.delete(namespace, identifier, params);
                this.stats.misses++;
                console.log(`[FILE CACHE EXPIRED] ${key}`);
                return null;
            }
            
            // 메모리 캐시에도 저장 (성능 향상)
            this.memoryCache.set(key, cacheData);
            this.memoryCacheExpiry.set(key, Date.now() + ttl * 1000);
            
            this.stats.hits++;
            console.log(`[FILE CACHE HIT] ${key}`);
            return cacheData;
            
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`캐시 파일 읽기 오류 (${key}):`, error);
            }
            this.stats.misses++;
            console.log(`[FILE CACHE MISS] ${key}`);
            return null;
        }
    }

    /**
     * 캐시에 값 저장
     */
    async set(namespace, identifier, value, params = {}, customTTL = null) {
        const key = this.generateKey(namespace, identifier, params);
        
        const cacheData = {
            ...value,
            cachedAt: Date.now(),
            namespace,
            identifier,
            params
        };

        try {
            // 1. 파일에 저장
            const filePath = this.getFilePath(key);
            await fs.writeFile(filePath, JSON.stringify(cacheData, null, 2), 'utf8');
            
            // 2. 메모리 캐시에도 저장
            const ttl = customTTL || this.cacheConfig[namespace]?.ttl || 300;
            this.memoryCache.set(key, cacheData);
            this.memoryCacheExpiry.set(key, Date.now() + ttl * 1000);
            
            this.stats.sets++;
            console.log(`[CACHE SET] ${key}`);
            return true;
            
        } catch (error) {
            console.error(`캐시 파일 저장 오류 (${key}):`, error);
            return false;
        }
    }

    /**
     * 캐시 삭제
     */
    async delete(namespace, identifier, params = {}) {
        const key = this.generateKey(namespace, identifier, params);
        
        try {
            // 1. 파일 삭제
            const filePath = this.getFilePath(key);
            await fs.unlink(filePath);
            
            // 2. 메모리 캐시에서도 삭제
            this.memoryCache.delete(key);
            this.memoryCacheExpiry.delete(key);
            
            this.stats.deletes++;
            console.log(`[CACHE DELETE] ${key}`);
            return true;
            
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`캐시 파일 삭제 오류 (${key}):`, error);
            }
            return false;
        }
    }

    /**
     * 네임스페이스별 캐시 초기화
     */
    async clearNamespace(namespace) {
        try {
            const files = await fs.readdir(this.nutritionCacheDir);
            let deletedCount = 0;
            
            for (const file of files) {
                if (file.startsWith(`${namespace}_`) && file.endsWith('.json')) {
                    const filePath = path.join(this.nutritionCacheDir, file);
                    await fs.unlink(filePath);
                    deletedCount++;
                }
            }
            
            // 메모리 캐시에서도 해당 네임스페이스 삭제
            for (const [key, value] of this.memoryCache.entries()) {
                if (value.namespace === namespace) {
                    this.memoryCache.delete(key);
                    this.memoryCacheExpiry.delete(key);
                }
            }
            
            console.log(`[CACHE CLEAR NAMESPACE] ${namespace} - ${deletedCount}개 파일 삭제`);
            return deletedCount;
            
        } catch (error) {
            console.error(`네임스페이스 캐시 초기화 오류 (${namespace}):`, error);
            return 0;
        }
    }

    /**
     * 전체 캐시 초기화
     */
    async clearAll() {
        try {
            const files = await fs.readdir(this.nutritionCacheDir);
            let deletedCount = 0;
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(this.nutritionCacheDir, file);
                    await fs.unlink(filePath);
                    deletedCount++;
                }
            }
            
            // 메모리 캐시도 모두 초기화
            this.memoryCache.clear();
            this.memoryCacheExpiry.clear();
            
            console.log(`[CACHE CLEAR ALL] ${deletedCount}개 파일 삭제`);
            return deletedCount;
            
        } catch (error) {
            console.error('전체 캐시 초기화 오류:', error);
            return 0;
        }
    }

    /**
     * 패턴으로 캐시 무효화
     */
    async invalidatePattern(pattern) {
        try {
            const files = await fs.readdir(this.nutritionCacheDir);
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            let deletedCount = 0;
            
            for (const file of files) {
                const key = file.replace('.json', '');
                if (regex.test(key)) {
                    const filePath = path.join(this.nutritionCacheDir, file);
                    await fs.unlink(filePath);
                    deletedCount++;
                    
                    // 메모리 캐시에서도 삭제
                    this.memoryCache.delete(key);
                    this.memoryCacheExpiry.delete(key);
                }
            }
            
            console.log(`[CACHE INVALIDATE PATTERN] ${pattern} - ${deletedCount}개 파일 삭제`);
            return deletedCount;
            
        } catch (error) {
            console.error(`패턴 캐시 무효화 오류 (${pattern}):`, error);
            return 0;
        }
    }

    /**
     * 캐시 통계 조회
     */
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0 
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
            : 0;

        return {
            ...this.stats,
            hitRate: `${hitRate}%`,
            memoryKeys: this.memoryCache.size,
            memoryUsage: process.memoryUsage()
        };
    }

    /**
     * 캐시 키 목록 조회
     */
    async getKeysMatching(pattern) {
        try {
            const files = await fs.readdir(this.nutritionCacheDir);
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            
            return files
                .filter(file => file.endsWith('.json'))
                .map(file => file.replace('.json', ''))
                .filter(key => regex.test(key));
                
        } catch (error) {
            console.error('캐시 키 조회 오류:', error);
            return [];
        }
    }

    /**
     * 메모리 캐시 정리 (만료된 항목 제거)
     */
    cleanupMemoryCache() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, expiry] of this.memoryCacheExpiry.entries()) {
            if (expiry && now >= expiry) {
                this.memoryCache.delete(key);
                this.memoryCacheExpiry.delete(key);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`[MEMORY CACHE CLEANUP] ${cleanedCount}개 만료된 항목 제거`);
        }
    }

    /**
     * 캐시 상태 확인
     */
    async getCacheStatus() {
        try {
            const files = await fs.readdir(this.nutritionCacheDir);
            const fileCount = files.filter(file => file.endsWith('.json')).length;
            
            return {
                totalFiles: fileCount,
                memoryKeys: this.memoryCache.size,
                stats: this.getStats()
            };
        } catch (error) {
            console.error('캐시 상태 조회 오류:', error);
            return {
                totalFiles: 0,
                memoryKeys: 0,
                stats: this.getStats()
            };
        }
    }
}

// Singleton instance
let fileCacheManagerInstance = null;

function getFileCacheManager() {
    if (!fileCacheManagerInstance) {
        fileCacheManagerInstance = new FileCacheManager();
    }
    return fileCacheManagerInstance;
}

module.exports = getFileCacheManager();
module.exports.FileCacheManager = FileCacheManager;
module.exports.getFileCacheManager = getFileCacheManager;
