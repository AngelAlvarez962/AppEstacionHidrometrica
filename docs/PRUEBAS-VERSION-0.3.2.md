# Verificación 0.3.2

22/10/2026. Se trasladó el código principal a la laptop y se agregó el logo original de Ideas Disruptivas, sin modificarlo, en acceso y panel. Se publicaron interfaz y API en https://app-estacion-hidrometrica.vercel.app/. El proyecto anterior no se modificó.

La suite completa existente aprobó. Compilación web y Electron Windows x64 correctas. El acceso público devuelve HTML 200; `/api/config` devuelve configuración activa y portal HTTPS; `/api/kits` sin sesión devuelve 401. La confirmación y recuperación siguen usando el portal público de la 0.3.1. No se cambió la cuenta ni la contraseña del usuario. No se generaron mediciones ficticias de Tacotalpa.

Variables de servidor guardadas como secretos en Vercel para producción y vista previa. No se añadieron al código, bundle del cliente, respaldo de escritorio o USB. El ZIP anterior de demostración no se sobrescribió. La copia de Windows 0.3.2 apunta al enlace público y no requiere claves administrativas en equipos de usuarios.

Guardar-Avances.ps1 conserva código versionado, paquete completo de Windows, portal público y bundle de Git; comprueba hashes y sólo avanza el historial de la USB si no tiene cambios propios. No usa sincronización con borrado ni elimina versiones anteriores.
