/**
 * 오래된 로그 파일 정리 스크립트
 * 
 * 사용법:
 *   node scripts/cleanup-old-logs.js
 *   node scripts/cleanup-old-logs.js --days 7
 *   node scripts/cleanup-old-logs.js --dry-run
 */

const fs = require('fs');
const path = require('path');

/**
 * 보존 기간 파싱 (일 단위로 변환)
 */
function parseRetentionDays(retention) {
    if (typeof retention === 'number') {
        return retention;
    }
    
    if (typeof retention === 'string') {
        const match = retention.match(/^(\d+)\s*(days?|d)$/i);
        if (match) {
            return parseInt(match[1], 10);
        }
    }
    
    return 30; // 기본값
}

/**
 * 로그 파일 정리
 */
function cleanupOldLogs(retentionDays, dryRun = false) {
    try {
        const logsDir = path.join(__dirname, '../logs');
        
        if (!fs.existsSync(logsDir)) {
            console.log('로그 디렉토리가 존재하지 않습니다.');
            return;
        }
        
        const now = Date.now();
        const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
        const cutoffDate = new Date(now - retentionMs);
        
        console.log(`\n📋 로그 정리 작업 시작`);
        console.log(`   보존 기간: ${retentionDays}일`);
        console.log(`   기준 날짜: ${cutoffDate.toISOString().split('T')[0]}`);
        console.log(`   모드: ${dryRun ? '시뮬레이션 (실제 삭제 안 함)' : '실제 삭제'}\n`);
        
        const files = fs.readdirSync(logsDir);
        let deletedCount = 0;
        let deletedSize = 0;
        
        // 아카이브된 로그 파일만 처리 (*.log.YYYY-MM-DD 형식)
        const archivePattern = /\.log\.(\d{4}-\d{2}-\d{2})$/;
        
        files.forEach(file => {
            const match = file.match(archivePattern);
            
            if (match) {
                const dateStr = match[1];
                const fileDate = new Date(dateStr);
                
                if (fileDate < cutoffDate) {
                    const filePath = path.join(logsDir, file);
                    
                    try {
                        const stats = fs.statSync(filePath);
                        const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
                        
                        console.log(`   🗑️  ${file} (${fileSizeMB} MB) - ${dateStr}`);
                        
                        if (!dryRun) {
                            fs.unlinkSync(filePath);
                        }
                        
                        deletedCount++;
                        deletedSize += stats.size;
                        
                    } catch (error) {
                        console.error(`   ❌ ${file} 삭제 실패:`, error.message);
                    }
                }
            }
        });
        
        const totalSizeMB = (deletedSize / 1024 / 1024).toFixed(2);
        
        console.log(`\n✅ 정리 완료`);
        console.log(`   삭제된 파일: ${deletedCount}개`);
        console.log(`   확보된 공간: ${totalSizeMB} MB`);
        
        if (dryRun) {
            console.log(`\n💡 실제로 삭제하려면 --dry-run 옵션 없이 실행하세요.`);
        }
        
    } catch (error) {
        console.error('로그 정리 중 오류:', error);
        process.exit(1);
    }
}

/**
 * 설정 파일에서 보존 기간 읽기
 */
function getRetentionFromConfig() {
    try {
        const configPath = path.join(__dirname, '../config/monitoring-config.json');
        
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            
            if (config.logging && config.logging.retention) {
                return parseRetentionDays(config.logging.retention);
            }
        }
    } catch (error) {
        console.warn('설정 파일을 읽을 수 없습니다. 기본값 사용:', error.message);
    }
    
    return 30; // 기본값
}

// CLI 실행
if (require.main === module) {
    const args = process.argv.slice(2);
    
    let retentionDays = null;
    let dryRun = false;
    
    // 인자 파싱
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--days' && args[i + 1]) {
            retentionDays = parseInt(args[i + 1], 10);
            i++;
        } else if (args[i] === '--dry-run') {
            dryRun = true;
        } else if (args[i] === '--help' || args[i] === '-h') {
            console.log(`
사용법: node scripts/cleanup-old-logs.js [옵션]

옵션:
  --days <숫자>    보존 기간 (일). 기본값: config/monitoring-config.json의 설정값 또는 30일
  --dry-run        시뮬레이션 모드 (실제로 삭제하지 않음)
  --help, -h       도움말 표시

예시:
  node scripts/cleanup-old-logs.js
  node scripts/cleanup-old-logs.js --days 7
  node scripts/cleanup-old-logs.js --dry-run
  node scripts/cleanup-old-logs.js --days 14 --dry-run
            `);
            process.exit(0);
        }
    }
    
    // 보존 기간이 지정되지 않으면 설정 파일에서 읽기
    if (retentionDays === null) {
        retentionDays = getRetentionFromConfig();
    }
    
    cleanupOldLogs(retentionDays, dryRun);
}

module.exports = { cleanupOldLogs, parseRetentionDays };
