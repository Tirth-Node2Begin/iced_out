@echo off
setlocal

REM ===========================================================================
REM  Iced_out - start EVERYTHING, in ONE terminal window, four tabs.
REM
REM    tab 1   SHOP backend    127.0.0.1:8000
REM    tab 2   CRM  backend    127.0.0.1:8100
REM    tab 3   SHOP site       127.0.0.1:3000
REM    tab 4   CRM  site       127.0.0.1:3100
REM
REM  Then it waits for both sites to answer and opens them in your browser,
REM  one tab each.
REM
REM  The two backends are separate PHP processes that open the SAME MySQL
REM  database (iced_out). Neither ever calls the other -- that shared database
REM  is the whole connection between the shop and the CRM.
REM
REM  Stop everything: Ctrl+C in each tab, or just close the window.
REM
REM  KEEP THIS FILE PLAIN ASCII WITH CRLF LINE ENDINGS, and never put a bare
REM  >  or  &  inside an echo line -- cmd reads them as redirect and command
REM  separators, not as text.
REM ===========================================================================

cd /d "%~dp0"

if not exist "backend\server.bat" goto :nofolder
if not exist "iced-out-crm\backend\server.bat" goto :nofolder
if not exist "frontend\package.json" goto :nofolder
if not exist "iced-out-crm\frontend\package.json" goto :nofolder

echo.
echo   ICED_OUT - STARTING SHOP + CRM
echo   ----------------------------------------------------------------
echo.

if not exist "frontend\node_modules" echo   NOTE: frontend\node_modules is missing - run npm install there first.
if not exist "iced-out-crm\frontend\node_modules" echo   NOTE: iced-out-crm\frontend\node_modules is missing - run npm install there first.

where wt.exe >nul 2>&1
if errorlevel 1 goto :nowt

REM ---------------------------------------------------------------- one window
REM  Windows Terminal builds ONE window from a chain of `new-tab` commands
REM  joined by semicolons. It is written as a single long line on purpose:
REM  splitting it with ^ puts the semicolon at the start of a continued line,
REM  where cmd eats it and the whole chain collapses into one tab.
REM
REM  -d takes each tab's starting folder. Never pass %~dp0 to it on its own --
REM  that value ends in a backslash, and a backslash immediately before the
REM  closing quote escapes the quote instead of ending the path. Every -d here
REM  has a subfolder after it, so none of them end in one.
echo   Opening one terminal with four tabs...
wt.exe new-tab --title "SHOP backend 8000" -d "%~dp0backend" cmd /k call "%~dp0backend\server.bat" ; new-tab --title "CRM backend 8100" -d "%~dp0iced-out-crm\backend" cmd /k call "%~dp0iced-out-crm\backend\server.bat" ; new-tab --title "SHOP site 3000" -d "%~dp0frontend" cmd /k npm run dev ; new-tab --title "CRM site 3100" -d "%~dp0iced-out-crm\frontend" cmd /k npm run dev

echo.
echo   Waiting for the two sites to answer...
echo   (a first Next.js compile can take a while - this waits up to 3 minutes)
echo.

call :waitport 3000 "SHOP site"
call :waitport 3100 "CRM site"

echo.
echo   Opening your browser...
start "" "http://127.0.0.1:3000"
start "" "http://127.0.0.1:3100"

echo.
echo   ----------------------------------------------------------------
echo   SHOP   http://127.0.0.1:3000      API  http://127.0.0.1:8000/api/v1
echo   CRM    http://127.0.0.1:3100      API  http://127.0.0.1:8100/api/v1
echo.
echo   Sign in to the CRM with  admin@gmail.com  /  admin123
echo.
echo   Use 127.0.0.1, NOT localhost - they are different sites to a browser
echo   and the session cookie is not sent across that line.
echo   ----------------------------------------------------------------
echo.
echo   This window has done its job. Everything runs in the other window.
echo.
pause
exit /b 0

REM ------------------------------------------------------------ wait for a port
:waitport
set "WP=%~1"
set "WN=%~2"
set /a WTRIES=0
:waitloop
set /a WTRIES+=1
if %WTRIES% GTR 90 goto :waitslow
curl.exe -s -o nul -m 2 "http://127.0.0.1:%WP%/" >nul 2>&1
if not errorlevel 1 (
    echo     %WN% is up on %WP%
    exit /b 0
)
REM ping is the sleep that works with or without a console attached; timeout
REM /t needs a real stdin and fails when this script is piped or scheduled.
ping -n 3 127.0.0.1 >nul 2>&1
goto :waitloop

:waitslow
echo     %WN% did not answer on %WP% yet - opening it anyway.
exit /b 0

REM ------------------------------------------------- no Windows Terminal found
:nowt
echo   Windows Terminal (wt.exe) was not found, so four tabs are not possible.
echo   Opening four separate windows instead.
echo.
echo   To get the single-window version, install Windows Terminal from the
echo   Microsoft Store and run this file again.
echo.
start "SHOP backend 8000" cmd /c ""%~dp0backend\server.bat""
start "CRM backend 8100" cmd /c ""%~dp0iced-out-crm\backend\server.bat""
start "SHOP site 3000" /D "%~dp0frontend" cmd /k npm run dev
start "CRM site 3100" /D "%~dp0iced-out-crm\frontend" cmd /k npm run dev
call :waitport 3000 "SHOP site"
call :waitport 3100 "CRM site"
start "" "http://127.0.0.1:3000"
start "" "http://127.0.0.1:3100"
pause
exit /b 0

:nofolder
echo.
echo   Cannot find the shop and CRM folders next to this file.
echo   Keep start-all.bat in the Iced-Out project root.
echo.
pause
exit /b 1
