@echo off
title Desarrollo - Estacion Hidrometrica
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar.ps1" -Desarrollo
if errorlevel 1 pause
