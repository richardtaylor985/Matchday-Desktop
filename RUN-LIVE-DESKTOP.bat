@echo off
setlocal
title Matchday Desktop - Live Desktop
cd /d "%~dp0"

if not exist "node_modules\electron\package.json" (
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

call npm run desktop:wallpaper
endlocal
