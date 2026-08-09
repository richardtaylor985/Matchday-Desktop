@echo off
setlocal
title Matchday Desktop
cd /d "%~dp0"

call npm run desktop

if errorlevel 1 (
  echo.
  echo Matchday Desktop exited with an error.
  pause
)
endlocal
