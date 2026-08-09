@echo off
setlocal
title Matchday Desktop - Fullscreen
cd /d "%~dp0"

call npm run desktop:fullscreen

if errorlevel 1 (
  echo.
  echo Matchday Desktop exited with an error.
  pause
)
endlocal
