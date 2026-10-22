# Actualización 0.3.1 — 22/10/2026

Correos de confirmación y recuperación con página pública HTTPS, utilizables desde otro dispositivo. Ver PRUEBAS-VERSION-0.3.1.md.

# Estado del proyecto — 22 de octubre de 2026

Versión 0.3.0. Fuente en la USB: `Codigo/EstacionHidrometrica`. Aplicación Windows en `Aplicaciones/v0.3.0/Programa` y copia rápida local `App-PC`. Las versiones anteriores se conservan. No se publicó GitHub/Vercel ni se modificó la primera página web.

Se quitaron las referencias a comprador en la interfaz. Las tarjetas muestran la entidad, sin esa etiqueta. Hay una guía de seis pasos para usuarios normales, visible antes de la configuración inicial y disponible de nuevo desde el panel. El avance terminado se conserva por cuenta.

Mis gateways permite elegir el puerto USB de un receptor compatible, guardar el gateway preferido en la cuenta y configurar su Wi-Fi de 2.4 GHz. Antes de sustituir uno existente se pide confirmación y se eligen las estaciones que pasarán al nuevo receptor. El cambio es atómico y conserva el historial. Los identificadores USB/MAC son pistas de identificación, no autorización para acceder a una cuenta.

Supabase: monitoreo-rio-kits, ref njwxrnhfxjbtsxemrmol. Migraciones 001–007 aplicadas. No repetirlas. Se mantiene RLS y aislamiento de cuentas. La nueva entrada HTTPS `kit_receive` exige una credencial aleatoria por gateway, sólo permite escribir medidas de sus estaciones configuradas y no permite consultar datos. No basta la clave pública. Una credencial nueva se activa sólo después de confirmar el guardado desde el dispositivo. El servidor conserva sólo hashes.

Gateway físico COM3: se respaldaron los 8 MB originales en el perfil privado de Windows; el respaldo completo se verificó por digest contra la flash. Se actualizó sólo el firmware del gateway Heltec WiFi LoRa 32 V2. La estación sensora y su calibración no se modificaron. El nuevo gateway conserva red y credencial en NVS, recibe RIO_02 y envía directamente por HTTPS a la nueva app. Se comprobaron medidas reales alrededor de 68.7–69.2 cm, con el puente serie cerrado, guardadas y recuperadas de Supabase. El usuario informó que la estación estaba sin batería y luego confirmó que quedó encendida; volvió la recepción continua.

Se corrigió además la pantalla del gateway para mostrar la distancia, nombre de radio, estado del sensor y RSSI, además del estado Wi-Fi/nube. La primera actualización mostraba sólo la conexión y parecía no recibir pese a que las medidas sí llegaban al servidor.

Verificación: 35 pruebas automatizadas correctas; compilación web, Windows x64 y firmware ESP32. La guía y el panel se revisaron en demo, claramente marcada como ejemplo. Las lecturas físicas se comprobaron por separado en Supabase; no se crearon muestras ficticias en producción. Evidencias técnicas en `docs/comprobaciones`, excluidas de Git.

Limitaciones pendientes: la API de cuentas de esta edición para PC sigue usando el perfil privado de esta laptop. Otra PC sin ese perfil no debe recibir la clave administrativa; hace falta publicar una API central para distribuirla a otros equipos. La ingesta autónoma del gateway ya es pública con autenticación por dispositivo. No hay registro libre de estaciones de terceros, proveedor de correo de avisos ni historial local sin Internet todavía. La guía no afirma lo contrario.

La geometría guardada de Tacotalpa sigue siendo la práctica: sensor-fondo 62.3 cm, capacidad 16 cm y avisos 12/15 cm. La distancia directa es independiente del nivel calculado. Antes de instalar en el río se deben guardar sus medidas reales.
