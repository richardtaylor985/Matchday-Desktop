@echo off
setlocal
title Matchday Desktop 3.2g - Dynamic Wallpaper Check
cd /d "%~dp0"

echo Matchday Desktop 3.2g Dynamic Wallpaper Check
echo ==============================================
echo.

set FAIL=0

if exist "desktop\set-wallpaper.ps1" (
  echo [OK] Windows wallpaper setter
) else (
  echo [FAIL] wallpaper setter missing
  set FAIL=1
)

if exist "desktop\get-wallpaper-state.ps1" (
  echo [OK] original wallpaper reader
) else (
  echo [FAIL] original wallpaper reader missing
  set FAIL=1
)

if exist "desktop\restore-wallpaper.ps1" (
  echo [OK] original wallpaper restore helper
) else (
  echo [FAIL] wallpaper restore helper missing
  set FAIL=1
)

findstr /C:"WALLPAPER_REFRESH_LIVE_MS" "desktop\main.js" >nul 2>&1
if errorlevel 1 (
  echo [FAIL] adaptive refresh logic missing
  set FAIL=1
) else (
  echo [OK] adaptive refresh logic
)

findstr /C:"restorePreviousWallpaper" "desktop\main.js" >nul 2>&1
if errorlevel 1 (
  echo [FAIL] wallpaper restoration logic missing
  set FAIL=1
) else (
  echo [OK] wallpaper restoration logic
)

if exist "desktop\attach-to-desktop.ps1" (
  echo [FAIL] legacy WorkerW helper still present
  set FAIL=1
) else (
  echo [OK] legacy WorkerW helper removed
)

echo.
if "%FAIL%"=="0" (
  echo 3.2G CHECK PASSED
) else (
  echo 3.2G CHECK FAILED
)
echo.
pause
endlocal
