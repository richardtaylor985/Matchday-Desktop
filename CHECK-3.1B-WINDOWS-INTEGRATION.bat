@echo off
setlocal
title Matchday Desktop - 3.1b4 Diagnostics
cd /d "%~dp0"

echo Matchday Desktop 3.1b4 Diagnostics
echo ==================================
echo.

if exist "desktop\windows-integration.js" (
  echo [OK] desktop\windows-integration.js
) else (
  echo [MISSING] desktop\windows-integration.js
)

if exist "desktop\preload.js" (
  echo [OK] desktop\preload.js
) else (
  echo [MISSING] desktop\preload.js
)

findstr /C:"matchdayWindows" "desktop\preload.js" >nul 2>&1
if errorlevel 1 (
  echo [MISSING] matchdayWindows bridge in preload.js
) else (
  echo [OK] matchdayWindows bridge in preload.js
)

findstr /C:"matchday:save-windows-settings" "desktop\main.js" >nul 2>&1
if errorlevel 1 (
  echo [MISSING] Windows settings IPC in main.js
) else (
  echo [OK] Windows settings IPC in main.js
)

echo.
pause
endlocal
