# Tacotalpa conectada a la app

Actualizado el 21 de octubre de 2026. La versión 0.2.2 muestra la distancia real en la tarjeta y en el detalle y corrige la recuperación de contraseña. Hoy se completó el enlace del equipo físico y su arranque en esta laptop.

## Abrir y recibir lecturas

1. Conecta el gateway a esta laptop por USB y enciende la estación con sus antenas colocadas.
2. Abre **Tacotalpa - monitoreo**, el acceso directo del escritorio. También puedes abrir **ABRIR-APP.cmd** desde la USB del proyecto.
3. Entra con tu cuenta y abre la tarjeta **Tacotalpa**. La app consulta las lecturas cada 15 segundos; el gateway recibe paquetes con mayor frecuencia.
4. Conserva abiertos la app y el enlace a Internet mientras quieras enviar y ver mediciones nuevas. Al cerrar la app de Windows se detiene este puente USB y se libera el puerto.

El nodo que está transmitiendo es **RIO_02**. El usuario confirmó que es su estación. Se vinculó a **EST-000001**, llamada **Tacotalpa**, mediante **GW-000001** y el puerto **COM3**. Se conservaron los identificadores técnicos y el historial. No se cargó firmware en las placas.

El puente sólo acepta el nodo de radio confirmado o la serie técnica de esta estación. No incorpora automáticamente otras estaciones que se reciban por LoRa. No abrir simultáneamente el monitor serie de Arduino y el puente: ambos necesitan el mismo puerto.

## Conexión por Internet

La ruta que funciona en esta laptop es:

**Estación → LoRa → gateway → USB de la laptop → Internet → Supabase → aplicación.**

La aplicación consulta el servidor; no hace falta mantener abierta la página web anterior de la estación. La laptop transmite mientras la app de Windows permanece abierta. Si se corta Internet, no se garantiza recuperar después las lecturas perdidas: este puente conserva sólo paquetes recientes y no mantiene un historial offline para reenviarlo.

Para que el gateway transmita sin la laptop se necesita configurar un firmware con Wi-Fi y una API HTTPS pública que valide su credencial propia. La API de compradores de esta app todavía no está desplegada públicamente. No entregar la clave administrativa de Supabase al gateway ni a compradores. La conexión USB terminada hoy no equivale a haber preparado ese modo autónomo.

El proyecto Supabase **monitoreo-rio-kits** estaba pausado. Se reanudó desde su panel y se volvió a comprobar la ingesta real. Una pausa futura impedirá el acceso a cuentas y a las lecturas de la nube hasta reanudarlo. No se contrató ningún plan de pago.

## Medidas de la instalación

Las lecturas recibidas en la comprobación inicial fueron aproximadamente **68.5 cm**, con estado **OK**. Son distancias desde el sensor hasta la superficie detectada, no centímetros de agua.

Se conservaron las medidas de la práctica anterior: sensor a fondo **62.3 cm**, fondo a tope **16 cm**, aviso amarillo **12 cm** y rojo **15 cm**. No se añadió una corrección artificial a la distancia. Antes de interpretar niveles o alertas en el río hay que introducir las medidas del montaje definitivo en **Configurar estación**. La prueba de distancia en una superficie abierta no determina esas alturas del río.

## Si olvidaste la contraseña

Abre la versión de navegador desde **Monitoreo → Abrir versión para navegador**. Usa **Olvidé mi contraseña**, escribe el correo de tu cuenta y solicita el enlace. Completa el cambio tú desde ese correo, en esta misma laptop y navegador. Mantén abierta la app de Windows mientras usas el panel local. Después entra de nuevo a la app con la contraseña nueva. No crees otro kit para resolver una contraseña olvidada.

## Si no llegan datos

- Comprueba que el gateway y la estación estén encendidos y que el cable USB permita datos.
- Cierra el monitor serie de Arduino. Si cambió el puerto COM, revisa la configuración personal de esta PC.
- Abre la app mediante su acceso **Tacotalpa - monitoreo** o el lanzador de la USB, no directamente con un EXE de una versión anterior.
- Si se interrumpió la recepción, el supervisor vuelve a intentar conectarse mientras la app siga abierta. Descarta paquetes atrasados durante esperas de red.
- El registro local está en `%LOCALAPPDATA%\EstacionHidrometrica\Gateway-USB\Conexion-USB.log`. Guarda estados y lecturas, nunca contraseñas o claves. Se limita a dos archivos de unos 2 MB cada uno.
- El diagnóstico en `DIAGNOSTICO-GATEWAY-USB.cmd` es de sólo lectura. Cierra primero la app para liberar COM3.

## Archivos y alcance

El programa de Windows y su interfaz se actualizaron a 0.2.2. Se actualizaron los lanzadores y el lector USB, se conservaron las versiones anteriores y no se crearon ZIP ni se publicó en GitHub o Vercel.

El supervisor, el lector y su asociación se instalaron en el perfil de **esta laptop**, fuera de la USB. El perfil privado de Supabase se conserva donde estaba y no se copió a la USB. `Preparar-USB-PC.ps1` es una herramienta personal de desarrollo; no es el procedimiento de entrega de un comprador. Abrir directamente el EXE omite el inicio automático del puente.
