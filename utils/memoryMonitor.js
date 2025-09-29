/**
 * 메모리 모니터링 및 최적화 유틸리티
 */

class MemoryMonitor {
    constructor() {
        this.alertThresholds = {
            warning: 0.75,  // 75% (더 이른 경고)
            critical: 0.90  // 90% (더 이른 긴급 조치)
        };
        
        this.lastAlert = {
            warning: 0,
            critical: 0
        };
        
        this.alertCooldown = 5 * 60 * 1000; // 5분 쿨다운
        
        console.log('🧠 메모리 모니터 초기화 완료');
    }
    
    /**
     * 현재 메모리 사용량 조회
     */
    getMemoryUsage() {
        const usage = process.memoryUsage();
        const usagePercent = usage.heapUsed / usage.heapTotal;
        
        return {
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
            rss: Math.round(usage.rss / 1024 / 1024), // MB
            external: Math.round(usage.external / 1024 / 1024), // MB
            usagePercent: Math.round(usagePercent * 100) / 100,
            status: this.getMemoryStatus(usagePercent)
        };
    }
    
    /**
     * 메모리 상태 판단
     */
    getMemoryStatus(usagePercent) {
        if (usagePercent >= this.alertThresholds.critical) {
            return 'critical';
        } else if (usagePercent >= this.alertThresholds.warning) {
            return 'warning';
        } else {
            return 'healthy';
        }
    }
    
    /**
     * 메모리 사용량 체크 및 알림
     */
    checkMemoryUsage() {
        const memoryInfo = this.getMemoryUsage();
        const now = Date.now();
        
        // 임계 상태 알림
        if (memoryInfo.status === 'critical' && 
            now - this.lastAlert.critical > this.alertCooldown) {
            
            this.sendAlert('critical', memoryInfo);
            this.lastAlert.critical = now;
            
            // 긴급 메모리 정리 실행
            this.emergencyCleanup().catch(error => {
                console.error('긴급 메모리 정리 중 오류:', error);
            });
            
        } else if (memoryInfo.status === 'warning' && 
                   now - this.lastAlert.warning > this.alertCooldown) {
            
            this.sendAlert('warning', memoryInfo);
            this.lastAlert.warning = now;
        }
        
        return memoryInfo;
    }
    
    /**
     * 메모리 알림 전송
     */
    sendAlert(level, memoryInfo) {
        const alertData = {
            timestamp: new Date().toISOString(),
            type: 'high_memory_usage',
            data: {
                usage: memoryInfo.usagePercent,
                metrics: {
                    timestamp: new Date().toISOString(),
                    memory: {
                        rss: memoryInfo.rss * 1024 * 1024,
                        heapTotal: memoryInfo.heapTotal * 1024 * 1024,
                        heapUsed: memoryInfo.heapUsed * 1024 * 1024,
                        external: memoryInfo.external * 1024 * 1024,
                        arrayBuffers: process.memoryUsage().arrayBuffers || 0
                    },
                    uptime: process.uptime(),
                    cpu: process.cpuUsage(),
                    activeHandles: process._getActiveHandles().length,
                    activeRequests: process._getActiveRequests().length
                }
            },
            severity: level
        };
        
        // 콘솔 출력
        if (level === 'critical') {
            console.error('🚨 Alert: high_memory_usage', alertData);
        } else {
            console.warn('⚠️ Alert: high_memory_usage', alertData);
        }
        
        // 로그 파일에 기록
        this.writeAlertLog(alertData);
    }
    
