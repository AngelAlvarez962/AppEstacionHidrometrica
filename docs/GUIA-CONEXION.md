# Conectar la estación y su gateway

Entra con tu cuenta. La guía aparece al empezar y puedes volver a abrirla con **Guía de configuración**. El administrador tiene sus herramientas por separado.

1. Si aún no tienes equipos, pulsa **Agregar equipos → Agregar equipo nuevo**. Elige estación + gateway, solo estación o solo gateway. Escribe su nombre y el identificador de radio que transmite el LoRa; si agregas una estación adicional puedes elegir un gateway propio. No necesitas un código preparado por el administrador.
2. En **Mis estaciones**, abre tu estación y revisa **Configurar estación**. Elige su receptor y guarda las medidas reales y los avisos. La distancia del sensor y el nivel calculado se muestran por separado.
3. En **Mis gateways**, pulsa **Conectar por USB**. Utiliza un cable de datos, elige el receptor que conectaste y selecciona su puerto. Cierra el monitor serie de Arduino si está abierto.
4. Espera a que se detecte el receptor y pulsa **Guardar gateway**. La vinculación se conserva en tu cuenta aunque retires el USB. Si había otro gateway, confirma el cambio y elige cuáles de tus estaciones lo utilizarán. Puedes cancelar; los equipos y el historial se conservan.
5. Con el USB conectado, pulsa **Configurar Wi-Fi**. Guarda una red de **2.4 GHz** y su contraseña. La contraseña se guarda en el receptor, no en la cuenta ni en el navegador.
6. Espera a ver **Internet comprobado**. Esto significa que llegó una lectura enviada directamente por el receptor. “Wi-Fi guardado” por sí solo no confirma la conexión.
7. Desconecta el USB de la computadora y alimenta el receptor con su cargador. Deja la estación encendida y el gateway dentro del alcance de su Wi-Fi. Revisa que la hora de la última lectura siga cambiando.

Si agregas una estación a un gateway que ya usa Internet, vuelve a guardar la configuración Wi-Fi para incluir la estación en el receptor. Los códigos de activación anteriores siguen disponibles dentro de Agregar equipos.

## Si no llegan medidas

- **USB conectado:** deja la app abierta, revisa que la estación esté encendida y que use el receptor seleccionado. Sólo se guardan las tramas de las estaciones vinculadas a tu cuenta.
- **Sólo corriente:** el gateway necesita la red Wi-Fi guardada, Internet y alimentación continua. Llevarlo a otro lugar puede requerir guardar otra red por USB.
- **Wi-Fi sin configurar:** no es suficiente con enchufarlo al cargador. Configura la red antes de retirar el USB.
- **No aparece Configurar Wi-Fi disponible:** el gateway puede usar el firmware anterior. La versión compatible está en `firmware/Gateway_Internet`. Quien prepara el equipo debe cargarla una vez; después el usuario configura la red desde la app.
- **Sin Internet en la computadora:** esta versión no guarda un historial local sin conexión. Tanto el puente USB como la consulta del historial utilizan Internet.
- **Sin recepción reciente:** una cifra antigua no confirma el nivel actual. Revisa el estado y la hora de la lectura.

Cada cuenta mantiene sus propios equipos. Guardar un gateway no concede acceso a estaciones de otras cuentas. Los avisos de la app acompañan la observación del sitio; antes de interpretar el nivel de un río deben configurarse sus medidas reales.

## Medidas y receptores

Del sensor al fondo vacío: mide desde la cara circular que emite el ultrasonido hasta el fondo. Del fondo al nivel máximo: mide la altura máxima de agua que vigilarás. Por ejemplo, con 60 cm y 25 cm se sugieren aviso a 15 cm y alerta a 20 cm; son editables y no constituyen umbrales validados para un río. Cancelar/configurar después deja el equipo pendiente, sin inventar mediciones.

Registrar otro receptor permite crear uno desde la configuración. Si elegiste estación + gateway al registrar, la app ya creó ambos en tu propia cuenta. En Mis gateways puedes renombrar o eliminar un receptor con confirmación. Para conservar el historial, antes de eliminarlo debes reasignar todas sus estaciones, incluidas las retiradas, a otro receptor de la misma cuenta. Administración permite revisar las cuentas y equipos con el rol ya autorizado; no concede nuevos roles.
