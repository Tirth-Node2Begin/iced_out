@echo off
setlocal EnableDelayedExpansion

REM ===========================================================================
REM  Iced_out backend - double-click to start.
REM
REM  Everything it needs is checked first: PHP, a .env, a signing secret, the
REM  database, the schema, and seed data on a fresh install. Anything missing
REM  is either fixed or named, so this window never just closes on you.
REM
REM  Usage:  server.bat                 http://127.0.0.1:8000
REM          server.bat 9000            another port
REM          server.bat 8000 0.0.0.0    reachable from other machines
REM
REM  Bound to 127.0.0.1 rather than localhost, and that is a performance
REM  decision: on Windows "localhost" resolves to ::1 first, PHP's built-in
REM  server is IPv4-only, and every request pays for that failed attempt
REM  before falling back. Measured here: 40 ms per request over 127.0.0.1
REM  against 260 ms over localhost.
REM
REM  KEEP THIS FILE PLAIN ASCII WITH CRLF LINE ENDINGS. cmd.exe mis-parses a
REM  batch file saved with Unix line endings - it drops the first characters
REM  of lines - and mangles non-ASCII punctuation under codepage 437.
REM ===========================================================================

REM Run from this file's own folder, whatever the shell's current directory is.
cd /d "%~dp0"

set "PORT=%~1"
if "%PORT%"=="" set "PORT=8000"

set "HOST=%~2"
if "%HOST%"=="" set "HOST=127.0.0.1"

echo.
echo   ICED_OUT BACKEND
echo   ----------------------------------------------------------------
echo.

REM ---------------------------------------------------------------- find PHP
REM PATH first, so a deliberately installed PHP wins over the XAMPP one.
set "PHP="
for /f "delims=" %%P in ('where php 2^>nul') do (
    if not defined PHP set "PHP=%%P"
)
if not defined PHP if exist "C:\xampp\php\php.exe" set "PHP=C:\xampp\php\php.exe"
if not defined PHP if exist "C:\php\php.exe" set "PHP=C:\php\php.exe"

if not defined PHP (
    echo   PHP was not found.
    echo.
    echo   Install XAMPP, or add php.exe to your PATH, then run this again.
    echo   Looked in: PATH, C:\xampp\php, C:\php
    echo.
    pause
    exit /b 1
)

REM Read the version from `php -v`, not from `php -r "echo PHP_VERSION;"`:
REM cmd's for/f strips the inner quotes of the second form and it falls apart.
set "PHPVER=?"
for /f "tokens=2" %%V in ('"%PHP%" -v') do (
    set "PHPVER=%%V"
    goto :gotphp
)
:gotphp
echo   PHP        %PHPVER%  ^(%PHP%^)

REM ------------------------------------------------------------------- .env
if not exist ".env" (
    if not exist ".env.example" (
        echo.
        echo   Neither .env nor .env.example is here. Is this the backend folder?
        echo.
        pause
        exit /b 1
    )
    copy /y ".env.example" ".env" >nul
    echo   .env       created from .env.example
) else (
    echo   .env       found
)

REM ------------------------------------------------- secret, database, schema
echo.
echo   Checking the database...
"%PHP%" bin\console.php preflight
if errorlevel 1 (
    echo.
    pause
    exit /b 1
)

REM ------------------------------------------------------------------- serve
echo.
echo   ----------------------------------------------------------------
echo   API      http://%HOST%:%PORT%/api/v1
echo   Health   http://%HOST%:%PORT%/api/v1/health
echo.
echo   OPEN THE SITE AT  http://127.0.0.1:3000   (not localhost:3000)
echo.
echo   The frontend calls the API on whatever host the page is open on, so
echo   the two always match. They have to: 127.0.0.1 and localhost are
echo   different sites to a browser, and a session cookie is not sent across
echo   that line - you would look signed out on every request.
echo.
echo   Press Ctrl+C to stop.
echo   ----------------------------------------------------------------
echo.

REM dev-server.php reproduces what api\.htaccess does under Apache, so the
REM built-in server routes exactly like the real deployment.
"%PHP%" -S %HOST%:%PORT% -t api dev-server.php

REM Reached when the server exits - including when the port is already taken,
REM which is the one failure that otherwise flashes past too fast to read.
echo.
echo   The server stopped. If that was immediate, port %PORT% is probably in
echo   use - try:  server.bat 9000
echo.
pause
endlocal
