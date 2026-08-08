@echo off
title Matchday Desktop - Desktop Shell
cd /d "%~dp0"

if not exist node_modules (
  echo Installing desktop dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

call npm run desktop:dev
