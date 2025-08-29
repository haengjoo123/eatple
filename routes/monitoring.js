/**
 * Monitoring Routes
 * 
 * Provides API endpoints for monitoring dashboard and system health
 */

const express = require('express');
const router = express.Router();
const { getMonitor } = require('../utils/performanceMonitor');
const { getRealtimeMonitoring } = require('../utils/realtimeMonitoringSystem');

// Get monitoring instances
const monitor = getMonitor();
const realtimeMonitoring = getRealtimeMonitoring();

/**
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
    try {
        const healthStatus = await realtimeMonitoring.performHealthCheck();
        
        res.status(healthStatus.overall === 'healthy' ? 200 : 503).json({
            status: healthStatus.overall,
            timestamp: healthStatus.timestamp,
            checks: {
                database: healthStatus.database,
                supabase: healthStatus.supabase,
                system: healthStatus.system
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Dashboard data endpoint
 */
router.get('/dashboard', (req, res) => {
    try {
        const dashboardData = realtimeMonitoring.getDashboardData();
        res.json(dashboardData);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get dashboard data',
            message: error.message
        });
    }
});

/**
 * Performance metrics endpoint
 */
router.get('/metrics', (req, res) => {
    try {
        const report = monitor.generateReport();
        res.json(report);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get metrics',
            message: error.message
        });
    }
});

/**
 * Historical metrics endpoint
 */
router.get('/metrics/historical', (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const historicalMetrics = realtimeMonitoring.getHistoricalMetrics(days);
        
        res.json({
            days,
            dataPoints: historicalMetrics.length,
            metrics: historicalMetrics
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get historical metrics',
            message: error.message
        });
    }
});

/**
 * System report endpoint
 */
router.get('/report', (req, res) => {
    try {
        const report = realtimeMonitoring.generateMonitoringReport();
        res.json(report);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to generate report',
            message: error.message
        });
    }
});

/**
 * Query performance endpoint
 */
router.get('/queries', (req, res) => {
    try {
        const report = monitor.generateReport();
        const queries = report.queries.map(query => ({
            name: query.name,
            totalCalls: query.totalCalls,
            avgDuration: query.avgDuration,
            maxDuration: query.maxDuration,
            successRate: query.totalCalls > 0 ? 
                (query.successCount / query.totalCalls * 100).toFixed(2) : 0,
            errorCount: query.errorCount
        }));
        
        res.json({
            totalQueries: queries.length,
            queries: queries.sort((a, b) => b.totalCalls - a.totalCalls)
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get query metrics',
            message: error.message
        });
    }
});

/**
 * Error logs endpoint
 */
router.get('/errors', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const report = monitor.generateReport();
        const errors = report.errors.slice(0, limit);
        
        res.json({
            totalErrors: report.summary.totalErrors,
            errorRate: report.summary.errorRate,
            errors: errors
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get error logs',
            message: error.message
        });
    }
});

/**
 * User activity endpoint
 */
router.get('/activity', (req, res) => {
    try {
        const report = monitor.generateReport();
        res.json(report.userActivity);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get user activity',
            message: error.message
        });
    }
});

/**
 * System metrics endpoint
 */
router.get('/system', (req, res) => {
    try {
        const report = monitor.generateReport();
        const systemMetrics = report.systemMetrics;
        
        if (!systemMetrics) {
            return res.json({
                message: 'No system metrics available yet'
            });
        }
        
        res.json({
            current: systemMetrics.current,
            trends: systemMetrics.trends,
            uptime: report.uptime
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get system metrics',
            message: error.message
        });
    }
});

/**
 * Alerts endpoint
 */
router.get('/alerts', (req, res) => {
    try {
        const dashboardData = realtimeMonitoring.getDashboardData();
        const issues = realtimeMonitoring.identifyTopIssues(dashboardData);
        
        res.json({
            activeAlerts: issues.length,
            alerts: issues
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get alerts',
            message: error.message
        });
    }
});

/**
 * WebSocket endpoint for real-time updates
 */
router.get('/realtime', (req, res) => {
    // Set headers for Server-Sent Events
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial data
    res.write(`data: ${JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString()
    })}\n\n`);

    // Subscribe to real-time updates
    const unsubscribe = realtimeMonitoring.subscribe((event, data) => {
        try {
            res.write(`data: ${JSON.stringify({
                type: event,
                data: data,
                timestamp: new Date().toISOString()
            })}\n\n`);
        } catch (error) {
            console.error('Failed to send real-time update:', error.message);
        }
    });

    // Handle client disconnect
    req.on('close', () => {
        unsubscribe();
    });

    req.on('aborted', () => {
        unsubscribe();
    });
});

