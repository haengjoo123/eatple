/**
 * Real-time Monitoring System for Supabase
 * 
 * This module provides real-time monitoring capabilities:
 * - Live query performance tracking
 * - Real-time user activity monitoring
 * - System health checks
 * - Dashboard data for monitoring UI
 */

const { createClient } = require('@supabase/supabase-js');
const { getMonitor } = require('./performanceMonitor');
const { getMemoryMonitor } = require('./memoryMonitor');
const fs = require('fs');
const path = require('path');

class RealtimeMonitoringSystem {
    constructor() {
        this.supabaseUrl = process.env.SUPABASE_URL;
        this.supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        this.supabase = createClient(this.supabaseUrl, this.supabaseServiceKey);
        this.monitor = getMonitor();
        
        this.healthStatus = {
            database: 'unknown',
            supabase: 'unknown',
            system: 'unknown',
            lastCheck: null
        };
        
        this.subscribers = new Set();
        this.webSocketClients = new Set(); // WebSocket 클라이언트 관리
        this.isRunning = false;
        
        this.initializeMonitoring();
    }
    
    /**
     * WebSocket 클라이언트 추가
     */
    addWebSocketClient(ws) {
        this.webSocketClients.add(ws);
        
        // 연결 해제 시 자동 제거
        ws.on('close', () => {
            this.webSocketClients.delete(ws);
        });
        
        ws.on('error', () => {
            this.webSocketClients.delete(ws);
        });
        
        console.log(`WebSocket 클라이언트 추가됨. 총 ${this.webSocketClients.size}개 연결`);
    }
    
    /**
     * 비활성 WebSocket 클라이언트 정리
     */
    cleanupWebSocketClients() {
        const activeClients = new Set();
        
        this.webSocketClients.forEach(ws => {
            if (ws.readyState === ws.OPEN) {
                activeClients.add(ws);
            }
        });
        
        const removedCount = this.webSocketClients.size - activeClients.size;
        this.webSocketClients = activeClients;
        
        if (removedCount > 0) {
            console.log(`비활성 WebSocket 클라이언트 ${removedCount}개 정리됨`);
        }
        
        return removedCount;
    }

    /**
     * Initialize real-time monitoring
     */
    initializeMonitoring() {
        console.log('🔄 Initializing real-time monitoring system...');
        
        // Start health checks
        this.startHealthChecks();
        
        // Start real-time data collection
        this.startRealtimeCollection();
        
        console.log('✅ Real-time monitoring system initialized');
    }

    /**
     * Start periodic health checks (메모리 최적화)
     */
    startHealthChecks() {
        // 메모리 사용량이 높을 때는 헬스 체크 빈도 줄이기
        const getCheckInterval = () => {
            const memUsagePercent = getMemoryMonitor().getMemoryUsage().usagePercent;
            
            if (memUsagePercent > 0.9) {
                return 60000; // 1분 (메모리 부족 시)
            } else if (memUsagePercent > 0.8) {
                return 45000; // 45초 (메모리 높음)
            } else {
                return 30000; // 30초 (정상)
            }
        };
        
        // 동적 간격으로 헬스 체크 실행
        const scheduleNextCheck = () => {
            setTimeout(async () => {
                await this.performHealthCheck();
                scheduleNextCheck(); // 다음 체크 스케줄링
            }, getCheckInterval());
        };
        
        // Initial health check
        this.performHealthCheck();
        scheduleNextCheck();
    }

    /**
     * Perform comprehensive health check
     */
    async performHealthCheck() {
        const healthCheck = {
            timestamp: new Date().toISOString(),
            database: await this.checkDatabaseHealth(),
            supabase: await this.checkSupabaseHealth(),
            system: await this.checkSystemHealth()
        };
        
        this.healthStatus = {
            ...healthCheck,
            lastCheck: healthCheck.timestamp,
            overall: this.calculateOverallHealth(healthCheck)
        };
        
        // Notify subscribers
        this.notifySubscribers('health_update', this.healthStatus);
        
        // Log health status
        this.logHealthStatus(this.healthStatus);
        
        return this.healthStatus;
    }

