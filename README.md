# AppEstacionHidrometrica

Aplicación web de monitoreo hidrométrico para compradores de kits. Proyecto de trabajo guardado en la USB; repositorio: **AngelAlvarez962/AppEstacionHidrometrica**.

Versión local **0.2.1**: navegación de tarjetas a detalle con regreso al resumen. Conserva tres presentaciones, expansión con gateways propios, identificadores cortos, registro obligatorio y cola de avisos. Consulta `docs/PRUEBAS-VERSION-0.2.1.md` para probar la navegación y `docs/PRUEBAS-VERSION-0.2.md` para las funciones de kits. El proveedor de correo y la integración de hardware siguen pendientes.

## Abrir y trabajar

Organización actual: `ABRIR-APP.cmd` en la carpeta principal; aplicaciones listas en `Aplicaciones/v0.2.1/Programa` y versiones anteriores en `Aplicaciones/v0.2.0` y `Aplicaciones/v0.1.0`. El código está en `Codigo/EstacionHidrometrica`. Consulta `docs/ORGANIZACION.md`. Ya no se usan ni generan ZIP.


- **ABRIR-APP-PC.cmd:** abre la copia completa de la aplicación para Windows. Consulta `docs/APP-PC.md`.
- **COMPILAR-APP-PC.cmd:** genera carpetas de aplicación por versión, sin ZIP.
- **ABRIR-MONITOREO.cmd:** abre la aplicación compilada en el navegador. Mantén abierta la ventana del lanzador.
- **DESARROLLAR.cmd:** abre la versión de desarrollo; los cambios de la interfaz se actualizan automáticamente.
- **CONFIGURAR-CONEXION.cmd:** configura la clave privada en esta computadora. La URL y clave pública están en `config/public.json`; la clave privada se guarda en `%LOCALAPPDATA%\EstacionHidrometrica\<proyecto>\.env.local`, fuera de la USB.

Necesitas Node.js 22.12 o superior en cada computadora. El proyecto usa rutas relativas: la USB puede tener otra letra. Para trabajar en otra computadora abre estos archivos desde la misma carpeta de la USB; no necesitas copiar otro proyecto. Configura la conexión privada una sola vez en cada computadora.

Cierra el lanzador antes de retirar la USB y expúlsala desde Windows. La aplicación local necesita Internet para consultar Supabase; no sustituye al visualizador USB sin conexión.

Si editas código, al terminar ejecuta `npm run build` desde esta carpeta para actualizar la versión que abre ABRIR-MONITOREO. `npm ci` instala las dependencias si falta `node_modules`; en la USB esta instalación puede tardar varios minutos. No se incluyen dependencias ni claves privadas en Git.

## Permisos

- El comprador ve y modifica sus estaciones y gateways. Puede eliminar/restaurar sus estaciones y crear, renombrar y eliminar sus entidades personales.
- El administrador ve y modifica los equipos de todos los compradores. Tiene entidades internas independientes para organizar las estaciones.
- Las entidades internas del administrador y sus asignaciones no son visibles para compradores, ni siquiera mediante consultas directas a la base de datos.
- Eliminar una estación retira su tarjeta y bloquea lecturas nuevas, conserva el historial y permite restaurarla.
- Eliminar una entidad conserva las estaciones; quedan sin esa clasificación.
- El rol de administrador se asigna únicamente en la base de datos, nunca mediante un dato de registro enviado por el usuario.

Las estaciones físicas se vinculan al reclamar el código de su kit. Los nombres como RIO_01 son etiquetas, no identificadores globales. Cambiar medidas en el panel modifica el cálculo de nivel en la plataforma; no reprograma el equipo.

## Base de datos

Proyecto Supabase: **monitoreo-rio-kits**. La instalación inicial en ese proyecto ya fue aplicada y verificada; no vuelvas a ejecutar las migraciones allí.

En una base nueva, ejecuta las migraciones de `supabase/001-kits.sql` a `supabase/005-serialize-ingestion.sql` en orden. Las catorce tablas tienen RLS activo. Las credenciales de gateways y códigos de activación se almacenan como hashes y no se entregan a usuarios normales.

El acceso por correo requiere la confirmación del usuario. Antes de abrir el registro a compradores externos, configura un proveedor SMTP para los correos de producción y prueba confirmación/recuperación con cuentas reales.

La primera cuenta administradora ya se creó, confirmó y verificó en el proyecto configurado. En instalaciones nuevas, crea y confirma la cuenta y añade su UUID a `public.kit_admins`. No publiques contraseñas ni fichas de preparación de kits: esas fichas incluyen la credencial privada de su gateway.

## Pruebas y desarrollo

```text
npm ci
npm test
npm run dev
npm run build
```

Se prueban la API, las alturas de agua y el SQL real con PostgreSQL local (PGlite): aislamiento entre compradores, administración global, entidades personales, entidades internas privadas, eliminación/restauración y rechazo de telemetría de estaciones eliminadas o de otro gateway.

La demo es explícita, usa ejemplos en memoria y no crea usuarios ni equipos en Supabase. Sus cambios desaparecen al recargar. La aplicación real conserva los datos en Supabase.

## Publicación y próximos pasos

El repositorio correcto es `https://github.com/AngelAlvarez962/AppEstacionHidrometrica`. Vercel compila con `npm run build`, sirve `dist` y las funciones de `api`. Configura `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY` en el proyecto nuevo de Vercel; la clave privada nunca debe tener prefijo `VITE_` ni aparecer en el código cliente.

Actualmente el backend y la web funcionan localmente con conexión a Supabase y el acceso administrador ya fue comprobado con una cuenta real. Falta probar la activación con compradores y hardware, conectar el nuevo despliegue y adaptar el firmware del gateway a la API y al emparejamiento de estaciones de cada kit.

La aplicación continúa disponible para navegador. Una APK posterior puede reutilizar Supabase Auth y la misma API; aún no se ha generado una APK. El visualizador USB anterior sigue siendo un respaldo independiente.

Consulta `docs/API.md` y `docs/ESTADO.md` para continuar.
