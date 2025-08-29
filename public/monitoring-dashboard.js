// 모니터링 대시보드 JavaScript
class MonitoringDashboard {
    constructor() {
        this.updateInterval = 5000; // 5초마다 업데이트
        this.intervalId = null;
        this.alerts = [];
        this.isRealTimeEnabled = true;
        
        this.init();
    }

    init() {
        this.loadInitialData();
        this.startRealTimeUpdates();
        this.setupEventListeners();
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.updateSystemStatus(),
                this.updateCollectionPerformance(),
                this.updateApiStatus(),
                this.updateQualityMetrics(),
                this.updateRecentActivity(),
                this.updateErrorStats(),
                this.updateAlerts()
            ]);
        } catch (error) {
            console.error('초기 데이터 로딩 실패:', error);
            this.showError('초기 데이터를 로딩하는 중 오류가 발생했습니다.');
        }
    }

    startRealTimeUpdates() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        
        this.intervalId = setInterval(() => {
            if (this.isRealTimeEnabled) {
                this.loadInitialData();
            }
        }, this.updateInterval);
    }

    stopRealTimeUpdates() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    async updateSystemStatus() {
        try {
            const response = await fetch('/api/admin/monitoring/system-status');
            const data = await response.json();
            
            const statusElement = document.getElementById('systemStatus');
            const contentElement = document.getElementById('systemStatusContent');
            
            // 시스템 상태 표시기 업데이트
            statusElement.className = `status-indicator status-${data.status}`;
            
            contentElement.innerHTML = `
                <div class="metric">
                    <span class="metric-label">전체 상태</span>
                    <span class="metric-value ${data.status}">${this.getStatusText(data.status)}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">가동 시간</span>
                    <span class="metric-value info">${data.uptime}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">CPU 사용률</span>
                    <span class="metric-value ${this.getMetricClass(data.cpu, 80, 90)}">${data.cpu}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${this.getMetricClass(data.cpu, 80, 90)}" style="width: ${data.cpu}%"></div>
                </div>
                <div class="metric">
                    <span class="metric-label">메모리 사용률</span>
                    <span class="metric-value ${this.getMetricClass(data.memory, 80, 90)}">${data.memory}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${this.getMetricClass(data.memory, 80, 90)}" style="width: ${data.memory}%"></div>
                </div>
                <div class="metric">
                    <span class="metric-label">활성 프로세스</span>
                    <span class="metric-value info">${data.activeProcesses}</span>
                </div>
            `;
        } catch (error) {
            console.error('시스템 상태 업데이트 실패:', error);
            this.showErrorInCard('systemStatusContent', '시스템 상태를 가져올 수 없습니다.');
        }
    }

    async updateCollectionPerformance() {
        try {
            const response = await fetch('/api/admin/monitoring/collection-performance');
            const data = await response.json();
            
            const contentElement = document.getElementById('collectionPerformance');
            
            contentElement.innerHTML = `
                <div class="metric">
                    <span class="metric-label">오늘 수집된 항목</span>
                    <span class="metric-value success">${data.todayCollected}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">평균 처리 시간</span>
                    <span class="metric-value info">${data.avgProcessingTime}ms</span>
                </div>
                <div class="metric">
                    <span class="metric-label">성공률</span>
                    <span class="metric-value ${this.getMetricClass(data.successRate, 90, 95)}">${data.successRate}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${this.getMetricClass(data.successRate, 90, 95)}" style="width: ${data.successRate}%"></div>
                </div>
                <div class="metric">
                    <span class="metric-label">대기열 크기</span>
                    <span class="metric-value ${data.queueSize > 100 ? 'warning' : 'info'}">${data.queueSize}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">마지막 수집</span>
                    <span class="metric-value info">${data.lastCollection}</span>
                </div>
            `;
        } catch (error) {
            console.error('수집 성능 업데이트 실패:', error);
            this.showErrorInCard('collectionPerformance', '수집 성능 데이터를 가져올 수 없습니다.');
        }
    }

    async updateApiStatus() {
        try {
            const response = await fetch('/api/admin/monitoring/api-status');
            const data = await response.json();
            
            const contentElement = document.getElementById('apiStatus');
            
            let apiStatusHtml = '';
            data.apis.forEach(api => {
                apiStatusHtml += `
                    <div class="metric">
                        <span class="metric-label">${api.name}</span>
                        <span class="metric-value ${api.status}">${this.getStatusText(api.status)}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">응답 시간</span>
                        <span class="metric-value info">${api.responseTime}ms</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">오늘 요청 수</span>
                        <span class="metric-value info">${api.requestCount}</span>
                    </div>
                `;
            });
            
            contentElement.innerHTML = apiStatusHtml;
        } catch (error) {
            console.error('API 상태 업데이트 실패:', error);
            this.showErrorInCard('apiStatus', 'API 상태를 가져올 수 없습니다.');
        }
    }

    async updateQualityMetrics() {
        try {
            const response = await fetch('/api/admin/monitoring/quality-metrics');
            const data = await response.json();
            
            const contentElement = document.getElementById('qualityMetrics');
            
            contentElement.innerHTML = `
                <div class="metric">
                    <span class="metric-label">데이터 품질 점수</span>
                    <span class="metric-value ${this.getMetricClass(data.qualityScore, 80, 90)}">${data.qualityScore}/100</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${this.getMetricClass(data.qualityScore, 80, 90)}" style="width: ${data.qualityScore}%"></div>
                </div>
                <div class="metric">
                    <span class="metric-label">중복 제거율</span>
                    <span class="metric-value success">${data.deduplicationRate}%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">검증 통과율</span>
                    <span class="metric-value ${this.getMetricClass(data.validationRate, 85, 95)}">${data.validationRate}%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">카테고리 정확도</span>
                    <span class="metric-value ${this.getMetricClass(data.categoryAccuracy, 80, 90)}">${data.categoryAccuracy}%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">태그 일치율</span>
                    <span class="metric-value ${this.getMetricClass(data.tagMatchRate, 75, 85)}">${data.tagMatchRate}%</span>
                </div>
            `;
        } catch (error) {
            console.error('품질 지표 업데이트 실패:', error);
            this.showErrorInCard('qualityMetrics', '품질 지표를 가져올 수 없습니다.');
        }
    }

    async updateRecentActivity() {
        try {
            const response = await fetch('/api/monitoring/recent-activity');
            const data = await response.json();
            
            const contentElement = document.getElementById('recentActivity');
            
            let activityHtml = '';
            data.activities.forEach(activity => {
                activityHtml += `
                    <div class="metric">
                        <span class="metric-label">${activity.timestamp}</span>
                        <span class="metric-value ${activity.type}">${activity.message}</span>
                    </div>
                `;
            });
            
            if (data.activities.length === 0) {
                activityHtml = '<div class="metric"><span class="metric-label">최근 활동이 없습니다.</span></div>';
            }
            
            contentElement.innerHTML = activityHtml;
        } catch (error) {
            console.error('최근 활동 업데이트 실패:', error);
            this.showErrorInCard('recentActivity', '최근 활동을 가져올 수 없습니다.');
        }
    }

    async updateErrorStats() {
        try {
            const response = await fetch('/api/monitoring/error-stats');
            const data = await response.json();
            
            const contentElement = document.getElementById('errorStats');
            
            contentElement.innerHTML = `
                <div class="metric">
                    <span class="metric-label">오늘 총 오류</span>
                    <span class="metric-value ${data.totalErrors > 0 ? 'error' : 'success'}">${data.totalErrors}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">API 오류</span>
                    <span class="metric-value ${data.apiErrors > 0 ? 'error' : 'success'}">${data.apiErrors}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">데이터 처리 오류</span>
                    <span class="metric-value ${data.processingErrors > 0 ? 'error' : 'success'}">${data.processingErrors}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">네트워크 오류</span>
                    <span class="metric-value ${data.networkErrors > 0 ? 'error' : 'success'}">${data.networkErrors}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">마지막 오류</span>
                    <span class="metric-value info">${data.lastError || '없음'}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">오류율</span>
                    <span class="metric-value ${this.getErrorRateClass(data.errorRate)}">${data.errorRate}%</span>
                </div>
            `;
        } catch (error) {
            console.error('오류 통계 업데이트 실패:', error);
            this.showErrorInCard('errorStats', '오류 통계를 가져올 수 없습니다.');
        }
    }

    async updateAlerts() {
        try {
            const response = await fetch('/api/monitoring/alerts');
            const data = await response.json();
            
            const alertListElement = document.getElementById('alertList');
            
            if (data.alerts.length === 0) {
                alertListElement.innerHTML = `
                    <div class="alert-item">
                        <div class="alert-content">
                            <div class="alert-message">현재 활성 알림이 없습니다.</div>
                            <div class="alert-time">시스템이 정상적으로 작동 중입니다.</div>
                        </div>
                        <div class="alert-status resolved">정상</div>
                    </div>
                `;
            } else {
                let alertsHtml = '';
                data.alerts.forEach(alert => {
                    alertsHtml += `
                        <div class="alert-item ${alert.severity}">
                            <div class="alert-content">
                                <div class="alert-message">${alert.message}</div>
                                <div class="alert-time">${alert.timestamp}</div>
                            </div>
                            <div class="alert-status ${alert.status}">${this.getAlertStatusText(alert.status)}</div>
                        </div>
                    `;
                });
                alertListElement.innerHTML = alertsHtml;
            }
            
            this.alerts = data.alerts;
        } catch (error) {
            console.error('알림 업데이트 실패:', error);
            this.showErrorInCard('alertList', '알림을 가져올 수 없습니다.');
        }
    }

    setupEventListeners() {
        // 실시간 업데이트 토글
        document.addEventListener('keydown', (e) => {
            if (e.key === 'r' && e.ctrlKey) {
                e.preventDefault();
                this.toggleRealTimeUpdates();
            }
        });
    }

    toggleRealTimeUpdates() {
        this.isRealTimeEnabled = !this.isRealTimeEnabled;
        
        if (this.isRealTimeEnabled) {
            this.startRealTimeUpdates();
            this.showNotification('실시간 업데이트가 활성화되었습니다.', 'success');
        } else {
            this.stopRealTimeUpdates();
            this.showNotification('실시간 업데이트가 비활성화되었습니다.', 'warning');
        }
    }

    getStatusText(status) {
        const statusMap = {
            'healthy': '정상',
            'warning': '주의',
            'critical': '위험',
            'error': '오류',
            'success': '성공'
        };
        return statusMap[status] || status;
    }

    getAlertStatusText(status) {
        const statusMap = {
            'new': '신규',
            'resolved': '해결됨',
            'pending': '대기중'
        };
        return statusMap[status] || status;
    }

    getMetricClass(value, warningThreshold, errorThreshold) {
        if (value >= errorThreshold) return 'success';
        if (value >= warningThreshold) return 'warning';
        return 'error';
    }

    getErrorRateClass(rate) {
        if (rate <= 1) return 'success';
        if (rate <= 5) return 'warning';
        return 'error';
    }

    showErrorInCard(elementId, message) {
        const element = document.getElementById(elementId);
        element.innerHTML = `
            <div class="metric">
                <span class="metric-label">오류</span>
                <span class="metric-value error">${message}</span>
            </div>
        `;
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // 간단한 알림 표시 (실제 구현에서는 더 정교한 알림 시스템 사용)
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'error' ? '#e74c3c' : type === 'warning' ? '#f39c12' : type === 'success' ? '#27ae60' : '#3498db'};
            color: white;
            border-radius: 8px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// 전역 함수들
