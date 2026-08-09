@echo off
setlocal
title Matchday Desktop - Live Desktop Diagnostic
cd /d "%~dp0"

echo.
echo Matchday Desktop 3.2d - Live Desktop Diagnostic
echo ================================================
echo.

if not exist "node_modules\electron\package.json" (
  echo Electron dependencies are missing.
  echo Installing project dependencies...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Expected visual stack:
echo   Windows wallpaper
echo   Matchday Desktop
echo   Desktop icons
echo   Normal application windows
echo   Taskbar
echo.
echo Press Ctrl+C in this window to stop the test if needed.
echo.

call npm run desktop:wallpaper

echo.
echo Live Desktop exited.
echo.
pause
endlocal
