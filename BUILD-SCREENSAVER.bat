@echo off
cd /d "%~dp0"
call npm run build:scr
if errorlevel 1 pause
