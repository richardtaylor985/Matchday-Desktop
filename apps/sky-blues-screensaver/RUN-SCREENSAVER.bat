@echo off
title Sky Blues Screensaver
cd /d "%~dp0"

if not exist "config.local.json" (
  echo.
  echo FIRST RUN SETUP
  echo ------------------------------
  echo config.local.json was not found.
  echo.
  echo Copying config.local.example.json to config.local.json...
  copy /Y "config.local.example.json" "config.local.json" >nul
  echo.
  echo Please open config.local.json in Notepad and replace:
  echo PASTE-YOUR-API-KEY-HERE
  echo with your football-data.org API key.
  echo.
  pause
  start notepad "config.local.json"
  exit /b
)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js was not found on this computer.
  echo Install Node.js 18 or later from https://nodejs.org/
  echo then run this file again.
  echo.
  pause
  exit /b 1
)

start "" http://localhost:8787
node server.js