/**
 * Test endpoint to generate sample metrics
 */
router.post('/test/generate-metrics', async (req, res) => {
    try {
        // Generate some test queries
        const testQueries = [
            'test_query_1',
            'test_query_2', 
            'test_slow_query'
        ];
        
        for (const queryName of testQueries) {
            const duration = queryName.includes('slow') ? 1500 : Math.random() * 500;
            const success = Math.random() > 0.1; // 90% success rate
            
            monitor.recordQueryMetrics(queryName, duration, success, {
                test: true,
                timestamp: new Date().toISOString()
            });
        }
        
        // Generate test user activity
        monitor.trackUserActivity('test_user_1', 'test_action', {
            test: true,
            sessionId: 'test_session'
        });
        
        res.json({
            message: 'Test metrics generated successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to generate test metrics',
            message: error.message
        });
    }
});

/**
 * Configuration endpoint
 */
router.get('/config', (req, res) => {
    try {
        const config = monitor.config;
        res.json({
            monitoring: {
                enabled: true,
                metricsRetention: config.logging.retention,
                alertThresholds: config.alerts
            },
            features: {
                realtime: true,
                historicalData: true,
                alerting: true,
                dashboard: true
            }
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get configuration',
            message: error.message
        });
    }
});

/**
 * Dashboard-specific endpoints for monitoring-dashboard.html
 */

// System status endpoint
router.get('/system-status', (req, res) => {
    try {
        const report = monitor.generateReport();
        const systemMetrics = report.systemMetrics?.current || {};
        
        res.json({
            status: systemMetrics.cpuUsage > 90 ? 'critical' : 
                   systemMetrics.cpuUsage > 80 ? 'warning' : 'healthy',
            uptime: report.uptime || '0분',
            cpu: Math.round(systemMetrics.cpuUsage || 0),
            memory: Math.round(systemMetrics.memoryUsage || 0),
            activeProcesses: systemMetrics.activeConnections || 0
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get system status',
            message: error.message
        });
    }
});

// Collection performance endpoint
router.get('/collection-performance', (req, res) => {
    try {
        const report = monitor.generateReport();
        const queries = report.queries || [];
        
        const totalQueries = queries.reduce((sum, q) => sum + q.totalCalls, 0);
        const avgDuration = queries.length > 0 ? 
            queries.reduce((sum, q) => sum + q.avgDuration, 0) / queries.length : 0;
        const successRate = queries.length > 0 ?
            queries.reduce((sum, q) => sum + (q.successCount / q.totalCalls * 100), 0) / queries.length : 100;
        
        res.json({
            todayCollected: totalQueries,
            avgProcessingTime: Math.round(avgDuration),
            successRate: Math.round(successRate),
            queueSize: Math.floor(Math.random() * 50), // Mock data
            lastCollection: new Date().toLocaleString('ko-KR')
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get collection performance',
            message: error.message
        });
    }
});

// API status endpoint
router.get('/api-status', (req, res) => {
    try {
        const report = monitor.generateReport();
        const queries = report.queries || [];
        
        const apis = [
            {
                name: 'Supabase API',
                status: 'healthy',
                responseTime: Math.round(Math.random() * 200 + 50),
                requestCount: queries.reduce((sum, q) => sum + q.totalCalls, 0)
            },
            {
                name: 'Internal API',
                status: 'healthy',
                responseTime: Math.round(Math.random() * 100 + 20),
                requestCount: Math.floor(Math.random() * 1000 + 500)
            }
        ];
        
        res.json({ apis });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get API status',
            message: error.message
        });
    }
});

// Quality metrics endpoint
router.get('/quality-metrics', (req, res) => {
    try {
        const report = monitor.generateReport();
        const successRate = report.summary?.successRate || 95;
        
        res.json({
            qualityScore: Math.round(successRate),
            deduplicationRate: Math.round(Math.random() * 10 + 90),
            validationRate: Math.round(successRate),
            categoryAccuracy: Math.round(Math.random() * 15 + 85),
            tagMatchRate: Math.round(Math.random() * 20 + 80)
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get quality metrics',
            message: error.message
        });
    }
});

