@echo off
setlocal
title Matchday Desktop 3.2g2 - Packaged Resource Check
cd /d "%~dp0"

echo Matchday Desktop 3.2g2 Packaged Resource Check
echo ===============================================
echo.

set TARGET=dist\win-unpacked\resources\desktop-scripts

if not exist "%TARGET%" (
  echo [FAIL] %TARGET% does not exist.
  echo Build the installer/unpacked app first.
  echo.
  pause
  exit /b 1
)

set FAIL=0

for %%F in (
  set-wallpaper.ps1
  get-wallpaper-state.ps1
  restore-wallpaper.ps1
) do (
  if exist "%TARGET%\%%F" (
    echo [OK] %%F
  ) else (
    echo [FAIL] %%F missing
    set FAIL=1
  )
)

echo.
if "%FAIL%"=="0" (
  echo PACKAGED RESOURCE CHECK PASSED
) else (
  echo PACKAGED RESOURCE CHECK FAILED
)

echo.
pause
endlocal
