# Diseño, temas y práctica — 27 de octubre de 2026

## Cambios aplicados

- Selector claro/oscuro con transición del icono sol/luna y de los colores. Preferencia guardada sólo como apariencia en el navegador; si no existe elección se sigue el sistema. Funciona también cuando el almacenamiento está bloqueado. La animación se desactiva si el usuario prefiere movimiento reducido.
- El selector sigue siendo accesible al abrir formularios. El gráfico adapta sus colores y se vuelve a dibujar al cambiar de tema. El archivo original de marca no se modifica.
- El tutorial muestra un resultado ilustrativo por paso: tarjeta de estación, gateway conectado o entidad con su estación. En los formularios se puede practicar con nombre, ubicación, medidas y umbrales, y ver el resultado inmediatamente.
- La práctica utiliza un objeto independiente y desechable. No añade registros al panel, no configura equipos ni sustituye la calibración real. Los formularios de práctica no ejecutan guardado; sólo se conserva la marca existente de recorrido completado.
- Los datos de práctica se mantienen al avanzar y retroceder y se reinician al comenzar otro recorrido. Se aplica el mismo cálculo validado del nivel que usa el panel. Los valores inválidos se señalan sin presentar una medición válida.
- Panel centrado dentro del espacio restante del menú lateral en pantallas amplias; área de trabajo hasta 2200 px. Acceso centrado con ancho máximo legible. Se mantienen los ajustes de móvil y menú superior en pantallas pequeñas.

## Propuestas pendientes de elección

Las imágenes A (clara y espaciosa) y B (compacta y ordenada) están en `PropuestasDiseno` de la carpeta principal y sus respaldos. Son ideas generadas con la herramienta de imágenes, no una lista de funciones implementadas. No se aplica un rediseño general hasta elegir el estilo.

## Validación

- Suite completa de la aplicación y compilación correctas.
- Pruebas nuevas de preferencia del tema, cambio del sistema, almacenamiento bloqueado, cálculo del ejemplo, aislamiento de su estado y escape de contenido escrito por el usuario.
- Navegador: cambio de tema y persistencia al recargar; acceso, panel y formularios en oscuro; edición del ejemplo y resultado inmediato; conservación de los datos originales al terminar la práctica.
- Prueba local sin equipos: el tutorial no crea estaciones ni gateways.
- Revisión con marco de 390 px y con marco ultraancho de 3440 × 1440. En ultraancho los márgenes del área central quedan visualmente equilibrados.

No se cambia firmware, credenciales, permisos de cuentas ni envío de mediciones.
