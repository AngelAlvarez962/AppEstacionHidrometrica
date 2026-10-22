# Conectar la estación y su gateway

Entra con tu cuenta. La guía aparece al empezar y puedes volver a abrirla con **Guía de configuración**. El administrador tiene sus herramientas por separado.

1. En **Mis estaciones**, abre tu estación y revisa **Configurar estación**. Elige su receptor y guarda las medidas reales y los avisos. La distancia del sensor y el nivel calculado se muestran por separado.
2. En **Mis gateways**, pulsa **Conectar por USB**. Utiliza un cable de datos, elige el receptor que conectaste y selecciona su puerto. Cierra el monitor serie de Arduino si está abierto.
3. Espera a que se detecte el receptor y pulsa **Guardar gateway**. La vinculación se conserva en tu cuenta aunque retires el USB. Si había otro gateway, confirma el cambio y elige cuáles de tus estaciones lo utilizarán. Puedes cancelar; los equipos y el historial se conservan.
4. Con el USB conectado, pulsa **Configurar Wi-Fi**. Guarda una red de **2.4 GHz** y su contraseña. La contraseña se guarda en el receptor, no en la cuenta ni en el navegador.
5. Espera a ver **Internet comprobado**. Esto significa que llegó una lectura enviada directamente por el receptor. “Wi-Fi guardado” por sí solo no confirma la conexión.
6. Desconecta el USB de la computadora y alimenta el receptor con su cargador. Deja la estación encendida y el gateway dentro del alcance de su Wi-Fi. Revisa que la hora de la última lectura siga cambiando.

## Si no llegan medidas

- **USB conectado:** deja la app abierta, revisa que la estación esté encendida y que use el receptor seleccionado. Sólo se guardan las tramas de las estaciones vinculadas a tu cuenta.
- **Sólo corriente:** el gateway necesita la red Wi-Fi guardada, Internet y alimentación continua. Llevarlo a otro lugar puede requerir guardar otra red por USB.
- **Wi-Fi sin configurar:** no es suficiente con enchufarlo al cargador. Configura la red antes de retirar el USB.
- **No aparece Configurar Wi-Fi disponible:** el gateway puede usar el firmware anterior. La versión compatible está en `firmware/Gateway_Internet`. Quien prepara el equipo debe cargarla una vez; después el usuario configura la red desde la app.
- **Sin Internet en la computadora:** esta versión no guarda un historial local sin conexión. Tanto el puente USB como la consulta del historial utilizan Internet.
- **Sin recepción reciente:** una cifra antigua no confirma el nivel actual. Revisa el estado y la hora de la lectura.

Cada cuenta mantiene sus propios equipos. Guardar un gateway no concede acceso a estaciones de otras cuentas. Los avisos de la app acompañan la observación del sitio; antes de interpretar el nivel de un río deben configurarse sus medidas reales.
