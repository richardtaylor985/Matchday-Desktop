@echo off
setlocal
title Matchday Desktop - Screensaver Configuration
cd /d "%~dp0"
call npm run screensaver:config
if errorlevel 1 pause
endlocal
