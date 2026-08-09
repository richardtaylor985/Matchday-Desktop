@echo off
setlocal
title Matchday Desktop - Dynamic Wallpaper
cd /d "%~dp0"

echo.
echo Matchday Desktop 3.2e - Dynamic Wallpaper
echo =========================================
echo.

if not exist "node_modules\electron\package.json" (
  echo Installing project dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Matchday will render invisibly and update the genuine Windows wallpaper.
echo Desktop icons and normal windows remain fully native.
echo Refresh interval for this first test: 60 seconds.
echo.
echo Press Ctrl+C to stop the renderer.
echo.

call npm run desktop:dynamic-wallpaper

echo.
echo Dynamic Wallpaper exited.
pause
endlocal
