@echo off
setlocal
title Matchday Desktop - Screensaver Mode
cd /d "%~dp0"
call npm run screensaver
if errorlevel 1 pause
endlocal
