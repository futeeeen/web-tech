@echo off
title Web Tech Local Server
echo ==========================================
echo   Web Capability Lab Local Dev Server
echo ==========================================
echo.
echo [1/2] Opening browser to http://localhost:8000/ ...
start http://localhost:8000/
echo.
echo [2/2] Starting Python HTTP server on port 8000...
echo (Press Ctrl+C inside this window to stop the server)
echo.
python -m http.server 8000
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Failed to start Python server. 
    echo Please make sure Python is installed and added to your System PATH.
    echo.
    pause
)
