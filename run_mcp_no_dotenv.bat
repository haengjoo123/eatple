@echo off
echo Supabase MCP 서버를 환경 변수 로드 비활성화 옵션으로 시작합니다...

:: 환경 변수 로드 비활성화 옵션 설정
set DOTENV_LOAD=false
set DOTENV_CONFIG_PATH=none
set SUPABASE_URL=https://jtomekzwaqoosxuchwg.supabase.co
set SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0b21la3p3YXFvb3N4dWNod2ciLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcxNjM1NjI4NCwiZXhwIjoyMDMxOTMyMjg0fQ.eyJpC3MiOiJzdXBhYmFzZSIsInJlZiI6
set FASTMCP_LOG_LEVEL=ERROR
set NODE_ENV=production

:: 다른 환경 변수 제거
set youtube_api_key=
set news_api_key=
set gemini_api_key=
set session_secret=
set kakao_map_api_key=
set kakao_rest_api_key=
set kakao_javascript_key=
set node_env=
set naver_cloud_client_id=
set naver_cloud_client_secret=
set food_nutrition_api_key=
set log_level=
set google_ai_log_level=
set gemini_log_level=

echo 환경 변수 설정 완료
echo MCP 서버를 시작합니다...

:: MCP 서버 실행
uvx supabase-mcp-server@latest --no-dotenv

echo MCP 서버가 종료되었습니다.
pause