@echo off
echo Windows 서비스로 등록 중...

REM Node.js가 설치되어 있는지 확인
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js가 설치되어 있지 않습니다.
    echo https://nodejs.org 에서 Node.js를 설치해주세요.
    pause
    exit /b 1
)

REM 현재 디렉토리를 서비스 경로로 설정
set SERVICE_PATH=%~dp0
set SERVICE_NAME=MealPlanNutritionService
set SERVICE_DISPLAY=Meal Plan Nutrition Data Collection Service
set SERVICE_DESCRIPTION=영양 정보 자동 수집 서비스

REM nssm을 사용하여 서비스 등록
nssm install %SERVICE_NAME% "%SERVICE_PATH%node.exe" "%SERVICE_PATH%server.js"
nssm set %SERVICE_NAME% AppDirectory "%SERVICE_PATH%"
nssm set %SERVICE_NAME% DisplayName "%SERVICE_DISPLAY%"
nssm set %SERVICE_NAME% Description "%SERVICE_DESCRIPTION%"
nssm set %SERVICE_NAME% Start SERVICE_AUTO_START
nssm set %SERVICE_NAME% AppStdout "%SERVICE_PATH%logs\service.log"
nssm set %SERVICE_NAME% AppStderr "%SERVICE_PATH%logs\service-error.log"

REM 로그 디렉토리 생성
if not exist "%SERVICE_PATH%logs" mkdir "%SERVICE_PATH%logs"

echo 서비스 등록 완료!
echo 서비스 이름: %SERVICE_NAME%
echo 서비스 시작: net start %SERVICE_NAME%
echo 서비스 중지: net stop %SERVICE_NAME%
echo 서비스 제거: nssm remove %SERVICE_NAME% confirm
pause 