# Versión 0.2.2

Trabajo en laptop el 21 de octubre de 2026.

## Cambios

- La tarjeta y el detalle muestran la distancia medida por el sensor, separada del nivel calculado. Las lecturas caducadas o con error no se presentan como mediciones actuales.
- Se mantiene el cálculo existente y la calibración guardada. Con 62.3 cm de referencia y 68.5 cm de distancia, el nivel calculado es 0 cm; la nueva tarjeta muestra además los 68.5 cm del sensor.
- Se corrigió el flujo de recuperación de contraseña: los eventos de sesión posteriores a PASSWORD_RECOVERY no cierran el formulario antes de completar el cambio. Un enlace sin sesión permite solicitar otro.
- El lanzador inicia el puente USB personal de esta laptop y lo detiene al cerrar la app. Hay exclusión mutua entre supervisores, reintento de conexión y descarte de tramas atrasadas.
- Se confirma la asociación de RIO_02 con Tacotalpa, EST-000001 y GW-000001. El receptor original se conserva; no se cargó firmware.

## Verificación

29 pruebas pasaron: cálculo y distancia directa, lecturas antiguas y errores, API, aislamiento y permisos SQL, recuperación de acceso, navegación de escritorio, lanzadores y parser USB. Compilación web y empaquetado Windows x64 completados.

La prueba física inicial guardó lecturas por USB en Supabase. Después Windows devolvió un error de dispositivo en COM3; tras reconectar su cable, se recibieron de nuevo 16 tramas RIO_02, alrededor de 68.2–68.5 cm. La evidencia de recepción e ingesta se conserva en docs/comprobaciones, fuera de Git.

La revisión del panel final y los hashes de las copias se registran en docs/comprobaciones. Esta revisión no acredita calibración del montaje en el río ni publicación autónoma por Wi-Fi.

## Solicitudes para después

El usuario pidió posponer los cambios de registro y concentrarse ahora en ver las mediciones. Quedaron anotados retirar el texto de comprador y permitir agregar estaciones propias o compradas, con gateway por USB o Internet. No se han retirado las credenciales de dispositivos, los permisos de cuenta ni los controles de propiedad existentes. El diseño seguro de ese nuevo flujo se resolverá en una tarea posterior.
