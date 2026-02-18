@echo off
setlocal enabledelayedexpansion

echo.
echo ============================================
echo   OllamaBro - First-Time Setup
echo ============================================
echo.

:: ── 0. Locate project root ──────────────────────────────────────────────────
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "PROXY_DIR=%ROOT%\proxy_server"

:: ── 1. Check Node.js ─────────────────────────────────────────────────────────
echo [1/5] Checking for Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo   ERROR: Node.js not found.
    echo   Download and install it from https://nodejs.org/ then re-run this script.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo   Found Node.js %NODE_VER%
echo.

:: ── 2. Install proxy server dependencies ─────────────────────────────────────
echo [2/5] Installing proxy server dependencies...
pushd "%PROXY_DIR%"
call npm install --silent
if %errorlevel% neq 0 (
    echo   ERROR: npm install failed. Check the output above.
    popd
    pause
    exit /b 1
)
popd
echo   Done.
echo.

:: ── 3. Install PM2 (if not already present) ──────────────────────────────────
echo [3/5] Checking for PM2...
where pm2 >nul 2>&1
if %errorlevel% neq 0 (
    echo   PM2 not found - installing globally...
    call npm install -g pm2 --silent
    if %errorlevel% neq 0 (
        echo   ERROR: Failed to install PM2.
        pause
        exit /b 1
    )
    echo   PM2 installed.
) else (
    for /f "tokens=*" %%v in ('pm2 -v') do set PM2_VER=%%v
    echo   Found PM2 v%PM2_VER%
)
echo.

:: ── 4. Start proxy server with PM2 ───────────────────────────────────────────
echo [4/5] Starting proxy server with PM2...
pushd "%PROXY_DIR%"

:: Stop existing instance if running (ignore errors if not found)
pm2 stop ollama-proxy >nul 2>&1
pm2 delete ollama-proxy >nul 2>&1

pm2 start server.js --name ollama-proxy
if %errorlevel% neq 0 (
    echo   ERROR: Failed to start proxy server.
    popd
    pause
    exit /b 1
)
pm2 save >nul 2>&1
popd
echo.

:: ── 5. Register native messaging host (for Kokoro TTS) ───────────────────────
echo [5/5] Registering native messaging host for Kokoro TTS...

set "HOST_BAT=%PROXY_DIR%\native-host.bat"
set "MANIFEST_PATH=%PROXY_DIR%\com.ollamabro.proxy.json"
set "HOST_NAME=com.ollamabro.proxy"
set "EXT_ID=gkpfpdekobmonacdgjgbfehilnloaacm"

if not exist "%HOST_BAT%" (
    echo   ERROR: native-host.bat not found at:
    echo     %HOST_BAT%
    pause
    exit /b 1
)

set "HOST_BAT_ESCAPED=%HOST_BAT:\=\\%"

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

set "REG_KEY=HKCU\Software\Google\Chrome\NativeMessagingHosts\%HOST_NAME%"
REG ADD "%REG_KEY%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul 2>&1
if %errorlevel% neq 0 (
    echo   ERROR: Failed to add registry entry. Try running as Administrator.
    pause
    exit /b 1
)
echo   Done.
echo.

:: ── Done ─────────────────────────────────────────────────────────────────────
echo ============================================
echo   Setup complete!
echo ============================================
echo.
echo   The proxy server is running (managed by PM2).
echo   It will restart automatically after a system reboot.
echo.
echo   Next step: load the extension in Chrome
echo     1. Go to chrome://extensions
echo     2. Enable Developer mode
echo     3. Click "Load unpacked" and select:
echo        %ROOT%\chrome_extension
echo.
echo   NOTE: If you ever move this project folder,
echo         re-run setup.bat to update the paths.
echo.
pause
