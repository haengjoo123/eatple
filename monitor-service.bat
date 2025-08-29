@echo off
echo Meal Plan Nutrition Service 모니터링...

:loop
cls
echo ========================================
echo Meal Plan Nutrition Service 상태
echo ========================================
echo.

REM 서버 프로세스 확인
echo [1] Node.js 프로세스 상태:
tasklist /fi "imagename eq node.exe" 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js 프로세스가 실행되지 않음
) else (
    echo ✅ Node.js 프로세스 실행 중
)

echo.

REM 포트 확인
echo [2] 포트 3000 상태:
netstat -ano | findstr :3000 >nul
if %errorlevel% equ 0 (
    echo ✅ 포트 3000에서 서비스 실행 중
) else (
    echo ❌ 포트 3000에서 서비스 실행되지 않음
)

echo.

REM PM2 상태 확인 (PM2가 설치된 경우)
where pm2 >nul 2>nul
if %errorlevel% equ 0 (
    echo [3] PM2 상태:
    pm2 status
) else (
    echo [3] PM2가 설치되지 않음
)

echo.

REM 최근 로그 확인
echo [4] 최근 로그 (마지막 5줄):
if exist "logs\combined.log" (
    powershell "Get-Content logs\combined.log -Tail 5"
) else (
    echo 로그 파일이 없습니다.
)

echo.
echo ========================================
echo 5초 후 자동 새로고침 (Ctrl+C로 종료)
echo ========================================

timeout /t 5 /nobreak >nul
goto loop 