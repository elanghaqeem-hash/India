@echo off
title Git Manual Push - India
cd /d "%~dp0"
echo ================================================
echo Repository: elanghaqeem-hash/India
echo Branch: main
echo ================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0auto-push.ps1" -Once
if errorlevel 1 (
    echo.
    echo ERROR: GitHub push failed. Check messages above.
    pause
    exit /b 1
)
echo.
echo GitHub push successful.
pause
