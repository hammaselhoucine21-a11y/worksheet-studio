@echo off
setlocal
cd /d "%~dp0"
title Worksheet Studio - Install
echo.
echo  ==============================================
echo     Worksheet Studio - installing (all free)
echo  ==============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js is needed. Installing it now with winget...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  if errorlevel 1 (
    echo.
    echo  Could not install Node.js automatically.
    echo  Please install it from https://nodejs.org ^(the LTS button^), then run install.bat again.
    pause
    exit /b 1
  )
  echo.
  echo  Node.js is installed. Please CLOSE this window and double-click install.bat again.
  pause
  exit /b 0
)

echo  [1/4] Getting the app's parts...
call npm install --no-audit --no-fund
if errorlevel 1 goto fail

echo.
echo  [2/4] Getting the magic eraser (AI)...
call node scripts\get-model.mjs
if errorlevel 1 goto fail

echo.
echo  [3/4] Building the app...
call npm run build
if errorlevel 1 goto fail

echo.
echo  [4/4] Adding "Worksheet Studio" to the Desktop...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\make-shortcut.ps1"

echo.
echo  All done! Double-click "Worksheet Studio" on the Desktop to start.
echo.
pause
exit /b 0

:fail
echo.
echo  Something went wrong. Check the internet connection and run install.bat again.
pause
exit /b 1
