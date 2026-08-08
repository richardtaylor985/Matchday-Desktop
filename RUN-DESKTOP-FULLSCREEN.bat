@echo off
setlocal
title Matchday Desktop
cd /d "%~dp0"

echo.
echo Matchday Desktop
echo ================
echo.

if not exist "node_modules\.bin\electron.cmd" (
  echo Electron is not installed in this project.
  echo Installing/updating desktop dependencies...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo ERROR: npm install failed.
    echo.
    pause
    exit /b 1
  )
)

echo Starting Matchday Desktop full screen...
echo.
call npm run desktop

if errorlevel 1 (
  echo.
  echo ERROR: Matchday Desktop exited with an error.
  echo Please copy the error shown above.
  echo.
  pause
  exit /b 1
)

endlocal
