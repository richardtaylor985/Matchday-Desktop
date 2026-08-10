@echo off
setlocal
title Matchday Desktop 3.2i - Release Hardening Check
cd /d "%~dp0"

echo Matchday Desktop 3.2i Release Hardening Check
echo =============================================
echo.

set FAIL=0

for %%F in (
  "desktop\main.js"
  "desktop\preload.js"
  "desktop\windows-integration.js"
  "desktop\set-wallpaper.ps1"
  "desktop\get-wallpaper-state.ps1"
  "desktop\restore-wallpaper.ps1"
) do (
  if exist %%F (
    echo [OK] %%~F
  ) else (
    echo [FAIL] %%~F missing
    set FAIL=1
  )
)

findstr /C:"SPI_SETSCREENSAVETIMEOUT" "desktop\windows-integration.js" >nul 2>&1
if errorlevel 1 (
  echo [FAIL] Live Windows screensaver timeout API missing
  set FAIL=1
) else (
  echo [OK] Live Windows screensaver timeout API
)

findstr /C:"getScreenSaverDiagnostics" "desktop\windows-integration.js" >nul 2>&1
if errorlevel 1 (
  echo [FAIL] Screensaver verification missing
  set FAIL=1
) else (
  echo [OK] Screensaver verification
)

findstr /C:"screen.getAllDisplays()" "desktop\main.js" >nul 2>&1
if errorlevel 1 (
  echo [FAIL] Multi-monitor screensaver support missing
  set FAIL=1
) else (
  echo [OK] Multi-monitor screensaver support
)

findstr /C:"restorePreviousWallpaper" "desktop\main.js" >nul 2>&1
if errorlevel 1 (
  echo [FAIL] Wallpaper restore path missing
  set FAIL=1
) else (
  echo [OK] Wallpaper restore path
)

echo.
if "%FAIL%"=="0" (
  echo 3.2I RELEASE CHECK PASSED
) else (
  echo 3.2I RELEASE CHECK FAILED
)
echo.
pause
endlocal
