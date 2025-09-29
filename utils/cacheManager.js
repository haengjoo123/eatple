/**
 * Cache Manager for Product Management System
 * Implements multi-level caching with Redis-like functionality
 * Requirements: 3.3, 3.4, 6.4, 8.1, 8.2
 */

const NodeCache = require('node-cache');

class CacheManager {
    constructor() {
        // Memory cache with TTL
        this.memoryCache = new NodeCache({
            stdTTL: 300, // 5 minutes default
            checkperiod: 60, // Check for expired keys every minute
            useClones: false // Better performance, but be careful with object mutations
        });

        // Different cache levels with different TTLs
        this.cacheConfig = {
            products: { ttl: 300 }, // 5 minutes
            categories: { ttl: 600 }, // 10 minutes
            statistics: { ttl: 180 }, // 3 minutes
            analytics: { ttl: 120 }, // 2 minutes
            search: { ttl: 60 }, // 1 minute
            popular: { ttl: 900 }, // 15 minutes
            images: { ttl: 3600 }, // 1 hour
            nutrition: { ttl: 300 }, // 5 minutes for nutrition info (메모리 절약)
            user: { ttl: 300 } // 5 minutes for user data
        };

        // Cache hit/miss statistics
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0
        };

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        // Log cache events for monitoring (로그 제거)
        this.memoryCache.on('set', (key, value) => {
            this.stats.sets++;
        });

        this.memoryCache.on('del', (key, value) => {
            this.stats.deletes++;
        });

