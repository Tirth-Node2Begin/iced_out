@echo off
setlocal

REM ===========================================================================
REM  Iced_out - start BOTH backends, one double-click.
REM
REM  There are two of them because there are two sites:
REM
REM    SHOP   frontend 3000  ->  backend 127.0.0.1:8000   (what customers see)
REM    CRM    frontend 3100  ->  backend 127.0.0.1:8100   (what you run it with)
REM
REM  They are NOT plugged into each other. Neither backend ever calls the
REM  other; they are two separate PHP processes that happen to open the SAME
REM  MySQL database (iced_out). That shared database IS the connection --
REM  publishing a product in the CRM writes a row, and the shop's backend reads
REM  that same row on its next request.
REM
REM  Which means: the CRM works with the shop backend switched off, and the
REM  shop works with the CRM backend switched off. You only need both running
REM  when you want to use both at once, which is what this file is for.
REM
REM  Each backend opens in its own window so you can read its log and stop it
REM  with Ctrl+C on its own. Closing THIS window does not stop them.
REM
REM  KEEP THIS FILE PLAIN ASCII WITH CRLF LINE ENDINGS, and never put a bare
REM  > or & inside an echo line -- cmd reads them as redirect and command
REM  separators, which is what made an earlier version of this file print
REM  "The filename, directory name, or volume label syntax is incorrect."
REM ===========================================================================

cd /d "%~dp0"

if not exist "backend\server.bat" goto :nofolder
if not exist "iced-out-crm\backend\server.bat" goto :nofolder

echo.
echo   ICED_OUT - STARTING BOTH BACKENDS
echo   ----------------------------------------------------------------
echo.
echo   Two windows are opening. Each checks PHP, its .env, the database
echo   and the schema before it serves, so give them a few seconds.
echo.

REM The full path, in DOUBLED quotes, and no /D.
REM
REM   `start "title" /D "folder" cmd /c server.bat` looks right and fails:
REM   the spawned window does not end up in that folder, cannot find
REM   server.bat, and closes again instantly because of the /c -- so nothing
REM   starts and nothing says why. Handing cmd the whole path instead works,
REM   and the quotes have to be DOUBLED because cmd strips one pair before
REM   parsing and this project's path contains a space ("EB projects").
REM
REM   server.bat does its own `cd /d "%~dp0"`, so it does not need the
REM   working directory set for it.
start "Iced_out SHOP backend - port 8000" cmd /c ""%~dp0backend\server.bat""
start "Iced_out CRM backend - port 8100" cmd /c ""%~dp0iced-out-crm\backend\server.bat""

echo   SHOP API    http://127.0.0.1:8000/api/v1/health
echo   CRM  API    http://127.0.0.1:8100/api/v1/health
echo.
echo   Then start whichever site you want, each in its own terminal:
echo.
echo     SHOP   cd frontend                 then  npm run dev
echo            open http://127.0.0.1:3000
echo.
echo     CRM    cd iced-out-crm\frontend    then  npm run dev
echo            open http://127.0.0.1:3100
echo.
echo   Open them on 127.0.0.1, NOT localhost - a session cookie set on one is
echo   not sent to the other, and you would look signed out on every request.
echo.
echo   ----------------------------------------------------------------
echo.
pause
exit /b 0

:nofolder
echo.
echo   Cannot find the two backend folders next to this file.
echo   Keep start-backends.bat in the Iced-Out project root.
echo.
pause
exit /b 1