async function refreshData() {
    dashboard.showNotification('데이터를 새로고침하는 중...', 'info');
    await dashboard.loadInitialData();
    dashboard.showNotification('데이터가 성공적으로 새로고침되었습니다.', 'success');
}

async function triggerCollection() {
    try {
        dashboard.showNotification('수동 수집을 시작하는 중...', 'info');
        const response = await fetch('/api/monitoring/trigger-collection', {
            method: 'POST'
        });
        
        if (response.ok) {
            dashboard.showNotification('수동 수집이 시작되었습니다.', 'success');
        } else {
            throw new Error('수집 시작 실패');
        }
    } catch (error) {
        dashboard.showNotification('수동 수집 시작에 실패했습니다.', 'error');
    }
}

async function resetCircuitBreakers() {
    try {
        dashboard.showNotification('Circuit Breaker를 리셋하는 중...', 'info');
        const response = await fetch('/api/monitoring/reset-circuit-breakers', {
            method: 'POST'
        });
        
        if (response.ok) {
            dashboard.showNotification('Circuit Breaker가 성공적으로 리셋되었습니다.', 'success');
            await dashboard.updateApiStatus();
        } else {
            throw new Error('Circuit Breaker 리셋 실패');
        }
    } catch (error) {
        dashboard.showNotification('Circuit Breaker 리셋에 실패했습니다.', 'error');
    }
}

