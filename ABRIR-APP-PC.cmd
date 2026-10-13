@echo off
set "TASK_APP=%~dp0aplicacion-pc\Hackeando-Inundaciones-PC-0.1.0-Portable.exe"
if not exist "%TASK_APP%" (
  echo Falta compilar la aplicacion. Abre COMPILAR-APP-PC.cmd primero.
  pause
  exit /b 1
)
start "" "%TASK_APP%"
