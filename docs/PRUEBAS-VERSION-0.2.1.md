# Monitoreo con resumen y detalle — laptop, 20 de octubre de 2026

La versión 0.2.1 abre Mis estaciones con tarjetas compactas. El nivel, historial y acciones de una estación aparecen en una vista separada al pulsar su tarjeta. Volver a mis estaciones recupera el filtro y la posición del resumen, y devuelve el foco del teclado a la tarjeta.

## Recorrido de comprobación

1. Abre la app y pulsa Explorar demo de kits. Deben aparecer las tarjetas sin ningún detalle abierto debajo.
2. Abre Entrada de mi casa. Debe mostrar exclusivamente su detalle, con nivel, historial y acciones. Actualizar debe conservar esa estación abierta.
3. Pulsa Volver a mis estaciones. Selecciona la entidad Casa de mamá, abre su tarjeta y regresa: el filtro debe seguir en Casa de mamá.
4. Cambia de cuenta de ejemplo mientras tienes un detalle abierto. La nueva cuenta debe mostrar su resumen, sin conservar el detalle ni los filtros de la anterior.
5. En la demo de Bruno, abre su única estación y elimínala. Debe regresar al resumen vacío con la opción Estaciones eliminadas. Restáurala: debe reaparecer como tarjeta, sin abrirse automáticamente.
6. Con teclado, abre una tarjeta con Enter. El foco debe pasar al título del detalle; al volver debe regresar a la tarjeta.
7. Entra en Mis gateways y vuelve a Mis estaciones: debe abrir el resumen.

Estos recorridos se comprobaron con datos de la demo local. Las capturas están en `docs/comprobaciones/monitoreo-detalle-0.2.1.png` y `monitoreo-resumen-0.2.1.png`.

Se ejecutó la suite existente de cálculos, API, permisos SQL, aislamiento, configuración, correo simulado y lanzadores. La compilación web y el empaquetado de Windows finalizaron correctamente con `npm run build:pc`. Se verificó por SHA-256 que la salida, la USB y la copia local contienen el mismo paquete 0.2.1; sus HTML, CSS y JavaScript coinciden con la compilación final. El lanzador selecciona la copia local 0.2.1. Registro: `docs/comprobaciones/verificacion-paquete-0.2.1.json`.

No se cambia el firmware, la calibración ni la base remota con esta navegación. La validación física del sensor y el envío real del gateway siguen pendientes según la bitácora. El arranque y la navegación en una segunda computadora siguen pendientes de comprobar en ese equipo.