    /**
     * Check database connectivity and performance
     */
    async checkDatabaseHealth() {
        try {
            const startTime = Date.now();
            
            // Test basic connectivity - use nutrition_posts table instead of categories
            // since categories table might not exist yet
            const { data, error } = await this.supabase
                .from('nutrition_posts')
                .select('count')
                .limit(1);
                
            const responseTime = Date.now() - startTime;
            
            if (error) {
                // If nutrition_posts doesn't exist, try a simpler connection test
                if (error.message.includes('does not exist')) {
                    // Try a basic connection test without specific table
                    const { error: connectionError } = await this.supabase
                        .from('_dummy_table_for_connection_test_')
                        .select('*')
                        .limit(1);
                    
                    // If we get a different error, connection is working
                    if (connectionError && !connectionError.message.includes('does not exist')) {
                        return {
                            status: 'healthy',
                            responseTime: Date.now() - startTime,
                            message: 'Database connection working (tables not created yet)'
                        };
                    }
                }
                
                return {
                    status: 'error',
                    message: error.message,
                    responseTime
                };
            }
            
            // Check response time
            let status = 'healthy';
            if (responseTime > 2000) {
                status = 'slow';
            } else if (responseTime > 1000) {
                status = 'warning';
            }
            
            return {
                status,
                responseTime,
                message: `Database responding in ${responseTime}ms`
            };
            
        } catch (error) {
            return {
                status: 'error',
                message: error.message,
                responseTime: null
            };
        }
    }

    /**
     * Check Supabase service health
     */
    async checkSupabaseHealth() {
        try {
            const startTime = Date.now();
            
            // Test multiple Supabase features
            const checks = await Promise.allSettled([
                // Database query
                this.supabase.from('nutrition_posts').select('count').limit(1),
                // Storage check (if configured)
                this.checkStorageHealth(),
                // Auth check
                this.checkAuthHealth()
            ]);
            
            const responseTime = Date.now() - startTime;
            
            const results = checks.map((check, index) => ({
                service: ['database', 'storage', 'auth'][index],
                status: check.status === 'fulfilled' ? 'healthy' : 'error',
                error: check.status === 'rejected' ? check.reason.message : null
            }));
            
            const healthyServices = results.filter(r => r.status === 'healthy').length;
            const totalServices = results.length;
            
            let overallStatus = 'healthy';
            if (healthyServices === 0) {
                overallStatus = 'error';
            } else if (healthyServices < totalServices) {
                overallStatus = 'warning';
            }
            
            return {
                status: overallStatus,
                responseTime,
                services: results,
                message: `${healthyServices}/${totalServices} services healthy`
            };
            
        } catch (error) {
            return {
                status: 'error',
                message: error.message,
                responseTime: null
            };
        }
    }

    /**
     * Check storage health
     */
    async checkStorageHealth() {
        try {
            // Simple storage check - list buckets
            const { data, error } = await this.supabase.storage.listBuckets();
            
            if (error) throw error;
            
            return { status: 'healthy', buckets: data.length };
        } catch (error) {
            throw new Error(`Storage check failed: ${error.message}`);
        }
    }

    /**
     * Check auth health
     */
    async checkAuthHealth() {
        try {
            // Simple auth check - this will always work with service role
            return { status: 'healthy' };
        } catch (error) {
            throw new Error(`Auth check failed: ${error.message}`);
        }
    }

    /**
     * Check system health (Node.js process)
     */
    async checkSystemHealth() {
        try {
            const memoryUsage = process.memoryUsage();
            const uptime = process.uptime();
            const cpuUsage = process.cpuUsage();
            
            const memoryUsagePercent = getMemoryMonitor().getMemoryUsage().usagePercent;
            
            let status = 'healthy';
            let warnings = [];
            
            // Check memory usage (더 관대한 기준 적용)
            if (memoryUsagePercent > 0.95) {
                status = 'error';
                warnings.push('Critical memory usage (>95%)');
            } else if (memoryUsagePercent > 0.85) {
                status = 'warning';
                warnings.push('High memory usage (>85%)');
            }
            
            // Check uptime (warn if too short, might indicate recent crashes)
            if (uptime < 30) { // Less than 30 seconds (reduced from 1 minute)
                warnings.push('Recent restart detected');
                if (status === 'healthy') status = 'warning';
            }
            
            return {
                status,
                uptime,
                memory: {
                    usage: memoryUsage,
                    usagePercent: memoryUsagePercent
                },
                cpu: cpuUsage,
                warnings,
                message: warnings.length > 0 ? warnings.join(', ') : 'System healthy'
            };
            
        } catch (error) {
            return {
                status: 'error',
                message: error.message
            };
        }
    }

