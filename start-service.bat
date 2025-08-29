@echo off
echo Meal Plan Nutrition Service 시작 중...

REM 로그 디렉토리 생성
if not exist "logs" mkdir logs

REM PM2가 설치되어 있는지 확인
where pm2 >nul 2>nul
if %errorlevel% neq 0 (
    echo PM2가 설치되어 있지 않습니다. 설치 중...
    npm install -g pm2
)

REM PM2로 서비스 시작
echo PM2로 서비스 시작 중...
pm2 start ecosystem.config.js --env production

REM PM2 시작 스크립트 생성 (시스템 재부팅 시 자동 시작)
pm2 startup
pm2 save

echo 서비스가 시작되었습니다!
echo 상태 확인: pm2 status
echo 로그 확인: pm2 logs meal-plan-nutrition
echo 서비스 중지: pm2 stop meal-plan-nutrition
echo 서비스 재시작: pm2 restart meal-plan-nutrition
pause 