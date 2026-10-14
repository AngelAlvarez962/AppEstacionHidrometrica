@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Conectar_Gateway_USB.ps1" -Puerto COM3
if errorlevel 1 pause
