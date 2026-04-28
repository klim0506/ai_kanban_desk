@echo off
echo =============================================
echo  Kanban Board - Local Dev Mode
echo =============================================
echo.
echo Доска: http://localhost:3000
echo.
echo Для запуска в Docker используйте:
echo   docker compose up --build
echo.
node_modules\.bin\next dev --turbo
