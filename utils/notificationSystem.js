const fs = require('fs').promises;
const path = require('path');

/**
 * 오류 알림 및 자동 복구 시스템
 * 실시간 오류 감지, 알림 전송, 자동 복구 기능 제공
 */
class NotificationSystem {
    constructor(options = {}) {
        this.configPath = options.configPath || path.join(__dirname, '../data/notification-config.json');
        this.logPath = options.logPath || path.join(__dirname, '../data/notification-logs');
        this.config = null;
        this.alertHistory = [];
        this.recoveryStrategies = new Map();
        
        // 알림 설정 초기화
        this.initializeConfig();
        
        // 복구 전략 등록
        this.registerRecoveryStrategies();
    }

    /**
     * 알림 설정 초기화
     */
    async initializeConfig() {
        try {
            const configData = await fs.readFile(this.configPath, 'utf8');
            this.config = JSON.parse(configData);
        } catch (error) {
            // 기본 설정 사용
            this.config = this.getDefaultConfig();
            await this.saveConfig();
        }
    }

    /**
     * 기본 알림 설정
     */
    getDefaultConfig() {
        return {
            notifications: {
                email: {
                    enabled: false,
                    recipients: [],
                    smtp: {
                        host: 'smtp.gmail.com',
                        port: 587,
                        secure: false
                    }
                },
                webhook: {
                    enabled: false,
                    url: '',
                    headers: {}
                },
                slack: {
                    enabled: false,
                    webhookUrl: '',
                    channel: '#monitoring'
                }
            },
            alerts: {
                errorThreshold: 5,        // 5개 오류 시 알림
                warningThreshold: 3,      // 3개 경고 시 알림
                criticalThreshold: 10,    // 10개 심각 오류 시 알림
                timeWindow: 300000,       // 5분 윈도우
                cooldownPeriod: 600000    // 10분 쿨다운
            },
            autoRecovery: {
                enabled: true,
                maxRetries: 3,
                retryDelay: 30000,       // 30초
                strategies: {
                    circuitBreaker: true,
                    serviceRestart: true,
                    configReload: true
                }
            }
        };
    }

    /**
     * 설정 저장
     */
    async saveConfig() {
        try {
            await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('알림 설정 저장 실패:', error);
        }
    }

    /**
     * 복구 전략 등록
     */
    registerRecoveryStrategies() {
        // Circuit Breaker 복구 전략
        this.recoveryStrategies.set('circuitBreaker', async (context) => {
            try {
                if (context.scheduler && context.scheduler.resetAllCircuitBreakers) {
                    context.scheduler.resetAllCircuitBreakers();
                    return { success: true, message: 'Circuit Breaker가 리셋되었습니다.' };
                }
                return { success: false, message: 'Circuit Breaker 리셋 실패' };
            } catch (error) {
                return { success: false, message: `Circuit Breaker 리셋 오류: ${error.message}` };
            }
        });

        // 서비스 재시작 전략
        this.recoveryStrategies.set('serviceRestart', async (context) => {
            try {
                if (context.scheduler && context.scheduler.stop && context.scheduler.start) {
                    await context.scheduler.stop();
                    await new Promise(resolve => setTimeout(resolve, 5000)); // 5초 대기
                    await context.scheduler.start();
                    return { success: true, message: '서비스가 재시작되었습니다.' };
                }
                return { success: false, message: '서비스 재시작 실패' };
            } catch (error) {
                return { success: false, message: `서비스 재시작 오류: ${error.message}` };
            }
        });

        // 설정 재로드 전략
        this.recoveryStrategies.set('configReload', async (context) => {
            try {
                if (context.scheduler && context.scheduler.loadConfiguration) {
                    await context.scheduler.loadConfiguration();
                    return { success: true, message: '설정이 재로드되었습니다.' };
                }
                return { success: false, message: '설정 재로드 실패' };
            } catch (error) {
                return { success: false, message: `설정 재로드 오류: ${error.message}` };
            }
        });
    }

    /**
     * 오류 알림 생성
     */
    async createAlert(error, context = {}) {
        const alert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            error: {
                message: error.message,
                stack: error.stack,
                category: this.categorizeError(error)
            },
            context: {
                service: context.service || 'unknown',
                task: context.task || 'unknown',
                severity: this.determineSeverity(error),
                ...context
            },
            status: 'new',
            recoveryAttempts: 0,
            autoRecoveryEnabled: this.config.autoRecovery.enabled
        };

        // 알림 히스토리에 추가
        this.alertHistory.push(alert);
        
        // 알림 전송
        await this.sendNotification(alert);
        
        // 자동 복구 시도
        if (this.config.autoRecovery.enabled) {
            await this.attemptAutoRecovery(alert, context);
        }

