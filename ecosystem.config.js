module.exports = {
  apps: [{
    name: 'meal-plan-nutrition',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    // 자동 재시작 설정
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s',
    // 메모리 모니터링
    max_memory_restart: '500M',
    // 로그 설정
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    // 환경 변수
    env_file: '.env'
  }]
}; 