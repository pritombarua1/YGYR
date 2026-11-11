@echo off
setlocal EnableExtensions
title YGYR - Paper Plane Challenge
cd /d "%~dp0"

rem ==========================================================================
rem  One double-click does everything:
rem    1. installs whatever this PC is missing (Node.js, Git, cloudflared)
rem    2. pulls the latest version from GitHub (if online)
rem    3. installs the packages, builds the app and starts the event
rem  Installs use winget (built into Windows 10/11). Windows may ask for
rem  permission once per install: click Yes.
rem ==========================================================================

set "REPO=https://github.com/pritombarua1/YGYR.git"

rem New installs land here, but this window's PATH doesn't know yet.
set "PATH=%PATH%;%ProgramFiles%\nodejs;%ProgramFiles%\Git\cmd;%ProgramFiles(x86)%\cloudflared;%ProgramFiles%\cloudflared;%LocalAppData%\Microsoft\WinGet\Links"

set "HAVE_WINGET=1"
where winget >nul 2>nul || set "HAVE_WINGET="

rem ---- Node.js -------------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  if not defined HAVE_WINGET goto nowinget
  echo.
  echo   Installing Node.js LTS ^(one time only^)...
  winget install --id OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements
  where node >nul 2>nul || goto nonode
)

rem ---- Git (for updates) ---------------------------------------------------
where git >nul 2>nul
if errorlevel 1 if defined HAVE_WINGET (
  echo.
  echo   Installing Git ^(one time only, used for updates^)...
  winget install --id Git.Git -e --silent --accept-source-agreements --accept-package-agreements
)

rem ---- cloudflared (free public https link) --------------------------------
where cloudflared >nul 2>nul
if errorlevel 1 if defined HAVE_WINGET (
  echo.
  echo   Installing cloudflared from Cloudflare ^(one time only^)...
  winget install --id Cloudflare.cloudflared -e --silent --accept-source-agreements --accept-package-agreements
)

rem ---- Latest version from GitHub ------------------------------------------
set "UPDATED="
where git >nul 2>nul
if not errorlevel 1 (
  if not exist .git (
    rem Downloaded as a ZIP: link this folder to GitHub so updates work from now on.
    echo.
    echo   Linking this folder to GitHub for updates...
    git init -q -b main
    git remote add origin "%REPO%" 2>nul
    git fetch -q origin main && git reset -q origin/main && echo   Linked.
  )
  for /f %%h in ('git rev-parse HEAD 2^>nul') do set "BEFORE=%%h"
  echo.
  echo   Checking GitHub for updates...
  git pull -q --ff-only 2>nul
  if errorlevel 1 (
    echo   Couldn't update ^(offline, or files were changed on this PC^). Using this version.
  ) else (
    for /f %%h in ('git rev-parse HEAD 2^>nul') do set "AFTER=%%h"
  )
)
if defined AFTER if not "%BEFORE%"=="%AFTER%" set "UPDATED=1"
if defined UPDATED echo   Updated to the latest version.

rem ---- Packages ------------------------------------------------------------
if not exist node_modules set "UPDATED=1"
if defined UPDATED (
  echo.
  echo   Installing packages. This takes a minute...
  call npm install --no-fund --no-audit
  if errorlevel 1 goto failed
)

node scripts\start.mjs
if errorlevel 1 goto failed
exit /b 0

:nowinget
echo.
echo   This PC doesn't have winget, so Node.js can't be installed automatically.
echo   Install "App Installer" from the Microsoft Store, or Node.js LTS from
echo   https://nodejs.org , then run start.bat again.
pause
exit /b 1

:nonode
echo.
echo   Node.js was installed, but this window can't see it yet.
echo   Close this window and double-click start.bat again.
pause
exit /b 1

:failed
echo.
echo   Something went wrong. Read the messages above.
pause
exit /b 1