        return alert;
    }

    /**
     * 오류 분류
     */
    categorizeError(error) {
        const message = error.message.toLowerCase();
        
        // timeout 관련 오류를 먼저 확인
        if (message.includes('timeout') || message.includes('time out') || message.includes('time out')) {
            return 'TIMEOUT_ERROR';
        } else if (message.includes('api') || message.includes('http') || message.includes('network')) {
            return 'API_ERROR';
        } else if (message.includes('authentication') || message.includes('auth')) {
            return 'AUTH_ERROR';
        } else if (message.includes('rate limit') || message.includes('quota')) {
            return 'RATE_LIMIT_ERROR';
        } else if (message.includes('circuit') || message.includes('breaker')) {
            return 'CIRCUIT_BREAKER_ERROR';
        } else if (message.includes('processing') || message.includes('parse')) {
            return 'PROCESSING_ERROR';
        } else {
            return 'UNKNOWN_ERROR';
        }
    }

    /**
     * 심각도 결정
     */
    determineSeverity(error) {
        const category = this.categorizeError(error);
        const message = error.message.toLowerCase();
        
        // 심각한 오류들
        if (message.includes('critical') || message.includes('fatal') || 
            category === 'AUTH_ERROR' || category === 'CIRCUIT_BREAKER_ERROR') {
            return 'critical';
        }
        
        // 경고 수준 오류들
        if (category === 'API_ERROR' || category === 'TIMEOUT_ERROR' || 
            category === 'RATE_LIMIT_ERROR') {
            return 'warning';
        }
        
        // 일반 오류
        return 'error';
    }

    /**
     * 알림 전송
     */
    async sendNotification(alert) {
        const promises = [];

        // 이메일 알림
        if (this.config.notifications.email.enabled) {
            promises.push(this.sendEmailNotification(alert));
        }

        // Webhook 알림
        if (this.config.notifications.webhook.enabled) {
            promises.push(this.sendWebhookNotification(alert));
        }

        // Slack 알림
        if (this.config.notifications.slack.enabled) {
            promises.push(this.sendSlackNotification(alert));
        }

        // 로그 파일에 기록
        promises.push(this.logAlert(alert));

        await Promise.allSettled(promises);
    }

    /**
     * 이메일 알림 전송
     */
    async sendEmailNotification(alert) {
        try {
            // 실제 구현에서는 nodemailer 등을 사용
            console.log(`📧 이메일 알림 전송: ${alert.error.message}`);
            
            const emailContent = `
                🚨 시스템 알림
                
                오류: ${alert.error.message}
                서비스: ${alert.context.service}
                태스크: ${alert.context.task}
                심각도: ${alert.context.severity}
                시간: ${new Date(alert.timestamp).toLocaleString('ko-KR')}
                
                자동 복구: ${alert.autoRecoveryEnabled ? '활성화' : '비활성화'}
            `;
            
            // 실제 이메일 전송 로직 (구현 필요)
            console.log('이메일 내용:', emailContent);
            
        } catch (error) {
            console.error('이메일 알림 전송 실패:', error);
        }
    }

    /**
     * Webhook 알림 전송
     */
    async sendWebhookNotification(alert) {
        try {
            const webhookData = {
                alert_id: alert.id,
                timestamp: alert.timestamp,
                error: alert.error.message,
                service: alert.context.service,
                task: alert.context.task,
                severity: alert.context.severity,
                category: alert.error.category
            };

            // 실제 webhook 전송 로직 (구현 필요)
            console.log(`🔗 Webhook 알림 전송: ${alert.error.message}`);
            console.log('Webhook 데이터:', webhookData);
            
        } catch (error) {
            console.error('Webhook 알림 전송 실패:', error);
        }
    }

    /**
     * Slack 알림 전송
     */
    async sendSlackNotification(alert) {
        try {
            const slackMessage = {
                text: `🚨 시스템 알림`,
                attachments: [{
                    color: alert.context.severity === 'critical' ? '#ff0000' : 
                           alert.context.severity === 'warning' ? '#ffaa00' : '#ff6600',
                    fields: [
                        {
                            title: '오류',
                            value: alert.error.message,
                            short: false
                        },
                        {
                            title: '서비스',
                            value: alert.context.service,
                            short: true
                        },
                        {
                            title: '심각도',
                            value: alert.context.severity,
                            short: true
                        },
                        {
                            title: '시간',
                            value: new Date(alert.timestamp).toLocaleString('ko-KR'),
                            short: true
                        }
                    ]
                }]
            };

            // 실제 Slack 전송 로직 (구현 필요)
            console.log(`💬 Slack 알림 전송: ${alert.error.message}`);
            console.log('Slack 메시지:', slackMessage);
            
        } catch (error) {
            console.error('Slack 알림 전송 실패:', error);
        }
    }

    /**
     * 알림 로그 기록
     */
    async logAlert(alert) {
        try {
            await this.ensureLogDirectory();
            
            const logFile = path.join(this.logPath, `${new Date().toISOString().split('T')[0]}.log`);
            const logEntry = {
                timestamp: new Date().toISOString(),
                type: 'alert',
                data: alert
            };
            
            await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');
            
        } catch (error) {
            console.error('알림 로그 기록 실패:', error);
        }
    }

    /**
     * 로그 디렉토리 확인
     */
    async ensureLogDirectory() {
        try {
            await fs.mkdir(this.logPath, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    /**
     * 자동 복구 시도
     */
    async attemptAutoRecovery(alert, context) {
        if (alert.recoveryAttempts >= this.config.autoRecovery.maxRetries) {
            console.log(`❌ 자동 복구 최대 시도 횟수 초과: ${alert.id}`);
            return;
        }

        alert.recoveryAttempts++;
        
        // 복구 전략 선택
        const strategy = this.selectRecoveryStrategy(alert);
        
        if (strategy && this.recoveryStrategies.has(strategy)) {
            try {
                console.log(`🔄 자동 복구 시도 ${alert.recoveryAttempts}/${this.config.autoRecovery.maxRetries}: ${strategy}`);
                
                const result = await this.recoveryStrategies.get(strategy)(context);
                
                if (result.success) {
                    console.log(`✅ 자동 복구 성공: ${result.message}`);
                    alert.status = 'resolved';
                    alert.recoveryResult = result;
                    
                    // 복구 성공 알림
                    await this.sendRecoveryNotification(alert, result);
                } else {
                    console.log(`❌ 자동 복구 실패: ${result.message}`);
                    alert.recoveryResult = result;
                    
                    // 재시도 대기
                    setTimeout(() => {
                        this.attemptAutoRecovery(alert, context);
                    }, this.config.autoRecovery.retryDelay);
                }
                
            } catch (error) {
                console.error(`❌ 자동 복구 오류: ${error.message}`);
                alert.recoveryResult = { success: false, message: error.message };
            }
        }
    }

    /**
     * 복구 전략 선택
     */
    selectRecoveryStrategy(alert) {
        const category = alert.error.category;
        
        switch (category) {
            case 'CIRCUIT_BREAKER_ERROR':
                return 'circuitBreaker';
            case 'API_ERROR':
            case 'TIMEOUT_ERROR':
                return 'serviceRestart';
            case 'PROCESSING_ERROR':
                return 'configReload';
            default:
                return 'circuitBreaker'; // 기본 전략
        }
    }

    /**
     * 복구 성공 알림
     */
    async sendRecoveryNotification(alert, result) {
        const recoveryAlert = {
            id: `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            type: 'recovery',
            originalAlert: alert.id,
            result: result,
            context: alert.context
        };

        // 복구 성공 알림 전송
        await this.sendNotification(recoveryAlert);
    }

    /**
     * 알림 상태 업데이트
     */
    async updateAlertStatus(alertId, status) {
        const alert = this.alertHistory.find(a => a.id === alertId);
        if (alert) {
            alert.status = status;
            alert.updatedAt = new Date().toISOString();
        }
    }

    /**
     * 알림 히스토리 조회
     */
    getAlertHistory(limit = 50) {
        return this.alertHistory
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }

    /**
     * 활성 알림 조회
     */
    getActiveAlerts() {
        return this.alertHistory.filter(alert => 
            alert.status === 'new' || alert.status === 'pending'
        );
    }

    /**
     * 알림 통계 조회
     */
    getAlertStatistics() {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const recentAlerts = this.alertHistory.filter(alert => 
            new Date(alert.timestamp) >= oneHourAgo
        );
        
        const dailyAlerts = this.alertHistory.filter(alert => 
            new Date(alert.timestamp) >= oneDayAgo
        );
        
        return {
            total: this.alertHistory.length,
            active: this.getActiveAlerts().length,
            recent: recentAlerts.length,
            daily: dailyAlerts.length,
            bySeverity: {
                critical: this.alertHistory.filter(a => a.context.severity === 'critical').length,
                warning: this.alertHistory.filter(a => a.context.severity === 'warning').length,
                error: this.alertHistory.filter(a => a.context.severity === 'error').length
            },
            byCategory: this.alertHistory.reduce((acc, alert) => {
                const category = alert.error.category;
                acc[category] = (acc[category] || 0) + 1;
                return acc;
            }, {}),
            recoverySuccess: this.alertHistory.filter(a => 
                a.status === 'resolved' && a.recoveryResult?.success
            ).length
        };
    }

    /**
     * 알림 설정 업데이트
     */
    async updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        await this.saveConfig();
    }

    /**
     * 알림 시스템 상태 조회
     */
    getStatus() {
        return {
            enabled: true,
            config: this.config,
            statistics: this.getAlertStatistics(),
            activeAlerts: this.getActiveAlerts().length,
            lastAlert: this.alertHistory.length > 0 ? 
                this.alertHistory[this.alertHistory.length - 1] : null
        };
    }
}

module.exports = NotificationSystem; 