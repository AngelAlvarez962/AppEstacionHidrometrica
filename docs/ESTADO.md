# Estado del proyecto · 13 de octubre de 2026

Ubicación de trabajo: carpeta EstacionHidrometrica en la USB KODAK (actualmente E:).
Repositorio: AngelAlvarez962/AppEstacionHidrometrica.
Supabase: monitoreo-rio-kits, referencia njwxrnhfxjbtsxemrmol.

Completado:

- Aplicación y código fuente guardados en la USB con rutas relativas.
- Doce tablas creadas en Supabase; RLS activo en todas.
- URL local de autenticación configurada: http://127.0.0.1:8790/.
- Rutas de confirmación y recuperación local permitidas.
- Clave pública configurada; clave privada guardada y verificada en esta laptop, fuera de la USB.
- Conexión real a la base de datos verificada (HTTP 200).
- Permisos y entidades separados entre comprador y administrador, con pruebas de PostgreSQL.
- Eliminación recuperable de estaciones; una estación eliminada no acepta lecturas nuevas.
- Primera cuenta creada, correo confirmado y rol administrador asignado; acceso real al panel comprobado.
- Compilación y pruebas de API, calibración, aislamiento y SQL completas.
- Código público guardado en AngelAlvarez962/AppEstacionHidrometrica; no incluye la clave privada ni fichas de gateways.
- Acceso directo «Monitoreo de kits» de esta laptop actualizado a la carpeta de la USB.
- Aplicación para Windows x64: ejecutable portable e instalador generados, sin incluir claves privadas.
- Ventana de Windows abierta y acceso real al panel administrador comprobado.
- Código de la versión para PC guardado en la USB. Los ejecutables están en aplicacion-pc; consulta docs/APP-PC.md.
- Windows bloquea el launcher portable generado. La versión de carpeta sí funciona; la firma del editor es pendiente antes de distribuir instaladores.

Pendiente:

1. Probar la activación de un kit real con su comprador y su hardware.
2. Conectar el repositorio a un proyecto Vercel nuevo.
3. Configurar las rutas del dominio publicado y el envío de correo para compradores.
4. Adaptar el gateway y el emparejamiento LoRa de kits distintos; probar hardware real.
5. Validar el instalador en la otra computadora y preparar la distribución a compradores. La versión Android se trabajará después.

La URL local es solo para la computadora que ejecuta el lanzador; no es todavía una página pública. Al pasar la USB a otra computadora, configura allí la clave privada una vez con CONFIGURAR-CONEXION.cmd. Usa el mismo proyecto Supabase; no vuelvas a crear tablas ni otros proyectos.

El correo de confirmación local regresa a 127.0.0.1 en el dispositivo que lo abre. Si se abre desde el celular, esa dirección no llega a la laptop. El correo puede haber quedado confirmado antes de mostrar ERR_CONNECTION_REFUSED; en ese caso inicia sesión desde la laptop. Para compradores, se usará el dominio público al desplegar.
