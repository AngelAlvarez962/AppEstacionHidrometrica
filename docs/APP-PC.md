# Aplicación para Windows · primera versión

Los ejecutables están en `aplicacion-pc` dentro de la USB:

- `Hackeando-Inundaciones-PC-0.1.0-Portable.exe`: abre sin instalar, con una ventana propia. También puedes usar `ABRIR-APP-PC.cmd`.
- `Hackeando-Inundaciones-PC-0.1.0-Instalador.exe`: instala para tu usuario de Windows y crea accesos en escritorio e Inicio.

La versión compilada incluye su propio runtime; no requiere instalar Node.js. Está preparada para Windows x64. El instalador inicial no cuenta con firma digital de un editor; eso se resolverá antes de distribuir comercialmente.

## Conexión en esta etapa

En la laptop de desarrollo usa la conexión ya configurada en el perfil privado de Windows. Reutiliza el servidor del navegador si pertenece a este proyecto; si no está abierto, inicia uno al abrir la aplicación. Cerrar la ventana de la app detiene solo el servidor que ella inició.

La clave privada permanece fuera de la USB, en el perfil de Windows. No se incluye en los ejecutables. No entregues esta clave a compradores.

Para recuperar la contraseña usa el menú **Monitoreo → Abrir versión para navegador** y solicita y abre el correo en ese mismo navegador. Después entra en la app con tu nueva contraseña. Para cuentas nuevas, confirma el correo antes de iniciar sesión.

En una PC sin conexión configurada todavía se puede explorar la demo, que no crea cuentas ni representa lecturas reales. La aplicación necesita Internet para autenticación, configuración y monitoreo en Supabase; todavía no integra el visualizador USB sin conexión.

Para distribuir a compradores, primero publica la web y su API en Vercel, configura Supabase Auth para ese dominio y establece la URL HTTPS en `desktop/site.json`. Vuelve a compilar: esa edición de la app abrirá el servicio público, y cada comprador solo necesitará su cuenta y el código del kit. La clave privada estará en el servidor, nunca en las PC de los compradores.

## Modificar y recompilar

Edita el proyecto de la USB y ejecuta `COMPILAR-APP-PC.cmd`. Requiere Node.js en la computadora que compila, y las dependencias web del proyecto. Descarga Electron y electron-builder desde npm y sus distribuciones oficiales. Las herramientas y la carpeta temporal de compilación se guardan en `%LOCALAPPDATA%\EstacionHidrometrica`, para no duplicar miles de dependencias en la USB.

El empaquetado usa una lista explícita de archivos permitidos. Excluye `.env`, claves privadas, fichas de gateways, pruebas y documentación de comprobación. Los ejecutables y la salida compilada no se incluyen en Git; se compilan de nuevo cuando cambia el proyecto.

Todavía no incluye actualizaciones automáticas. La primera versión es para pruebas del proyecto; faltan validar el instalador en la otra computadora, el despliegue público y los gateways reales antes de entregar kits a compradores.
