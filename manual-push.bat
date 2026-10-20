@echo off
title Git Manual Push - Indie
cd /d "%~dp0"
echo ========================================================
echo Status Perubahan:
echo ========================================================
git status -s
echo.
set /p commit_msg="Masukkan pesan commit (atau tekan Enter untuk auto-timestamp): "
if "%commit_msg%"=="" (
    set commit_msg=Update: %DATE% %TIME%
)
git add -A
git commit -m "%commit_msg%"
git push origin main
echo.
echo ========================================================
echo Selesai!
echo ========================================================
pause
