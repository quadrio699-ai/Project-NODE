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

REM --- Step 3: wait for the server to actually respond, not just a ---
REM --- fixed guess at how long it might take ---
echo Waiting for the server to be ready...
set /a attempts=0
:waitloop
set /a attempts+=1
timeout /t 1 /nobreak >nul
curl -s -o nul -w "" http://localhost/connect 2>nul
if %errorlevel%==0 goto serverready
if %attempts% geq 15 goto servertimeout
goto waitloop

:servertimeout
echo.
echo The server did not respond after 15 seconds.
echo Check the "ProjectNODE-Server" window for an error message.
pause
exit /b 1

:serverready
echo Server is up.
echo.

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
echo Setup complete. This window can stay open for reference, or you can close it -
echo the server keeps running in the separate "ProjectNODE-Server" window regardless.
pause
