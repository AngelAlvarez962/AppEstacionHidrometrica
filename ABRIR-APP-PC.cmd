@echo off
set "TASK_APP=%LOCALAPPDATA%\EstacionHidrometrica\App-PC\Hackeando las inundaciones.exe"
if not exist "%TASK_APP%" set "TASK_APP=%~dp0aplicacion-pc\Windows\Hackeando las inundaciones.exe"
if not exist "%TASK_APP%" (
  echo Extrae el paquete Carpeta.zip en aplicacion-pc\Windows antes de abrir la app.
  pause
  exit /b 1
)
start "" "%TASK_APP%"
