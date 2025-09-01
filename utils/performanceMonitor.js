/**
 * Performance Monitoring System
 * 
 * This module provides comprehensive monitoring for:
 * - Supabase query performance
 * - User activity tracking
 * - System performance metrics
 * - Error tracking and alerting
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

class PerformanceMonitor {
    constructor() {
        this.supabaseUrl = process.env.SUPABASE_URL;
        this.supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        this.supabase = createClient(this.supabaseUrl, this.supabaseServiceKey);
        
        this.metrics = {
            queries: new Map(),
            userActivity: new Map(),
            systemMetrics: new Map(),
            errors: []
        };
        
        this.config = this.loadConfig();
        this.startTime = Date.now();
        
        // Initialize monitoring
        this.initializeMonitoring();
    }

    /**
     * Load monitoring configuration
     */
    loadConfig() {
        try {
            const configPath = path.join(__dirname, '../config/monitoring-config.json');
            if (fs.existsSync(configPath)) {
                return JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }
        } catch (error) {
            console.warn('Could not load monitoring config, using defaults');
        }
        
        return {
            metrics: {
                database: { queryPerformance: true, slowQueries: { threshold: 1000 } },
                application: { responseTime: true, errorRate: true, userActivity: true }
            },
            alerts: {
                slowQueries: { threshold: 1000, enabled: true },
                highErrorRate: { threshold: 0.05, enabled: true }
            },
            logging: { level: 'info', retention: '30 days' }
        };
    }

    /**
     * Initialize monitoring systems
     */
    initializeMonitoring() {
        // Start periodic metric collection
        this.metricsInterval = setInterval(() => {
            this.collectSystemMetrics();
        }, 30000); // Every 30 seconds
        
        // Start log rotation
        this.logRotationInterval = setInterval(() => {
            this.rotateLogFiles();
        }, 24 * 60 * 60 * 1000); // Daily
        
        console.log('📊 Performance monitoring initialized');
    }

    /**
     * Monitor Supabase query performance
     */
    async monitorQuery(queryName, queryFunction, context = {}) {
        const startTime = Date.now();
        const queryId = `${queryName}_${Date.now()}`;
        
        try {
            // Execute the query
            const result = await queryFunction();
            const duration = Date.now() - startTime;
            
            // Record metrics
            this.recordQueryMetrics(queryName, duration, true, context);
            
            // Check for slow queries
            if (duration > this.config.metrics.database.slowQueries.threshold) {
                this.handleSlowQuery(queryName, duration, context);
            }
            
            return result;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            // Record error metrics
            this.recordQueryMetrics(queryName, duration, false, context, error);
            this.recordError('database_query', error, { queryName, context });
            
            throw error;
        }
    }

    /**
     * Record query performance metrics
     */
    recordQueryMetrics(queryName, duration, success, context, error = null) {
        const timestamp = new Date().toISOString();
        
        if (!this.metrics.queries.has(queryName)) {
            this.metrics.queries.set(queryName, {
                totalCalls: 0,
                totalDuration: 0,
                successCount: 0,
                errorCount: 0,
                avgDuration: 0,
                maxDuration: 0,
                minDuration: Infinity,
                recentCalls: []
            });
        }
        
        const queryMetrics = this.metrics.queries.get(queryName);
        
        // Update metrics
        queryMetrics.totalCalls++;
        queryMetrics.totalDuration += duration;
        
        if (success) {
            queryMetrics.successCount++;
        } else {
            queryMetrics.errorCount++;
        }
        
        queryMetrics.avgDuration = queryMetrics.totalDuration / queryMetrics.totalCalls;
        queryMetrics.maxDuration = Math.max(queryMetrics.maxDuration, duration);
        queryMetrics.minDuration = Math.min(queryMetrics.minDuration, duration);
        
        // Keep recent calls for analysis
        queryMetrics.recentCalls.push({
            timestamp,
            duration,
            success,
            context,
            error: error ? error.message : null
        });
        
        // Keep only last 100 calls
        if (queryMetrics.recentCalls.length > 100) {
            queryMetrics.recentCalls.shift();
        }
        
        // Log to file
        this.logQueryMetrics(queryName, duration, success, context, error);
    }

    /**
     * Track user activity
     */
    trackUserActivity(userId, action, details = {}) {
        const timestamp = new Date().toISOString();
        const sessionId = details.sessionId || 'anonymous';
        
        if (!this.metrics.userActivity.has(userId)) {
            this.metrics.userActivity.set(userId, {
                totalActions: 0,
                sessions: new Set(),
                recentActivity: [],
                firstSeen: timestamp,
                lastSeen: timestamp
            });
        }
        
        const userMetrics = this.metrics.userActivity.get(userId);
        
        // Update metrics
        userMetrics.totalActions++;
        userMetrics.sessions.add(sessionId);
        userMetrics.lastSeen = timestamp;
        
        // Record activity
        userMetrics.recentActivity.push({
            timestamp,
            action,
            details,
            sessionId
        });
        
        // Keep only last 50 activities per user
        if (userMetrics.recentActivity.length > 50) {
            userMetrics.recentActivity.shift();
        }
        
        // Log activity
        this.logUserActivity(userId, action, details);
    }

    /**
     * Record system errors
     */
    recordError(type, error, context = {}) {
        const timestamp = new Date().toISOString();
        
        const errorRecord = {
            timestamp,
            type,
            message: error.message,
            stack: error.stack,
            context,
            severity: this.determineSeverity(error, context)
        };
        
        this.metrics.errors.push(errorRecord);
        
        // Keep only last 1000 errors
        if (this.metrics.errors.length > 1000) {
            this.metrics.errors.shift();
        }
        
        // Check error rate
        this.checkErrorRate();
        
        // Log error
        this.logError(errorRecord);
        
        // Send alert if critical
        if (errorRecord.severity === 'critical') {
            this.sendAlert('critical_error', errorRecord);
        }
    }

    /**
     * Collect system performance metrics
     */
    collectSystemMetrics() {
        const timestamp = new Date().toISOString();
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();
        
        const systemMetrics = {
            timestamp,
            memory: {
                rss: memoryUsage.rss,
                heapTotal: memoryUsage.heapTotal,
                heapUsed: memoryUsage.heapUsed,
                external: memoryUsage.external,
                arrayBuffers: memoryUsage.arrayBuffers
            },
            uptime,
            cpu: process.cpuUsage(),
            activeHandles: process._getActiveHandles().length,
            activeRequests: process._getActiveRequests().length
        };
        
        this.metrics.systemMetrics.set(timestamp, systemMetrics);
        
        // Keep only last 24 hours of metrics (assuming 30s intervals)
        const maxEntries = 24 * 60 * 2; // 2880 entries
        if (this.metrics.systemMetrics.size > maxEntries) {
            const oldestKey = this.metrics.systemMetrics.keys().next().value;
            this.metrics.systemMetrics.delete(oldestKey);
        }
        
        // Check for memory issues (disabled to reduce log noise)
        // const memoryUsagePercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
        // if (memoryUsagePercent > 0.95) {
        //     this.sendAlert('high_memory_usage', { usage: memoryUsagePercent, metrics: systemMetrics });
        // }
    }

    /**
     * Handle slow query detection
     */
    handleSlowQuery(queryName, duration, context) {
        const slowQueryRecord = {
            timestamp: new Date().toISOString(),
            queryName,
            duration,
            context,
            threshold: this.config.metrics.database.slowQueries.threshold
        };
        
        console.warn(`🐌 Slow query detected: ${queryName} took ${duration}ms`);
        
        // Log slow query
        this.logSlowQuery(slowQueryRecord);
        
        // Send alert if enabled
        if (this.config.alerts.slowQueries.enabled) {
            this.sendAlert('slow_query', slowQueryRecord);
        }
    }

    /**
     * Check error rate and send alerts
     */
    checkErrorRate() {
        const recentErrors = this.metrics.errors.filter(error => {
            const errorTime = new Date(error.timestamp).getTime();
            const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
            return errorTime > fiveMinutesAgo;
        });
        
        const totalQueries = Array.from(this.metrics.queries.values())
            .reduce((sum, query) => sum + query.totalCalls, 0);
            
        if (totalQueries > 0) {
            const errorRate = recentErrors.length / totalQueries;
            
            if (errorRate > this.config.alerts.highErrorRate.threshold) {
                this.sendAlert('high_error_rate', {
                    errorRate,
                    recentErrors: recentErrors.length,
                    totalQueries,
                    threshold: this.config.alerts.highErrorRate.threshold
                });
            }
        }
    }

    /**
     * Determine error severity
     */
    determineSeverity(error, context) {
        // Database connection errors are critical
        if (error.message.includes('connection') || error.message.includes('timeout')) {
            return 'critical';
        }
        
        // Authentication errors are warnings
        if (error.message.includes('auth') || error.message.includes('permission')) {
            return 'warning';
        }
        
        // Validation errors are info
        if (error.message.includes('validation') || error.message.includes('invalid')) {
            return 'info';
        }
        
        // Default to warning
        return 'warning';
    }

    /**
     * Send monitoring alerts
     */
    sendAlert(type, data) {
        const alert = {
            timestamp: new Date().toISOString(),
            type,
            data,
            severity: data.severity || 'warning'
        };
        
        console.warn(`🚨 Alert: ${type}`, alert);
        
        // In production, this would send to external alerting systems
        // For now, just log to file
        this.logAlert(alert);
    }

    /**
     * Generate performance report
     */
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            uptime: Date.now() - this.startTime,
            summary: {
                totalQueries: Array.from(this.metrics.queries.values())
                    .reduce((sum, query) => sum + query.totalCalls, 0),
                totalErrors: this.metrics.errors.length,
                uniqueUsers: this.metrics.userActivity.size,
                avgQueryTime: this.calculateAverageQueryTime(),
                errorRate: this.calculateErrorRate()
            },
            queries: this.getTopQueries(),
            errors: this.getRecentErrors(),
            userActivity: this.getUserActivitySummary(),
            systemMetrics: this.getSystemMetricsSummary()
        };
        
        return report;
    }

    /**
     * Calculate average query time across all queries
     */
    calculateAverageQueryTime() {
        const queries = Array.from(this.metrics.queries.values());
        if (queries.length === 0) return 0;
        
        const totalDuration = queries.reduce((sum, query) => sum + query.totalDuration, 0);
        const totalCalls = queries.reduce((sum, query) => sum + query.totalCalls, 0);
        
        return totalCalls > 0 ? totalDuration / totalCalls : 0;
    }

    /**
     * Calculate overall error rate
     */
    calculateErrorRate() {
        const queries = Array.from(this.metrics.queries.values());
        const totalCalls = queries.reduce((sum, query) => sum + query.totalCalls, 0);
        const totalErrors = queries.reduce((sum, query) => sum + query.errorCount, 0);
        
        return totalCalls > 0 ? totalErrors / totalCalls : 0;
    }

    /**
     * Get top performing/problematic queries
     */
    getTopQueries() {
        return Array.from(this.metrics.queries.entries())
            .map(([name, metrics]) => ({ name, ...metrics }))
            .sort((a, b) => b.totalCalls - a.totalCalls)
            .slice(0, 10);
    }

    /**
     * Get recent errors
     */
    getRecentErrors(limit = 20) {
        return this.metrics.errors
            .slice(-limit)
            .reverse();
    }

    /**
     * Get user activity summary
     */
    getUserActivitySummary() {
        const users = Array.from(this.metrics.userActivity.entries());
        
        return {
            totalUsers: users.length,
            activeUsers: users.filter(([_, metrics]) => {
                const lastSeen = new Date(metrics.lastSeen).getTime();
                const oneHourAgo = Date.now() - (60 * 60 * 1000);
                return lastSeen > oneHourAgo;
            }).length,
            topUsers: users
                .map(([userId, metrics]) => ({
                    userId,
                    totalActions: metrics.totalActions,
                    sessions: metrics.sessions.size,
                    lastSeen: metrics.lastSeen
                }))
                .sort((a, b) => b.totalActions - a.totalActions)
                .slice(0, 10)
        };
    }

    /**
     * Get system metrics summary
     */
    getSystemMetricsSummary() {
        const recentMetrics = Array.from(this.metrics.systemMetrics.values()).slice(-10);
        
        if (recentMetrics.length === 0) return null;
        
        const latest = recentMetrics[recentMetrics.length - 1];
        
        return {
            current: latest,
            trends: {
                memoryUsage: this.calculateTrend(recentMetrics, 'memory.heapUsed'),
                uptime: latest.uptime
            }
        };
    }

    /**
     * Calculate trend for a metric
     */
    calculateTrend(metrics, path) {
        if (metrics.length < 2) return 'stable';
        
        const values = metrics.map(metric => {
            return path.split('.').reduce((obj, key) => obj[key], metric);
        });
        
        const first = values[0];
        const last = values[values.length - 1];
        const change = (last - first) / first;
        
        if (change > 0.1) return 'increasing';
        if (change < -0.1) return 'decreasing';
        return 'stable';
    }

    /**
     * Logging methods
     */
    logQueryMetrics(queryName, duration, success, context, error) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'query_metrics',
            queryName,
            duration,
            success,
            context,
            error: error ? error.message : null
        };
        
        this.writeLog('query_metrics', logEntry);
    }

    logUserActivity(userId, action, details) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'user_activity',
            userId,
            action,
            details
        };
        
        this.writeLog('user_activity', logEntry);
    }

    logError(errorRecord) {
        this.writeLog('errors', errorRecord);
    }

    logSlowQuery(slowQueryRecord) {
        this.writeLog('slow_queries', slowQueryRecord);
    }

    logAlert(alert) {
        this.writeLog('alerts', alert);
    }

    /**
     * Write log entry to file
     */
    writeLog(category, entry) {
        try {
            const logsDir = path.join(__dirname, '../logs');
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true });
            }
            
            const logFile = path.join(logsDir, `${category}.log`);
            const logLine = JSON.stringify(entry) + '\n';
            
            fs.appendFileSync(logFile, logLine);
        } catch (error) {
            console.error('Failed to write log:', error.message);
        }
    }

    /**
     * Rotate log files
     */
    rotateLogFiles() {
        const logsDir = path.join(__dirname, '../logs');
        if (!fs.existsSync(logsDir)) return;
        
        const logFiles = fs.readdirSync(logsDir).filter(file => file.endsWith('.log'));
        const today = new Date().toISOString().split('T')[0];
        
        logFiles.forEach(logFile => {
            const logPath = path.join(logsDir, logFile);
            const archivePath = path.join(logsDir, `${logFile}.${today}`);
            
            try {
                if (fs.existsSync(logPath)) {
                    fs.renameSync(logPath, archivePath);
                }
            } catch (error) {
                console.error(`Failed to rotate log ${logFile}:`, error.message);
            }
        });
        
        console.log('📋 Log files rotated');
    }

    /**
     * Cleanup and shutdown
     */
    shutdown() {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
        
        if (this.logRotationInterval) {
            clearInterval(this.logRotationInterval);
        }
        
        console.log('📊 Performance monitoring shutdown');
    }
}

// Singleton instance
let monitorInstance = null;

/**
 * Get or create monitor instance
 */
function getMonitor() {
    if (!monitorInstance) {
        monitorInstance = new PerformanceMonitor();
    }
    return monitorInstance;
}

/**
 * Middleware for Express to monitor requests
 */
function createMonitoringMiddleware() {
    const monitor = getMonitor();
    
    return (req, res, next) => {
        const startTime = Date.now();
        const originalSend = res.send;
        
        // Track user activity
        const userId = req.user?.id || req.session?.userId || 'anonymous';
        monitor.trackUserActivity(userId, `${req.method} ${req.path}`, {
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            sessionId: req.sessionID
        });
        
        // Override res.send to capture response time
        res.send = function(data) {
            const duration = Date.now() - startTime;
            
            // Log request metrics
            monitor.recordQueryMetrics(
                `${req.method}_${req.path}`,
                duration,
                res.statusCode < 400,
                {
                    method: req.method,
                    path: req.path,
                    statusCode: res.statusCode,
                    userId
                }
            );
            
            return originalSend.call(this, data);
        };
        
        next();
    };
}

module.exports = {
    PerformanceMonitor,
    getMonitor,
    createMonitoringMiddleware
};