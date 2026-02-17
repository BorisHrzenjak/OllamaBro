@echo off
setlocal enabledelayedexpansion

echo.
echo ============================================
echo   OllamaBro - Native Messaging Host Setup
echo ============================================
echo.

:: Get the directory where this script lives
set "SCRIPT_DIR=%~dp0"
:: Remove trailing backslash
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

set "PROXY_DIR=%SCRIPT_DIR%\proxy_server"
set "HOST_BAT=%PROXY_DIR%\native-host.bat"
set "MANIFEST_PATH=%PROXY_DIR%\com.ollamabro.proxy.json"
set "HOST_NAME=com.ollamabro.proxy"
set "EXT_ID=gkpfpdekobmonacdgjgbfehilnloaacm"

:: Check that native-host.bat exists
if not exist "%HOST_BAT%" (
    echo ERROR: native-host.bat not found at:
    echo   %HOST_BAT%
    echo.
    echo Make sure you run this script from the OllamaBar project root.
    pause
    exit /b 1
)

:: Escape backslashes for JSON
set "HOST_BAT_ESCAPED=%HOST_BAT:\=\\%"

:: Write the manifest file
echo Writing manifest to: %MANIFEST_PATH%
(
echo {
echo   "name": "%HOST_NAME%",
echo   "description": "OllamaBro Proxy Server Manager",
echo   "path": "%HOST_BAT_ESCAPED%",
echo   "type": "stdio",
echo   "allowed_origins": [
echo     "chrome-extension://%EXT_ID%/"
echo   ]
echo }
) > "%MANIFEST_PATH%"

:: Add registry entry (HKCU - no admin needed)
set "REG_KEY=HKCU\Software\Google\Chrome\NativeMessagingHosts\%HOST_NAME%"
echo.
echo Adding registry entry: %REG_KEY%
REG ADD "%REG_KEY%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul 2>&1

if %errorlevel% equ 0 (
    echo.
    echo ============================================
    echo   Setup complete!
    echo ============================================
    echo.
    echo The extension can now auto-start the proxy
    echo server when you select Kokoro TTS.
    echo.
    echo NOTE: If you move this project folder,
    echo       re-run this script to update paths.
    echo.
) else (
    echo.
    echo ERROR: Failed to add registry entry.
    echo Try running this script as Administrator.
    echo.
)

pause
