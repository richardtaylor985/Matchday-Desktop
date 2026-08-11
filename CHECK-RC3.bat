@echo off
setlocal
title Matchday Desktop 3.2 RC3 - Release Check
cd /d "%~dp0"

echo Matchday Desktop 3.2 RC3 Release Check
echo ======================================
echo.
set FAIL=0

findstr /C:"3.2.0-rc.3" "package.json" >nul 2>&1
if errorlevel 1 (
  echo [FAIL] RC3 package version
  set FAIL=1
) else (
  echo [OK] RC3 package version
)

findstr /C:"wallpaperOwnerToken" "desktop\main.js" >nul 2>&1
if errorlevel 1 (
  echo [FAIL] ownership token logic
  set FAIL=1
) else (
  echo [OK] ownership token logic
)

findstr /C:"stillOwnsWallpaper" "desktop\main.js" >nul 2>&1
if errorlevel 1 (
  echo [FAIL] ownership validation
  set FAIL=1
) else (
  echo [OK] ownership validation
)

findstr /C:"renderer-club-mismatch" "desktop\main.js" >nul 2>&1
if errorlevel 1 (
  echo [FAIL] renderer club safety gate
  set FAIL=1
) else (
  echo [OK] renderer club safety gate
)

findstr /C:"memory-sample" "desktop\main.js" >nul 2>&1
if errorlevel 1 (
  echo [FAIL] memory diagnostics
  set FAIL=1
) else (
  echo [OK] memory diagnostics
)

echo.
if "%FAIL%"=="0" (
  echo MATCHDAY DESKTOP 3.2 RC3 CHECK PASSED
) else (
  echo MATCHDAY DESKTOP 3.2 RC3 CHECK FAILED
)
echo.
pause
endlocal