    /**
     * 알림 로그 기록
     */
    writeAlertLog(alertData) {
        try {
            const fs = require('fs');
            const path = require('path');
            
            const logDir = path.join(__dirname, '../logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            
            const logFile = path.join(logDir, 'alerts.log');
            fs.appendFileSync(logFile, JSON.stringify(alertData) + '\n');
            
        } catch (error) {
            console.error('알림 로그 기록 실패:', error);
        }
    }
    
    /**
     * 긴급 메모리 정리
     */
    async emergencyCleanup() {
        console.log('🚨 긴급 메모리 정리 시작...');
        
        try {
            // 캐시 매니저 정리
            const { getCacheManager } = require('./cacheManager');
            const cacheManager = getCacheManager();
            
            // 긴급 상황에서는 단계적 캐시 정리
            console.log('1단계: 긴급 메모리 최적화 실행');
            cacheManager.emergencyOptimization();
            
            // 메모리 사용량 재확인
            let memoryCheck = this.getMemoryUsage();
            console.log(`1단계 후 메모리 사용량: ${memoryCheck.usagePercent * 100}%`);
            
            // 여전히 높으면 전체 캐시 삭제
            if (memoryCheck.usagePercent > 0.85) {
                console.log('2단계: 전체 캐시 무효화 실행');
                cacheManager.invalidateCache('all');
            }
            
            // 다른 캐시 매니저들도 정리
            try {
                const nutritionDataManager = require('./nutritionDataManager');
                if (nutritionDataManager && typeof nutritionDataManager.invalidateCache === 'function') {
                    nutritionDataManager.invalidateCache();
                }
            } catch (error) {
                console.log('영양 데이터 캐시 정리 건너뜀:', error.message);
            }
            
            try {
                const fileCacheManager = require('./fileCacheManager');
                if (fileCacheManager && typeof fileCacheManager.clearAll === 'function') {
                    await fileCacheManager.clearAll();
                }
                
                // 대용량 영양정보 캐시 파일 삭제
                const fs = require('fs').promises;
                const path = require('path');
                const cacheDir = path.join(__dirname, '../data/cache');
                
                try {
                    const files = await fs.readdir(cacheDir);
                    let deletedSize = 0;
                    
                    for (const file of files) {
                        if (file.includes('nutrition_detail') && file.endsWith('.json')) {
                            const filePath = path.join(cacheDir, file);
                            const stats = await fs.stat(filePath);
                            
                            // 5MB 이상 파일 삭제
                            if (stats.size > 5 * 1024 * 1024) {
                                await fs.unlink(filePath);
                                deletedSize += stats.size;
                            }
                        }
                    }
                    
                    if (deletedSize > 0) {
                        console.log(`🗑️ 대용량 영양정보 캐시 파일 정리: ${Math.round(deletedSize / 1024 / 1024)}MB 절약`);
                    }
                } catch (cacheError) {
                    console.log('영양정보 캐시 파일 정리 중 오류:', cacheError.message);
                }
                
            } catch (error) {
                console.log('파일 캐시 정리 건너뜀:', error.message);
            }
            
            // 가비지 컬렉션 강제 실행
            if (global.gc) {
                global.gc();
                console.log('가비지 컬렉션 강제 실행 완료');
            } else {
                console.log('가비지 컬렉션을 사용하려면 --expose-gc 플래그로 Node.js를 시작하세요');
            }
            
            // 메모리 사용량 재확인
            const afterCleanup = this.getMemoryUsage();
            console.log(`긴급 정리 후 메모리 사용량: ${afterCleanup.usagePercent * 100}%`);
            
        } catch (error) {
            console.error('긴급 메모리 정리 실패:', error);
        }
    }
    
    /**
     * 메모리 사용량 추이 분석
     */
    analyzeMemoryTrend(samples = []) {
        if (samples.length < 2) {
            return { trend: 'insufficient_data' };
        }
        
        const recent = samples.slice(-5); // 최근 5개 샘플
        const avgRecent = recent.reduce((sum, sample) => sum + sample.usagePercent, 0) / recent.length;
        
        const older = samples.slice(-10, -5); // 이전 5개 샘플
        if (older.length === 0) {
            return { trend: 'insufficient_data' };
        }
        
        const avgOlder = older.reduce((sum, sample) => sum + sample.usagePercent, 0) / older.length;
        
        const change = (avgRecent - avgOlder) / avgOlder;
        
        let trend = 'stable';
        if (change > 0.1) {
            trend = 'increasing';
        } else if (change < -0.1) {
            trend = 'decreasing';
        }
        
        return {
            trend,
            change: Math.round(change * 100),
            avgRecent: Math.round(avgRecent * 100),
            avgOlder: Math.round(avgOlder * 100)
        };
    }
    
    /**
     * 메모리 최적화 권장사항
     */
    getOptimizationRecommendations(memoryInfo) {
        const recommendations = [];
        
        if (memoryInfo.usagePercent > 0.9) {
            recommendations.push({
                priority: 'high',
                action: 'immediate_cleanup',
                description: '즉시 캐시 정리 및 가비지 컬렉션 실행 필요'
            });
        }
        
        if (memoryInfo.usagePercent > 0.8) {
            recommendations.push({
                priority: 'medium',
                action: 'reduce_cache_ttl',
                description: '캐시 TTL 단축으로 메모리 사용량 감소'
            });
        }
        
        if (memoryInfo.external > 100) { // 100MB 이상
            recommendations.push({
                priority: 'medium',
                action: 'optimize_external_memory',
                description: '외부 메모리 사용량 최적화 (버퍼, 스트림 등)'
            });
        }
        
        return recommendations;
    }
}

// 싱글톤 인스턴스
let memoryMonitorInstance = null;

function getMemoryMonitor() {
    if (!memoryMonitorInstance) {
        memoryMonitorInstance = new MemoryMonitor();
    }
    return memoryMonitorInstance;
}

module.exports = {
    MemoryMonitor,
    getMemoryMonitor
};