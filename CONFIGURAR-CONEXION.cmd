@echo off
title Configurar conexion - Estacion Hidrometrica
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar.ps1" -Configurar
if errorlevel 1 pause
