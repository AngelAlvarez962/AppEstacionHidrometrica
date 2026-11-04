# Prueba de continuidad · 4 de noviembre de 2026

En la parte inferior del panel: **Prueba de continuidad**. Elegir estación y objetivo de 24 horas a 7 días. El objetivo es una referencia: sigue registrando hasta Detener registro. Descargar CSV no detiene ni borra la prueba.

Registra inicio, muestra cada hora, cambio de estado y detención. Guarda fecha UTC, última recepción, distancia de la última lectura y nivel únicamente si es válido. La falta de recepción no prueba que la estación esté físicamente apagada: puede fallar batería, radio, gateway o Internet. No se fabrican registros anteriores al inicio ni se rellenan huecos de un servicio suspendido.

Comprobación en Supabase cada minuto, independiente del navegador y de la laptop. La ausencia de lectura se considera tras 90 segundos; puede tardar un minuto adicional en observarse. Los cambios de nivel/error recibidos se procesan al guardar cada lectura.

Telegram conserva vinculación y preferencias de cada cuenta. Avisa al cambiar a amarillo, rojo, error, sin señal de estación o sin comunicación. Recuperación al volver a normal. Recordatorio cada 24 horas si persiste un problema, ninguno periódico en normal. Al iniciar una prueba se envía un resumen del estado a la cuenta vinculada y habilitada. Se mantienen los límites de envío y reintentos; no garantiza entrega inmediata ni reemplaza alertas de emergencia.

Migraciones 015 y 016. Programador en supabase/operations/continuity-schedule.sql (una instalación por proyecto). Callback exclusivo con credencial aleatoria privada en kit_watch_config; no usa claves en el cliente ni incluye credenciales en Git. Registros sólo visibles para la cuenta que inició la prueba. Diez inicios por cuenta/día.

Interfaz móvil: encabezado compacto, navegación en fila desplazable, preferencias ocultas hasta abrir menú, controles de tamaño táctil y sin desbordamiento horizontal en revisión de 390 px.

Validación: suite anterior completa, prueba adicional de RLS, horarios, desconexión, recordatorio, recuperación, detención y API. Comprobaciones de 24 horas se simulan en base de datos local; todavía no constituyen una prueba física de autonomía de 24 horas.
