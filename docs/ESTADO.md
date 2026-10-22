# Estado — 22 de octubre de 2026

Versión 0.3.2. La aplicación principal se publicó en https://app-estacion-hidrometrica.vercel.app/ con el logo de Ideas Disruptivas. Vercel sirve la interfaz y las API `/api/config`, `/api/kits`, `/api/device`; Supabase mantiene las cuentas y las mediciones existentes. El acceso público a la pantalla de entrada no permite leer datos sin sesión. Configuración privada almacenada como secretos de servidor en Vercel, sin exponer la clave privada en el cliente.

El desarrollo principal se trasladó de la USB a `C:/Users/angel/Documents/Codex/Aplicacion Estacion Hidrometrica`. El usuario pidió sincronizar al cerrar jornada los avances con la carpeta `Aplicacion Estacion Hidrometrica` del escritorio y con la USB. Se conserva la organización Codigo y Aplicaciones, versiones anteriores y perfiles privados fuera de las copias de entrega. `Guardar-Avances.ps1` prepara los respaldos y verifica hashes; no programa tareas.

La aplicación para Windows 0.3.2 abre la web principal, por lo que otra computadora no necesita la clave administrativa de la laptop. La web funciona sin descargar el EXE. La demo es explícita y las mediciones reales requieren estación/gateway encendidos y conexión del gateway a Internet.

La primera página web y sus proyectos Vercel no se modificaron. Confirmación y recuperación siguen en el portal público de acceso de la 0.3.1. No se cambió la contraseña del usuario ni el firmware en esta jornada.

Supabase njwxrnhfxjbtsxemrmol, migraciones 001–007 aplicadas, RLS y separación de cuentas activos. Gateway físico Heltec V2, estación RIO_02 mostrada como Tacotalpa. Continúa la calibración de práctica: sensor-fondo 62.3 cm, capacidad 16 cm y avisos 12/15 cm. La distancia directa es independiente del nivel calculado. Antes de instalar en río guardar las medidas reales.

Pendientes: registro libre de estaciones de terceros; visualizador sin Internet; proveedor y ejecución programada de avisos por correo; pruebas del kit instalado en río. No anunciar estos pendientes como funciones disponibles. El estado histórico se conserva en ESTADO-ANTERIOR-0.3.1.md.
