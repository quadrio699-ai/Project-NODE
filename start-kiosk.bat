@echo off
title Project-NODE - Flagship Display Launcher
echo Starting Project-NODE server...

REM AUTO_OPEN=false so server.js doesn't ALSO open a normal browser
REM window on top of the kiosk one below.
set AUTO_OPEN=false
start "ProjectNODE-Server" /min cmd /c "node server.js"

echo Waiting for the server to finish starting...
timeout /t 3 /nobreak >nul

where chrome >nul 2>nul
if %errorlevel%==0 (
    echo Launching Chrome in Kiosk Mode - fullscreen, no address bar, no easy way to navigate away.
    REM --incognito matters here: this is a SHARED public display device.
    REM Without it, if anyone ever logs into their own account on this
    REM screen, that session could stay logged in for the next person
    REM who walks up. Incognito guarantees a clean slate every launch.
    start chrome --kiosk --incognito http://localhost/connect
) else (
    echo Chrome was not found on this PC's PATH.
    echo Opening in the default browser instead - kiosk lockdown will NOT be active.
    echo For real kiosk protection, install Chrome and make sure it's accessible from the command line.
    start http://localhost/connect
)
