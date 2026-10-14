@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0desktop\abrir-app.ps1"
if errorlevel 1 pause