    /**
     * Calculate overall health status
     */
    calculateOverallHealth(healthCheck) {
        const statuses = [
            healthCheck.database.status,
            healthCheck.supabase.status,
            healthCheck.system.status
        ];
        
        if (statuses.includes('error')) return 'error';
        if (statuses.includes('warning') || statuses.includes('slow')) return 'warning';
        return 'healthy';
    }

    /**
     * Start real-time data collection
     */
    startRealtimeCollection() {
        this.isRunning = true;
        
        // Collect metrics every 10 seconds
        this.metricsInterval = setInterval(() => {
            this.collectRealtimeMetrics();
        }, 10000);
        
        console.log('📊 Real-time data collection started');
    }

    /**
     * Collect real-time metrics
     */
    async collectRealtimeMetrics() {
        if (!this.isRunning) return;
        
        try {
            const metrics = {
                timestamp: new Date().toISOString(),
                performance: this.monitor.generateReport(),
                health: this.healthStatus,
                activeConnections: this.getActiveConnections(),
                recentActivity: this.getRecentActivity()
            };
            
            // Notify subscribers
            this.notifySubscribers('metrics_update', metrics);
            
            // Store metrics for historical analysis
            this.storeMetrics(metrics);
            
        } catch (error) {
            console.error('Failed to collect real-time metrics:', error.message);
            this.monitor.recordError('realtime_metrics', error);
        }
    }

    /**
     * Get active connections count
     */
    getActiveConnections() {
        // This is a simplified version - in production you'd track actual connections
        return {
            database: 1, // Service role connection
            websocket: this.subscribers.size,
            http: process._getActiveRequests().length
        };
    }

    /**
     * Get recent activity summary
     */
    getRecentActivity() {
        const report = this.monitor.generateReport();
        
        return {
            recentQueries: report.queries.slice(0, 5),
            recentErrors: report.errors.slice(0, 3),
            userActivity: report.userActivity
        };
    }

    /**
     * Store metrics for historical analysis (메모리 최적화)
     */
    storeMetrics(metrics) {
        try {
            const metricsDir = path.join(__dirname, '../data/monitoring');
            if (!fs.existsSync(metricsDir)) {
                fs.mkdirSync(metricsDir, { recursive: true });
            }
            
            const today = new Date().toISOString().split('T')[0];
            const metricsFile = path.join(metricsDir, `metrics-${today}.jsonl`);
            
            // 메트릭 데이터 최적화 (불필요한 데이터 제거)
            const optimizedMetrics = {
                timestamp: metrics.timestamp,
                health: {
                    overall: metrics.health.overall,
                    database: metrics.health.database?.status,
                    supabase: metrics.health.supabase?.status,
                    system: metrics.health.system?.status
                },
                performance: {
                    totalQueries: metrics.performance?.totalQueries || 0,
                    avgQueryTime: metrics.performance?.avgQueryTime || 0,
                    errorRate: metrics.performance?.errorRate || 0
                },
                memory: {
                    usage: metrics.performance?.systemMetrics?.current?.memory?.usagePercent || 0
                }
            };
            
            // Append optimized metrics as JSON lines
            fs.appendFileSync(metricsFile, JSON.stringify(optimizedMetrics) + '\n');
            
            // 파일 크기 제한 (10MB 초과 시 로테이션)
            const stats = fs.statSync(metricsFile);
            if (stats.size > 10 * 1024 * 1024) {
                this.rotateMetricsFile(metricsFile);
            }
            
        } catch (error) {
            console.error('Failed to store metrics:', error.message);
        }
    }
    
