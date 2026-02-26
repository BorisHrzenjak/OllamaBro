@echo off
echo.
echo ============================================
echo   OllamaBro - Native Messaging Host Setup
echo ============================================
echo.

node "%~dp0install.js"
if %errorlevel% neq 0 (
    echo.
    echo Registration failed. Make sure Node.js is installed.
    pause
    exit /b 1
)

echo.
echo NOTE: If you move this project folder, re-run this script to update paths.
echo.
pause