async function clearAlerts() {
    try {
        dashboard.showNotification('알림을 초기화하는 중...', 'info');
        const response = await fetch('/api/monitoring/clear-alerts', {
            method: 'POST'
        });
        
        if (response.ok) {
            dashboard.showNotification('알림이 성공적으로 초기화되었습니다.', 'success');
            await dashboard.updateAlerts();
        } else {
            throw new Error('알림 초기화 실패');
        }
    } catch (error) {
        dashboard.showNotification('알림 초기화에 실패했습니다.', 'error');
    }
}

async function testRealTimeMonitoring() {
    dashboard.showNotification('실시간 모니터링 테스트를 시작합니다...', 'info');
    
    // 테스트 데이터 생성
    const testData = {
        timestamp: new Date().toISOString(),
        type: 'test',
        message: '실시간 모니터링 테스트 완료',
        severity: 'info'
    };
    
    try {
        const response = await fetch('/api/monitoring/test-alert', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData)
        });
        
        if (response.ok) {
            dashboard.showNotification('실시간 모니터링 테스트가 완료되었습니다.', 'success');
            await dashboard.updateAlerts();
        } else {
            throw new Error('테스트 실패');
        }
    } catch (error) {
        dashboard.showNotification('실시간 모니터링 테스트에 실패했습니다.', 'error');
    }
}

async function showSystemInfo() {
    try {
        const response = await fetch('/api/monitoring/system-info');
        const data = await response.json();
        
        const infoMessage = `
시스템 정보:
- Node.js 버전: ${data.nodeVersion}
- 플랫폼: ${data.platform}
- 아키텍처: ${data.arch}
- 총 메모리: ${data.totalMemory}
- 사용 가능한 메모리: ${data.freeMemory}
- 가동 시간: ${data.uptime}
        `;
        
        alert(infoMessage);
    } catch (error) {
        dashboard.showNotification('시스템 정보를 가져올 수 없습니다.', 'error');
    }
}

// 대시보드 초기화
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new MonitoringDashboard();
});