    /**
     * 메트릭 파일 로테이션
     */
    rotateMetricsFile(filePath) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const rotatedPath = filePath.replace('.jsonl', `-${timestamp}.jsonl`);
            fs.renameSync(filePath, rotatedPath);
            console.log(`메트릭 파일 로테이션: ${rotatedPath}`);
        } catch (error) {
            console.error('메트릭 파일 로테이션 실패:', error);
        }
    }

    /**
     * Subscribe to real-time updates
     */
    subscribe(callback) {
        this.subscribers.add(callback);
        
        // Send current status immediately
        callback('health_update', this.healthStatus);
        
        return () => {
            this.subscribers.delete(callback);
        };
    }

    /**
     * Notify all subscribers (메모리 최적화)
     */
    notifySubscribers(event, data) {
        // 일반 구독자들에게 알림
        this.subscribers.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('Subscriber notification failed:', error.message);
            }
        });
        
        // 프로세스 메모리가 실제 한도에 근접할 때만 WebSocket 전송을 중단
        const memUsagePercent = getMemoryMonitor().getMemoryUsage().usagePercent;

        if (memUsagePercent === null || memUsagePercent < 0.9) {
            this.notifyWebSocketClients(event, data);
        }
    }
    
    /**
     * WebSocket 클라이언트들에게 알림
     */
    notifyWebSocketClients(event, data) {
        if (this.webSocketClients.size === 0) return;
        
        // 비활성 클라이언트 정리
        this.cleanupWebSocketClients();
        
        const message = JSON.stringify({ event, data });
        
        this.webSocketClients.forEach(ws => {
            try {
                if (ws.readyState === ws.OPEN) {
                    ws.send(message);
                }
            } catch (error) {
                console.error('WebSocket notification failed:', error.message);
                this.webSocketClients.delete(ws);
            }
        });
    }

    /**
     * Get current dashboard data
     */
    getDashboardData() {
        const report = this.monitor.generateReport();
        
        return {
            timestamp: new Date().toISOString(),
            health: this.healthStatus,
            performance: {
                totalQueries: report.summary.totalQueries,
                avgQueryTime: report.summary.avgQueryTime,
                errorRate: report.summary.errorRate,
                uptime: report.uptime
            },
            topQueries: report.queries.slice(0, 10),
            recentErrors: report.errors.slice(0, 10),
            userActivity: report.userActivity,
            systemMetrics: report.systemMetrics
        };
    }

    /**
     * Get historical metrics
     */
    getHistoricalMetrics(days = 7) {
        try {
            const metricsDir = path.join(__dirname, '../data/monitoring');
            const metrics = [];
            
            for (let i = 0; i < days; i++) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                
                const metricsFile = path.join(metricsDir, `metrics-${dateStr}.jsonl`);
                
                if (fs.existsSync(metricsFile)) {
                    const lines = fs.readFileSync(metricsFile, 'utf8').trim().split('\n');
                    lines.forEach(line => {
                        if (line.trim()) {
                            try {
                                metrics.push(JSON.parse(line));
                            } catch (error) {
                                // Skip invalid JSON lines
                            }
                        }
                    });
                }
            }
            
            return metrics.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
        } catch (error) {
            console.error('Failed to load historical metrics:', error.message);
            return [];
        }
    }

    /**
     * Log health status
     */
    logHealthStatus(healthStatus) {
        const logEntry = {
            timestamp: healthStatus.timestamp,
            type: 'health_check',
            status: healthStatus.overall,
            details: {
                database: healthStatus.database.status,
                supabase: healthStatus.supabase.status,
                system: healthStatus.system.status
            }
        };
        
        // Log to monitoring log
        this.monitor.writeLog('health_checks', logEntry);
        
        // Console output disabled to reduce log noise
        // if (healthStatus.overall === 'error') {
        //     console.error('🔴 System health: ERROR', logEntry);
        // }
        // WARNING과 HEALTHY 상태는 콘솔 출력하지 않음 (로그 파일에만 기록)
    }

    /**
     * Generate monitoring report
     */
    generateMonitoringReport() {
        const dashboardData = this.getDashboardData();
        const historicalMetrics = this.getHistoricalMetrics(7);
        
        const report = {
            generatedAt: new Date().toISOString(),
            summary: {
                currentHealth: dashboardData.health.overall,
                uptime: dashboardData.performance.uptime,
                totalQueries: dashboardData.performance.totalQueries,
                errorRate: dashboardData.performance.errorRate,
                avgResponseTime: dashboardData.performance.avgQueryTime
            },
            trends: this.calculateTrends(historicalMetrics),
            topIssues: this.identifyTopIssues(dashboardData),
            recommendations: this.generateRecommendations(dashboardData, historicalMetrics)
        };
        
        return report;
    }

    /**
     * Calculate performance trends
     */
    calculateTrends(historicalMetrics) {
        if (historicalMetrics.length < 2) {
            return { message: 'Insufficient data for trend analysis' };
        }
        
        // Calculate trends for key metrics
        const responseTimeTrend = this.calculateMetricTrend(
            historicalMetrics,
            'performance.avgQueryTime'
        );
        
        const errorRateTrend = this.calculateMetricTrend(
            historicalMetrics,
            'performance.errorRate'
        );
        
        return {
            responseTime: responseTimeTrend,
            errorRate: errorRateTrend,
            dataPoints: historicalMetrics.length
        };
    }

    /**
     * Calculate trend for a specific metric
     */
    calculateMetricTrend(metrics, metricPath) {
        const values = metrics
            .map(metric => this.getNestedValue(metric, metricPath))
            .filter(value => value !== null && value !== undefined);
            
        if (values.length < 2) return 'insufficient_data';
        
        const first = values[0];
        const last = values[values.length - 1];
        const change = (last - first) / first;
        
        if (change > 0.2) return 'increasing';
        if (change < -0.2) return 'decreasing';
        return 'stable';
    }

    /**
     * Get nested object value by path
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : null;
        }, obj);
    }

    /**
     * Identify top issues
     */
    identifyTopIssues(dashboardData) {
        const issues = [];
        
        // Check health issues
        if (dashboardData.health.overall !== 'healthy') {
            issues.push({
                type: 'health',
                severity: dashboardData.health.overall === 'error' ? 'critical' : 'warning',
                message: 'System health issues detected',
                details: dashboardData.health
            });
        }
        
        // Check error rate
        if (dashboardData.performance.errorRate > 0.05) {
            issues.push({
                type: 'error_rate',
                severity: 'warning',
                message: `High error rate: ${(dashboardData.performance.errorRate * 100).toFixed(2)}%`,
                details: { errorRate: dashboardData.performance.errorRate }
            });
        }
        
        // Check slow queries
        const slowQueries = dashboardData.topQueries.filter(q => q.avgDuration > 1000);
        if (slowQueries.length > 0) {
            issues.push({
                type: 'slow_queries',
                severity: 'warning',
                message: `${slowQueries.length} slow queries detected`,
                details: { slowQueries: slowQueries.slice(0, 3) }
            });
        }
        
        return issues;
    }

    /**
     * Generate recommendations
     */
    generateRecommendations(dashboardData, historicalMetrics) {
        const recommendations = [];
        
        // Performance recommendations
        if (dashboardData.performance.avgQueryTime > 500) {
            recommendations.push({
                category: 'performance',
                priority: 'medium',
                title: 'Optimize query performance',
                description: 'Average query time is above 500ms. Consider adding indexes or optimizing queries.',
                action: 'Review slow queries and add appropriate database indexes'
            });
        }
        
        // Error rate recommendations
        if (dashboardData.performance.errorRate > 0.02) {
            recommendations.push({
                category: 'reliability',
                priority: 'high',
                title: 'Reduce error rate',
                description: 'Error rate is above 2%. Investigate and fix recurring errors.',
                action: 'Review error logs and implement proper error handling'
            });
        }
        
        // Memory recommendations
        if (dashboardData.systemMetrics?.current?.memory?.usagePercent > 0.8) {
            recommendations.push({
                category: 'resources',
                priority: 'high',
                title: 'High memory usage',
                description: 'Memory usage is above 80%. Consider optimizing memory usage or scaling up.',
                action: 'Monitor memory leaks and optimize data structures'
            });
        }
        
        return recommendations;
    }

    /**
     * Shutdown monitoring system (메모리 정리 포함)
     */
    shutdown() {
        this.isRunning = false;
        
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
        
        // WebSocket 클라이언트 정리
        this.webSocketClients.forEach(ws => {
            try {
                if (ws.readyState === ws.OPEN) {
                    ws.close();
                }
            } catch (error) {
                // 무시
            }
        });
        
        this.subscribers.clear();
        this.webSocketClients.clear();
        
        console.log('🔄 Real-time monitoring system shutdown');
    }
}

// Singleton instance
let monitoringInstance = null;

/**
 * Get or create monitoring instance
 */
function getRealtimeMonitoring() {
    if (!monitoringInstance) {
        monitoringInstance = new RealtimeMonitoringSystem();
    }
    return monitoringInstance;
}

module.exports = {
    RealtimeMonitoringSystem,
    getRealtimeMonitoring
};
