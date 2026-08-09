@echo off
setlocal
title Matchday Desktop - Build Release
cd /d "%~dp0"

echo.
echo Matchday Desktop 3.1a - Release Build
echo ======================================
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

call npm run build:release

if errorlevel 1 (
  echo.
  echo Release build failed.
  pause
  exit /b 1
)

echo.
echo Release build complete.
echo.
echo Expected installer:
echo   dist\Matchday-Desktop-Setup-3.1.0.exe
echo.
echo Screensaver test artifact remains in:
echo   dist\win-unpacked\Matchday Desktop.scr
echo.
pause
endlocal
