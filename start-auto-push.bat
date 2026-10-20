@echo off
title Git Auto-Push Watcher - Indie
echo ========================================================
echo Memulai pemantauan folder Indie...
echo Setiap perubahan akan otomatis di-push ke GitHub.
echo Biarkan jendela ini tetap terbuka di latar belakang.
echo ========================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0auto-push.ps1"
pause
