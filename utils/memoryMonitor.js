/**
 * 메모리 모니터링 및 최적화 유틸리티
 */

const fs = require('fs');

function detectMemoryLimitBytes() {
    // Render 등 Linux 컨테이너의 실제 메모리 한도 (cgroup v2 / v1)
    for (const file of [
        '/sys/fs/cgroup/memory.max',
        '/sys/fs/cgroup/memory/memory.limit_in_bytes'
    ]) {
        try {
            const limit = Number(fs.readFileSync(file, 'utf8').trim());
            if (Number.isSafeInteger(limit) && limit > 0) return limit;
        } catch (_) {
            // 컨테이너가 아니거나 다른 cgroup 버전이면 다음 방법으로 확인
        }
    }

    const limit = process.constrainedMemory?.();
    return Number.isSafeInteger(limit) && limit > 0 ? limit : null;
}

class MemoryMonitor {
    constructor({ memoryLimitBytes = detectMemoryLimitBytes(), getProcessMemoryUsage = () => process.memoryUsage() } = {}) {
        this.memoryLimitBytes = memoryLimitBytes;
        this.getProcessMemoryUsage = getProcessMemoryUsage;
        this.alertThresholds = {
            warning: 0.85,  // 85% (경고)
            critical: 0.95  // 95% (긴급 조치)
        };
        
        this.lastAlert = {
            warning: 0,
            critical: 0
        };
        
        this.alertCooldown = 5 * 60 * 1000; // 5분 쿨다운
        
    }
    
    /**
     * 현재 메모리 사용량 조회
     */
    getMemoryUsage() {
        const usage = this.getProcessMemoryUsage();
        const usagePercent = this.memoryLimitBytes > 0
            ? usage.rss / this.memoryLimitBytes
            : null;
        const heapUsagePercent = usage.heapTotal > 0
            ? usage.heapUsed / usage.heapTotal
            : 0;
        
        return {
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
            rss: Math.round(usage.rss / 1024 / 1024), // MB
            external: Math.round(usage.external / 1024 / 1024), // MB
            memoryLimit: this.memoryLimitBytes > 0 ? Math.round(this.memoryLimitBytes / 1024 / 1024) : null,
            usagePercent: usagePercent === null ? null : Math.round(usagePercent * 100) / 100,
            heapUsagePercent: Math.round(heapUsagePercent * 100) / 100,
            status: this.getMemoryStatus(usagePercent)
        };
    }
    
    /**
     * 메모리 상태 판단
     */
    getMemoryStatus(usagePercent) {
        if (usagePercent === null || !Number.isFinite(usagePercent)) {
            return 'unknown';
        }
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
                        limit: this.memoryLimitBytes,
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
        
        try {
            const { getCacheManager } = require('./cacheManager');
            const cacheManager = getCacheManager();
            if (cacheManager.getStats().totalKeys > 0) {
                cacheManager.emergencyOptimization();

                // 캐시 정리 후에도 임계 상태라면 남은 메모리 캐시를 비움
                if (this.getMemoryUsage().status === 'critical' &&
                    cacheManager.getStats().totalKeys > 0) {
                    cacheManager.invalidateCache('all');
                }
            }

            const afterCleanup = this.getMemoryUsage();
            console.log(`긴급 정리 후 프로세스 메모리: ${afterCleanup.rss}MB / ${afterCleanup.memoryLimit}MB`);
            
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

        if (memoryInfo.status === 'critical') {
            recommendations.push({
                priority: 'high',
                action: 'investigate_process_memory',
                description: '프로세스 RSS가 메모리 한도에 근접했습니다. 활성 요청과 메모리 사용 추이를 확인하세요'
            });
        } else if (memoryInfo.status === 'warning') {
            recommendations.push({
                priority: 'medium',
                action: 'monitor_process_memory',
                description: '프로세스 RSS 사용량과 증가 추이를 확인하세요'
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
    getMemoryMonitor,
    detectMemoryLimitBytes
};
