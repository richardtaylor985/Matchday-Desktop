@echo off
setlocal
title Matchday Desktop 3.2 RC1 - Smoke Check
cd /d "%~dp0"

echo Matchday Desktop 3.2 RC1 Smoke Check
echo =====================================
echo.
set FAIL=0

for %%F in (
  "desktop\main.js"
  "desktop\preload.js"
  "desktop\windows-integration.js"
  "desktop\set-wallpaper.ps1"
  "desktop\get-wallpaper-state.ps1"
  "desktop\restore-wallpaper.ps1"
  "apps\matchday-desktop\index.html"
  "apps\matchday-desktop\app.js"
  "apps\matchday-desktop\settings.js"
  "apps\matchday-desktop\club-selector.js"
) do (
  if exist %%F (
    echo [OK] %%~F
  ) else (
    echo [FAIL] %%~F missing
    set FAIL=1
  )
)

findstr /C:"3.2.0-rc.1" "package.json" >nul 2>&1
if errorlevel 1 (
  echo [FAIL] RC package version
  set FAIL=1
) else (
  echo [OK] RC package version
)

findstr /C:"SystemParametersInfoGetUInt" "desktop\windows-integration.js" >nul 2>&1
if errorlevel 1 (
  echo [FAIL] 3.2i1 screensaver timeout verification fix
  set FAIL=1
) else (
  echo [OK] 3.2i1 screensaver timeout verification fix
)

findstr /C:"screen.getAllDisplays()" "desktop\main.js" >nul 2>&1
if errorlevel 1 (
  echo [FAIL] multi-monitor screensaver support
  set FAIL=1
) else (
  echo [OK] multi-monitor screensaver support
)

echo.
if "%FAIL%"=="0" (
  echo MATCHDAY DESKTOP 3.2 RC1 SMOKE CHECK PASSED
) else (
  echo MATCHDAY DESKTOP 3.2 RC1 SMOKE CHECK FAILED
)
echo.
pause
endlocal
