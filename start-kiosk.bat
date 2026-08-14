@echo off
title Project-NODE - Flagship Display Launcher
cd /d "%~dp0"

echo ================================================
echo  Project-NODE Kiosk Launcher
echo ================================================
echo.

REM --- Step 1: make sure dependencies are actually installed ---
REM A fresh download from GitHub never includes node_modules, so this
REM catches the single most common cause of "it just closes" - node
REM crashing instantly on a missing package with no time to read why.
if not exist "node_modules" (
    echo node_modules not found - running npm install first...
    echo ^(This only needs to happen once.^)
    call npm install
    if errorlevel 1 (
        echo.
        echo npm install failed. See the error above.
        pause
        exit /b 1
    )
    echo.
    echo Dependencies installed successfully.
    echo.
)

REM --- Step 2: start the server in its OWN window that stays open ---
REM Using /k instead of /c means this window stays open even if node
REM crashes, so the actual error is visible instead of the window
REM just vanishing.
set AUTO_OPEN=false
start "ProjectNODE-Server" cmd /k "node server.js"

REM --- Step 3: give the server a moment to actually start ---
REM Previously this polled http://localhost/connect using curl - but
REM curl isn't guaranteed to exist on every Windows install (only
REM bundled by default since a 2018 update, and some locked-down PCs
REM strip it out). If curl was missing, this check silently failed
REM every time and skipped straight to timeout, so the browser never
REM opened - even though the server itself was working fine. Using
REM "ping" instead as a simple delay, since ping.exe ships on every
REM single Windows install with no exceptions.
echo Waiting a few seconds for the server to start...
ping 127.0.0.1 -n 5 >nul

REM --- Step 4: open the display, in real kiosk mode if we can find a ---
REM --- Chromium-based browser (Chrome OR Edge), otherwise just open ---
REM --- it normally so it still works either way ---
set CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
set CHROME_PATH_X86="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
set EDGE_PATH="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

if exist %CHROME_PATH% (
    echo Launching Chrome in kiosk mode...
    start "" %CHROME_PATH% --kiosk --incognito http://localhost/connect
) else if exist %CHROME_PATH_X86% (
    echo Launching Chrome in kiosk mode...
    start "" %CHROME_PATH_X86% --kiosk --incognito http://localhost/connect
) else if exist %EDGE_PATH% (
    echo Launching Edge in kiosk mode...
    start "" %EDGE_PATH% --kiosk --inprivate http://localhost/connect
) else (
    echo Neither Chrome nor Edge was found in their usual install locations.
    echo Opening in your default browser instead - kiosk lockdown will NOT be active.
    start http://localhost/connect
)

echo.
echo Setup complete. If the page shows an error, just refresh it once -
echo the server may need one more second. This window can stay open for
echo reference, or you can close it - the server keeps running in the
echo separate "ProjectNODE-Server" window regardless.
pause
