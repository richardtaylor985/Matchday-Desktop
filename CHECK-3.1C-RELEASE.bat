@echo off
setlocal
title Matchday Desktop 3.1c - Release Check
cd /d "%~dp0"

echo Matchday Desktop 3.1c Release Check
echo =====================================
echo.

set FAIL=0

if exist "desktop\main.js" (
  echo [OK] desktop shell
) else (
  echo [FAIL] desktop\main.js missing
  set FAIL=1
)

if exist "desktop\windows-integration.js" (
  echo [OK] Windows integration helper
) else (
  echo [FAIL] windows-integration.js missing
  set FAIL=1
)

findstr /C:"--uninstall-cleanup" "desktop\main.js" >nul 2>&1
if errorlevel 1 (
  echo [FAIL] uninstall cleanup mode missing
  set FAIL=1
) else (
  echo [OK] uninstall cleanup mode
)

findstr /C:"customUnInstall" "build\installer.nsh" >nul 2>&1
if errorlevel 1 (
  echo [FAIL] NSIS uninstall hook missing
  set FAIL=1
) else (
  echo [OK] NSIS uninstall hook
)

findstr /C:"settings-group select option" "apps\matchday-desktop\styles.css" >nul 2>&1
if errorlevel 1 (
  echo [FAIL] dropdown contrast fix missing
  set FAIL=1
) else (
  echo [OK] dropdown contrast fix
)

echo.
if "%FAIL%"=="0" (
  echo RELEASE CHECK PASSED
) else (
  echo RELEASE CHECK FAILED
)
echo.
pause
endlocal