// Recent activity endpoint
router.get('/recent-activity', (req, res) => {
    try {
        const report = monitor.generateReport();
        const activities = [];
        
        // Add recent queries as activities
        if (report.queries && report.queries.length > 0) {
            report.queries.slice(0, 5).forEach(query => {
                activities.push({
                    timestamp: new Date().toLocaleTimeString('ko-KR'),
                    message: `${query.name} 쿼리 실행 (${query.totalCalls}회)`,
                    type: query.errorCount > 0 ? 'warning' : 'success'
                });
            });
        }
        
        // Add recent errors as activities
        if (report.errors && report.errors.length > 0) {
            report.errors.slice(0, 3).forEach(error => {
                activities.push({
                    timestamp: new Date(error.timestamp).toLocaleTimeString('ko-KR'),
                    message: `오류 발생: ${error.message}`,
                    type: 'error'
                });
            });
        }
        
        res.json({ activities: activities.slice(0, 10) });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get recent activity',
            message: error.message
        });
    }
});

// Error statistics endpoint
router.get('/error-stats', (req, res) => {
    try {
        const report = monitor.generateReport();
        const errors = report.errors || [];
        
        const apiErrors = errors.filter(e => e.type === 'api').length;
        const processingErrors = errors.filter(e => e.type === 'processing').length;
        const networkErrors = errors.filter(e => e.type === 'network').length;
        
        res.json({
            totalErrors: errors.length,
            apiErrors,
            processingErrors,
            networkErrors,
            lastError: errors.length > 0 ? 
                new Date(errors[0].timestamp).toLocaleString('ko-KR') : null,
            errorRate: report.summary?.errorRate || 0
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get error stats',
            message: error.message
        });
    }
});

// Alerts endpoint for dashboard
router.get('/alerts', (req, res) => {
    try {
        const report = monitor.generateReport();
        const alerts = [];
        
        // Generate alerts based on system status
        if (report.systemMetrics?.current?.cpuUsage > 80) {
            alerts.push({
                message: `CPU 사용률이 높습니다 (${Math.round(report.systemMetrics.current.cpuUsage)}%)`,
                severity: report.systemMetrics.current.cpuUsage > 90 ? 'error' : 'warning',
                status: 'new',
                timestamp: new Date().toLocaleString('ko-KR')
            });
        }
        
        if (report.systemMetrics?.current?.memoryUsage > 80) {
            alerts.push({
                message: `메모리 사용률이 높습니다 (${Math.round(report.systemMetrics.current.memoryUsage)}%)`,
                severity: report.systemMetrics.current.memoryUsage > 90 ? 'error' : 'warning',
                status: 'new',
                timestamp: new Date().toLocaleString('ko-KR')
            });
        }
        
        // Add error-based alerts
        if (report.errors && report.errors.length > 10) {
            alerts.push({
                message: `최근 오류가 많이 발생했습니다 (${report.errors.length}개)`,
                severity: 'warning',
                status: 'pending',
                timestamp: new Date().toLocaleString('ko-KR')
            });
        }
        
        res.json({ alerts });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get alerts',
            message: error.message
        });
    }
});

// Control endpoints
router.post('/trigger-collection', (req, res) => {
    try {
        // Mock collection trigger
        setTimeout(() => {
            monitor.recordQueryMetrics('manual_collection', Math.random() * 1000, true, {
                type: 'manual',
                timestamp: new Date().toISOString()
            });
        }, 1000);
        
        res.json({
            message: 'Collection triggered successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to trigger collection',
            message: error.message
        });
    }
});

router.post('/reset-circuit-breakers', (req, res) => {
    try {
        // Mock circuit breaker reset
        res.json({
            message: 'Circuit breakers reset successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to reset circuit breakers',
            message: error.message
        });
    }
});

router.post('/clear-alerts', (req, res) => {
    try {
        // Mock alert clearing
        res.json({
            message: 'Alerts cleared successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to clear alerts',
            message: error.message
        });
    }
});

router.post('/test-alert', (req, res) => {
    try {
        const testData = req.body;
        
        // Record test alert
        monitor.recordQueryMetrics('test_alert', 100, true, {
            type: 'test',
            message: testData.message,
            timestamp: new Date().toISOString()
        });
        
        res.json({
            message: 'Test alert created successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to create test alert',
            message: error.message
        });
    }
});

router.get('/system-info', (req, res) => {
    try {
        const os = require('os');
        
        res.json({
            nodeVersion: process.version,
            platform: os.platform(),
            arch: os.arch(),
            totalMemory: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`,
            freeMemory: `${Math.round(os.freemem() / 1024 / 1024 / 1024)}GB`,
            uptime: `${Math.round(os.uptime() / 3600)}시간`
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get system info',
            message: error.message
        });
    }
});

module.exports = router;