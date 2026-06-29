@echo off
title SentinelAI - Cyber Command Center Launcher
color 0B
cls

echo ======================================================================
echo                 SENTINELAI CYBER COMMAND CENTER LAUNCHER
echo ======================================================================
echo.

:: Check for Ollama
echo [*] Checking local AI status (Ollama)...
curl -s -I http://127.0.0.1:11434/ >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] WARNING: Ollama is not running on http://127.0.0.1:11434/
    echo     Please make sure Ollama is started to enable AI Assistant features.
    echo.
) else (
    echo [OK] Ollama is active and listening.
    echo.
)

echo Choose startup mode:
echo [1] Start Backend Only (FastAPI)
echo [2] Start Frontend Only (Vite React)
echo [3] Start Both (Recommended)
echo [4] Exit
echo.

set /p choice="Enter choice [1-4]: "

if "%choice%"=="1" goto start_backend
if "%choice%"=="2" goto start_frontend
if "%choice%"=="3" goto start_both
if "%choice%"=="4" goto exit

:start_backend
echo.
echo [*] Starting Backend (FastAPI on Port 8000)...
cd backend
if not exist .venv (
    echo [!] Error: Python virtual environment (.venv) not found.
    echo     Please initialize and validate backend dependencies first.
    pause
    goto exit
)
start "SentinelAI Backend Service" cmd /k "call .venv\Scripts\activate && uvicorn main:app --reload --port 8000"
cd ..
goto exit

:start_frontend
echo.
echo [*] Starting Frontend (Vite on Port 5173)...
cd frontend
if not exist node_modules (
    echo [!] Error: node_modules not found in frontend.
    echo     Please run 'npm install' in frontend directory first.
    pause
    goto exit
)
start "SentinelAI Frontend App" cmd /k "npm run dev"
cd ..
goto exit

:start_both
echo.
echo [*] Starting both Backend and Frontend...
cd backend
start "SentinelAI Backend Service" cmd /k "call .venv\Scripts\activate && uvicorn main:app --reload --port 8000"
cd ../frontend
start "SentinelAI Frontend App" cmd /k "npm run dev"
cd ..
goto exit

:exit
echo.
echo [*] Launcher finished.
echo ======================================================================
pause
