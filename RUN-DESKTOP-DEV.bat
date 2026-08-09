@echo off
setlocal
title Matchday Desktop - Desktop Mode
cd /d "%~dp0"
call npm run desktop:dev
if errorlevel 1 pause
endlocal