        this.memoryCache.on('expired', (key, value) => {
            // 만료 이벤트는 조용히 처리
        });
    }

    /**
     * Generate cache key with namespace
     */
    generateKey(namespace, identifier, params = {}) {
        const baseKey = `${namespace}:${identifier}`;
        
        if (Object.keys(params).length === 0) {
            return baseKey;
        }

        // Sort params for consistent key generation
        const sortedParams = Object.keys(params)
            .sort()
            .map(key => `${key}=${params[key]}`)
            .join('&');

        return `${baseKey}:${Buffer.from(sortedParams).toString('base64')}`;
    }

    /**
     * Get value from cache
     */
    get(namespace, identifier, params = {}) {
        const key = this.generateKey(namespace, identifier, params);
        const value = this.memoryCache.get(key);
        
        if (value !== undefined) {
            this.stats.hits++;
            return value;
        }
        
        this.stats.misses++;
        return null;
    }

    /**
     * Set value in cache
     */
    set(namespace, identifier, value, params = {}, customTTL = null) {
        const key = this.generateKey(namespace, identifier, params);
        const ttl = customTTL || this.cacheConfig[namespace]?.ttl || 300;
        
        return this.memoryCache.set(key, value, ttl);
    }

    /**
     * Delete specific cache entry
     */
    delete(namespace, identifier, params = {}) {
        const key = this.generateKey(namespace, identifier, params);
        return this.memoryCache.del(key);
    }

    /**
     * Clear all cache entries for a namespace
     */
    clearNamespace(namespace) {
        const keys = this.memoryCache.keys();
        const namespaceKeys = keys.filter(key => key.startsWith(`${namespace}:`));
        
        if (namespaceKeys.length > 0) {
            this.memoryCache.del(namespaceKeys);
            console.log(`Cleared ${namespaceKeys.length} keys from namespace: ${namespace}`);
        }
        
        return namespaceKeys.length;
    }

    /**
     * Clear all cache
     */
    clearAll() {
        const keyCount = this.memoryCache.keys().length;
        this.memoryCache.flushAll();
        console.log(`Cleared all cache (${keyCount} keys)`);
        return keyCount;
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const keys = this.memoryCache.keys();
        const hitRate = this.stats.hits + this.stats.misses > 0 
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
            : 0;

        return {
            ...this.stats,
            hitRate: `${hitRate}%`,
            totalKeys: keys.length,
            memoryUsage: process.memoryUsage(),
            keysByNamespace: this.getKeysByNamespace(keys)
        };
    }

    /**
     * Get keys grouped by namespace
     */
    getKeysByNamespace(keys) {
        const namespaces = {};
        
        keys.forEach(key => {
            const namespace = key.split(':')[0];
            namespaces[namespace] = (namespaces[namespace] || 0) + 1;
        });
        
        return namespaces;
    }

    /**
     * Cache wrapper for async functions
     */
    async wrap(namespace, identifier, asyncFunction, params = {}, customTTL = null) {
        // Try to get from cache first
        const cached = this.get(namespace, identifier, params);
        if (cached !== null) {
            return cached;
        }

        try {
            // Execute function and cache result
            const result = await asyncFunction();
            this.set(namespace, identifier, result, params, customTTL);
            return result;
        } catch (error) {
            console.error(`Cache wrap error for ${namespace}:${identifier}:`, error);
            throw error;
        }
    }

    /**
     * Batch get multiple cache entries
     */
    mget(entries) {
        const results = {};
        
        entries.forEach(({ namespace, identifier, params = {} }) => {
            const key = this.generateKey(namespace, identifier, params);
            const value = this.memoryCache.get(key);
            results[key] = value !== undefined ? value : null;
        });
        
        return results;
    }

    /**
     * Batch set multiple cache entries
     */
    mset(entries) {
        const results = [];
        
        entries.forEach(({ namespace, identifier, value, params = {}, customTTL = null }) => {
            const success = this.set(namespace, identifier, value, params, customTTL);
            results.push(success);
        });
        
        return results;
    }

    /**
     * Get cache keys matching pattern
     */
    getKeysMatching(pattern) {
        const keys = this.memoryCache.keys();
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return keys.filter(key => regex.test(key));
    }

    /**
     * Invalidate cache based on patterns
     */
    invalidatePattern(pattern) {
        const keys = this.getKeysMatching(pattern);
        if (keys.length > 0) {
            this.memoryCache.del(keys);
            console.log(`Invalidated ${keys.length} keys matching pattern: ${pattern}`);
        }
        return keys.length;
    }

    /**
     * Preload cache with data
     */
    async preload(namespace, dataLoader, identifiers = []) {
        console.log(`Preloading cache for namespace: ${namespace}`);
        const results = [];
        
        for (const identifier of identifiers) {
            try {
                const data = await dataLoader(identifier);
                this.set(namespace, identifier, data);
                results.push({ identifier, success: true });
            } catch (error) {
                console.error(`Preload error for ${namespace}:${identifier}:`, error);
                results.push({ identifier, success: false, error: error.message });
            }
        }
        
        return results;
    }

    /**
     * Cache warming - refresh cache before expiry
     */
    async warmCache(namespace, identifier, asyncFunction, params = {}) {
        const key = this.generateKey(namespace, identifier, params);
        const ttl = this.memoryCache.getTtl(key);
        
        // If cache exists and has less than 25% TTL remaining, refresh it
        if (ttl && ttl > 0) {
            const remainingTime = ttl - Date.now();
            const originalTTL = this.cacheConfig[namespace]?.ttl || 300;
            const refreshThreshold = originalTTL * 1000 * 0.25; // 25% of original TTL
            
            if (remainingTime < refreshThreshold) {
                console.log(`Warming cache for ${key}`);
                try {
                    const result = await asyncFunction();
                    this.set(namespace, identifier, result, params);
                    return result;
                } catch (error) {
                    console.error(`Cache warming error for ${key}:`, error);
                    // Return existing cached value on error
                    return this.get(namespace, identifier, params);
                }
            }
        }
        
        return this.get(namespace, identifier, params);
    }

    /**
     * User data specific methods
     */
    getUserData(key) {
        return this.get('user', key);
    }

    cacheUserData(key, data, ttl = 300) {
        return this.set('user', key, data, {}, ttl);
    }

    invalidateUserCache(key) {
        return this.delete('user', key);
    }

    /**
     * Memory optimization - remove least recently used items
     */
    optimizeMemory(maxKeys = 1000) {
        const keys = this.memoryCache.keys();
        
        if (keys.length <= maxKeys) {
            return 0;
        }
        
        // Get keys with their TTL and sort by remaining time
        const keysWithTTL = keys.map(key => ({
            key,
            ttl: this.memoryCache.getTtl(key) || 0
        })).sort((a, b) => a.ttl - b.ttl);
        
        // Remove oldest keys
        const keysToRemove = keysWithTTL.slice(0, keys.length - maxKeys).map(item => item.key);
        this.memoryCache.del(keysToRemove);
        
        console.log(`🧹 메모리 최적화: ${keysToRemove.length}개 키 제거 (현재: ${keys.length - keysToRemove.length}/${maxKeys})`);
        return keysToRemove.length;
    }

    /**
     * 긴급 메모리 최적화 (더 적극적인 정리)
     */
    emergencyOptimization() {
        console.log('🚨 긴급 메모리 최적화 시작...');
        
        const keys = this.memoryCache.keys();
        const initialCount = keys.length;
        
        // 1. 단기 캐시부터 정리 (TTL 60초 이하)
        const shortTermKeys = keys.filter(key => {
            const ttl = this.memoryCache.getTtl(key);
            return ttl && ttl <= 60;
        });
        
        if (shortTermKeys.length > 0) {
            this.memoryCache.del(shortTermKeys);
            console.log(`🗑️ 단기 캐시 ${shortTermKeys.length}개 정리`);
        }
        
        // 2. 검색 관련 캐시 정리
        const searchKeys = keys.filter(key => key.includes('search:') || key.includes('query:'));
        if (searchKeys.length > 0) {
            this.memoryCache.del(searchKeys);
            console.log(`🔍 검색 캐시 ${searchKeys.length}개 정리`);
        }
        
        // 3. 통계 캐시 정리
        const statsKeys = keys.filter(key => key.includes('stats:') || key.includes('analytics:'));
        if (statsKeys.length > 0) {
            this.memoryCache.del(statsKeys);
            console.log(`📊 통계 캐시 ${statsKeys.length}개 정리`);
        }
        
        // 4. 남은 키가 여전히 많으면 강제로 50% 제거
        const remainingKeys = this.memoryCache.keys();
        if (remainingKeys.length > 200) {
            const halfKeys = remainingKeys.slice(0, Math.floor(remainingKeys.length / 2));
            this.memoryCache.del(halfKeys);
            console.log(`⚡ 강제 정리: ${halfKeys.length}개 추가 제거`);
        }
        
        const finalCount = this.memoryCache.keys().length;
        const removedCount = initialCount - finalCount;
        
        console.log(`✅ 긴급 최적화 완료: ${removedCount}개 키 제거 (${initialCount} → ${finalCount})`);
        return removedCount;
    }

    /**
     * Health check for cache system
     */
    healthCheck() {
        const stats = this.getStats();
        const memoryUsage = process.memoryUsage();
        const memoryUsageMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        
        return {
            status: 'healthy',
            cache: {
                totalKeys: stats.totalKeys,
                hitRate: stats.hitRate,
                memoryUsageMB
            },
            thresholds: {
                maxKeys: 1000,
                maxMemoryMB: 100,
                minHitRate: 70
            },
            warnings: this.generateHealthWarnings(stats, memoryUsageMB)
        };
    }

    generateHealthWarnings(stats, memoryUsageMB) {
        const warnings = [];
        
        if (stats.totalKeys > 1000) {
            warnings.push('High number of cached keys - consider memory optimization');
        }
        
        if (memoryUsageMB > 100) {
            warnings.push('High memory usage - consider reducing cache TTL');
        }
        
        const hitRate = parseFloat(stats.hitRate);
        if (hitRate < 70) {
            warnings.push('Low cache hit rate - review caching strategy');
        }
        
        return warnings;
    }

    /**
     * Cleanup method for periodic maintenance
     */
    cleanup() {
        console.log('🧹 캐시 정리 시작...');
        
        // 메모리 최적화 실행
        const removedKeys = this.optimizeMemory(500);
        
        // 통계 정보 로그
        const stats = this.getStats();
        console.log(`✅ 캐시 정리 완료 - 제거된 키: ${removedKeys}개, 현재 키: ${stats.totalKeys}개, 히트율: ${stats.hitRate}`);
        
        return {
            removedKeys,
            currentKeys: stats.totalKeys,
            hitRate: stats.hitRate
        };
    }

    /**
     * 캐시 무효화 (긴급 메모리 정리용)
     */
    invalidateCache(type = 'all') {
        console.log(`🗑️ 캐시 무효화 시작 - 타입: ${type}`);
        
        if (type === 'all') {
            // 전체 캐시 삭제
            const keyCount = this.memoryCache.keys().length;
            this.memoryCache.flushAll();
            
            // 통계 초기화
            this.stats.deletes += keyCount;
            
            console.log(`✅ 전체 캐시 무효화 완료 - ${keyCount}개 키 삭제`);
            return keyCount;
        } else {
            // 특정 타입 캐시만 삭제
            const keys = this.memoryCache.keys();
            const targetKeys = keys.filter(key => key.startsWith(`${type}:`));
            
            if (targetKeys.length > 0) {
                this.memoryCache.del(targetKeys);
                this.stats.deletes += targetKeys.length;
            }
            
            console.log(`✅ ${type} 캐시 무효화 완료 - ${targetKeys.length}개 키 삭제`);
            return targetKeys.length;
        }
    }
}

// Singleton instance
let cacheManagerInstance = null;

function getCacheManager() {
    if (!cacheManagerInstance) {
        cacheManagerInstance = new CacheManager();
    }
    return cacheManagerInstance;
}

// Export singleton instance directly for easier usage
module.exports = getCacheManager();

// Also export class and factory function for advanced usage
module.exports.CacheManager = CacheManager;
module.exports.getCacheManager = getCacheManager;