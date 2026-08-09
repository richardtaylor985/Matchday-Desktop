@echo off
setlocal
title Matchday Desktop - Build Installer
cd /d "%~dp0"

echo.
echo Matchday Desktop 3.1a - Installer Build
echo ========================================
echo.

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

call npm run build:installer

if errorlevel 1 (
  echo.
  echo Installer build failed.
  pause
  exit /b 1
)

echo.
echo Installer build complete.
echo Output folder:
echo   dist
echo.
pause
endlocal
