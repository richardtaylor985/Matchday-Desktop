@echo off
setlocal
title Matchday Desktop - Live Desktop Test
cd /d "%~dp0"
call npm run desktop:wallpaper
if errorlevel 1 pause
endlocal
