@echo off
title Paper Plane Challenge
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed. Download the LTS version from https://nodejs.org
  echo   then run start.bat again.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo.
  echo   First run: installing packages. This takes a minute...
  call npm install
  if errorlevel 1 goto failed
)

rem cloudflared gives us a free public https link. Install it once if missing.
where cloudflared >nul 2>nul
if errorlevel 1 if not exist "C:\Program Files (x86)\cloudflared\cloudflared.exe" if not exist "C:\Program Files\cloudflared\cloudflared.exe" (
  echo.
  echo   Installing cloudflared from Cloudflare (one time only^)...
  winget install --id Cloudflare.cloudflared -e --silent --accept-source-agreements --accept-package-agreements
)

node scripts\start.mjs
if errorlevel 1 goto failed
exit /b 0

:failed
echo.
echo   Something went wrong. Read the messages above.
pause
exit /b 1
