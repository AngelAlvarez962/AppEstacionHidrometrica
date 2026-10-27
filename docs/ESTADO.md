# Estado — 23 de octubre de 2026

Versión 0.3.2. La aplicación principal se publicó en https://app-estacion-hidrometrica.vercel.app/ con el logo de Ideas Disruptivas. Vercel sirve la interfaz y las API `/api/config`, `/api/kits`, `/api/device`; Supabase mantiene las cuentas y las mediciones existentes. El acceso público a la pantalla de entrada no permite leer datos sin sesión. Configuración privada almacenada como secretos de servidor en Vercel, sin exponer la clave privada en el cliente.

El desarrollo principal se trasladó de la USB a `C:/Users/angel/Documents/Codex/Aplicacion Estacion Hidrometrica`. El usuario pidió sincronizar al cerrar jornada los avances con la carpeta `Aplicacion Estacion Hidrometrica` del escritorio y con la USB. Se conserva la organización Codigo y Aplicaciones, versiones anteriores y perfiles privados fuera de las copias de entrega. `Guardar-Avances.ps1` prepara los respaldos y verifica hashes; no programa tareas.

La aplicación para Windows 0.3.2 abre la web principal, por lo que otra computadora no necesita la clave administrativa de la laptop. La web funciona sin descargar el EXE. La demo es explícita y las mediciones reales requieren estación/gateway encendidos y conexión del gateway a Internet.

La primera página web y sus proyectos Vercel no se modificaron. Confirmación y recuperación siguen en el portal público de acceso de la 0.3.1. No se cambió la contraseña del usuario ni el firmware en esta jornada.

Supabase njwxrnhfxjbtsxemrmol, migraciones 001–007 aplicadas, RLS y separación de cuentas activos. Gateway físico Heltec V2, estación RIO_02 mostrada como Tacotalpa. Continúa la calibración de práctica: sensor-fondo 62.3 cm, capacidad 16 cm y avisos 12/15 cm. La distancia directa es independiente del nivel calculado. Antes de instalar en río guardar las medidas reales.

Pendientes: registro libre de estaciones de terceros; visualizador sin Internet; proveedor y ejecución programada de avisos por correo; pruebas del kit instalado en río. No anunciar estos pendientes como funciones disponibles. El estado histórico se conserva en ESTADO-ANTERIOR-0.3.1.md.

23/10/2026: el dominio estacionhidrometrica.ideasdisruptivas.com aparece como alias de producción del mismo proyecto de Vercel. Se mueve el logo de Ideas Disruptivas al encabezado de acceso, junto al nombre del proyecto; se conserva el logo del panel. Cambio visual de navegador sin modificar cuentas, firmware, DNS ni autenticación. La app Windows abre la web y recibe esta presentación automáticamente. USB no conectada al revisar; sincronización pendiente hasta conectarla.

23/10/2026: se entrega firmware/Estacion_Tacotalpa con los comentarios del kit, NODE_ID RIO_02 y TRIG13/ECHO23 según el cableado confirmado. No se carga en hardware. El sensor continúa sin eco y la protección eléctrica ECHO está pendiente. La limpieza solicitada fue bloqueada por la revisión automática; no se borraron archivos.

23/10/2026, recarga posterior autorizada: estación identificada por serial RIO_02 en COM3 (el puerto cambió respecto a revisiones anteriores). Respaldo privado completo de 8 MB previo a la carga, bajo LOCALAPPDATA. Se cargó Estacion_Tacotalpa para Heltec V2; esptool verificó hashes y reinició. Lecturas posteriores RIO_02,0.0,SIN_ECO con contador avanzando. La recarga no restableció la medición; no se modificó gateway ni calibración. No inferir daño ni ausencia de alimentación sólo por SIN_ECO.

26/10/2026: interfaz y guía por secciones actualizadas; ver INTERFAZ-2026-10-26.md. Portal de correo publicado con enlace de regreso al dominio principal y textos de acceso neutros. Nombre visible de estación: Estación 1, conservando RIO_02 e historial. Suite de aplicación, compilación y seis pruebas del portal correctas. No se cambia firmware.

26/10/2026: ajuste posterior: tutorial con formulario de ejemplo aun sin estaciones; prueba completa con cero equipos sin crear datos. Logo del panel trasladado al encabezado junto a la cuenta. No cambia el flujo habitual de configuración.

26/10/2026: por ajuste posterior del usuario, se retira el logo gráfico del encabezado del panel y se conserva la mención discreta Una aplicación de Ideas Disruptivas en su pie. El logo del acceso y su archivo original se conservan.

26/10/2026: el logo de acceso se integra visualmente con el fondo mediante mezcla de color, eliminando el recuadro blanco visible sin alterar el archivo original de marca.

27/10/2026: se añade modo claro/oscuro con botón animado y preferencia local; tutorial práctico con resultados ilustrativos que cambian al escribir sin guardar equipos; adaptación centrada para pantallas ultraanchas. Ver DISENO-Y-TUTORIAL-2026-10-27.md. Propuestas visuales A y B guardadas para elegir, sin aplicar rediseño general. No cambia hardware ni permisos de cuentas.

27/10/2026: botones y tarjetas interactivas con transiciones de color, contraste y elevación suave al pasar el mouse. Paletas clara y oscura, foco de teclado visible, acciones destructivas en rojo, controles deshabilitados sin animación y respeto a movimiento reducido. Cambio sólo visual.

27/10/2026: corregido el contraste oscuro de los bloques de conexión de gateway, entidades internas, preparación de kits e inventario. También se cubren códigos de preparación, equipos retirados y etiquetas del nivel de agua para evitar fondos claros con texto claro.

27/10/2026: acceso compacto adaptado a la altura de pantalla, revisado en 1280x720 y 1100x600 sin recortar controles; registro y acceso mantienen todos sus campos. Selector de tema estable en la página, sin trasladarlo a los formularios. Menú lateral retráctil con animación, iconos, preferencia local y respeto a movimiento reducido. La guía expande el menú al abrirla desde Ayuda. Revisadas navegación y persistencia; suite y compilación correctas.
