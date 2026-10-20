@echo off
cd /d "%~dp0"
title Worksheet Studio - Update
where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed. Download the newest ZIP from GitHub instead, then run install.bat.
  pause
  exit /b 1
)
git pull
call npm install --no-audit --no-fund
call node scripts\get-model.mjs
call npm run build
echo.
echo Updated. Start it from the Desktop icon.
pause
