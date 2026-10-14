# Primera prueba de la versión 0.2.0 — 14 de octubre de 2026

## Abrir en esta laptop

Ejecuta **ABRIR-APP-PC.cmd** desde la carpeta del proyecto en la USB. Abre la copia de Windows instalada en el perfil de esta laptop. La conexión de Supabase ya está configurada aquí. También puedes usar **ABRIR-MONITOREO.cmd** para la misma interfaz en el navegador.

La aplicación actual está en Aplicaciones/v0.2.0. Abre ABRIR-APP.cmd desde la carpeta principal de la USB o ABRIR-ESTA-VERSION.cmd dentro de esa versión. Los archivos necesarios están juntos en Programa; no hay que descomprimir nada. En otra PC sin configuración funciona la demo. La clave privada no va en la USB ni se entrega a compradores.

No se publicó un sitio nuevo ni una plataforma de descargas. Para que compradores usen sus cuentas sin tener una clave privada, más adelante se conectará este mismo programa a una API central. Compartir una carpeta de aplicación y alojar la API son decisiones independientes.

## Recorrido para probar

1. Primero usa **Explorar demo de kits**. Los datos son ejemplos y desaparecen al recargar.
2. Selecciona **Administrador de kits → Preparar kits → Preparar nuevo kit**. Hay tres presentaciones: estación + gateway, solo estación y solo gateway. Ya no se pregunta una cantidad de estaciones.
3. Guarda la ficha. Contiene el código de activación; si incluye gateway, también su credencial privada de firmware. Se muestra una vez. El identificador corto sirve para reconocer el equipo; no sustituye al código de activación.
4. Como comprador, pulsa **Agregar equipos** y activa el código. Una estación nueva abre su configuración obligatoria: nombre, gateway, ubicación opcional, entidad opcional y cuatro medidas.
5. Para tu cubeta, usa sensor a fondo **65 cm**, fondo a tope **16 cm** y, por ejemplo, aviso amarillo **12 cm**, alerta roja **15 cm**. La mitad corresponde a 8 cm de agua y 50%; el sensor debe leer aproximadamente 57 cm.
6. El gateway receptor debe pertenecer a la misma cuenta. Una estación de otro kit puede usarlo. Si aún falta activar el gateway, usa **Activar otro kit / gateway** desde el formulario. Puedes cerrar sesión y retomarlo después; una estación incompleta permanece pendiente y no acepta nuevas lecturas.
7. Revisa estaciones, gateways, entidades e historial. Activar o calibrar no produce lecturas reales. Para recibirlas falta adaptar y probar el firmware con las fichas y la API de este proyecto.

Cinco kits completos incluyen cinco gateways. Para cinco estaciones que compartan un receptor puedes usar un kit completo y cuatro kits de solo estación, siempre que el enlace de radio y la instalación lo permitan. La aplicación no fija un cupo de estaciones por gateway; falta medir la capacidad práctica del hardware.

## Correos de atención

Hay una preferencia **Avisos por correo** por cuenta y una cola privada de mensajes. Se preparan avisos al entrar en amarillo, rojo o error de sensor; no se manda un mensaje por cada lectura. La misma categoría tiene una pausa de 10 minutos por estación. Se usan el correo confirmado actual de la cuenta y un máximo de cinco intentos; los mensajes con más de 24 horas no se envían.

**El envío real todavía no está configurado ni probado.** Se preparó un adaptador para Resend. Requiere una clave del proveedor y un remitente autorizado (`RESEND_API_KEY`, `ALERT_EMAIL_FROM`) guardados únicamente en el servidor/perfil privado de Windows. No pongas valores reales en `.env.example`, la USB ni Git. Los correos de registro y recuperación de Supabase son una configuración diferente.

La laptop envía avisos solo mientras su servidor está abierto y tiene Internet. La desconexión del equipo aún no genera un correo. Para avisos con la aplicación cerrada hará falta un servidor/worker que permanezca funcionando. No se enviaron mensajes reales durante estas pruebas.

## Estado de la base de datos

Proyecto: `monitoreo-rio-kits` (`njwxrnhfxjbtsxemrmol`). Se aplicaron una sola vez las migraciones 003, 004 y 005, después de las 001 y 002 que ya estaban instaladas. No vuelvas a ejecutarlas en ese proyecto. En una base nueva se aplican 001 a 005 en orden.

La propiedad de la estación ahora depende de su kit, independiente de su gateway. RLS y un trigger impiden vincular gateways de otra cuenta. La clasificación interna del administrador sigue separada de las entidades del comprador. Las estaciones e historial anteriores se conservan.

## Validación y pendientes

Pruebas automatizadas de cálculo, API, permisos SQL, migración desde datos anteriores, tres presentaciones, gateway compartido entre compras del mismo dueño, configuración pendiente, cola de correo privada y reintentos simulados. Pruebas de interfaz con demo: activación, Escape bloqueado en configuración obligatoria, medidas inválidas rechazadas y activación de gateway dentro del registro.

Pendientes: prueba física de estación/gateway con este backend, Wi-Fi del gateway desde la app, correos reales con proveedor, servidor central para compradores y validación de Windows en la segunda PC. El visualizador USB sin Internet del proyecto anterior no está integrado a esta app nueva. Android queda para después.
