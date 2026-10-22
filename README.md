# Estación Hidrométrica — Tacotalpa

Versión 0.3.2. Aplicación principal: https://app-estacion-hidrometrica.vercel.app/

Incluye el logo original de Ideas Disruptivas. La web permite entrar con las cuentas existentes, consultar estaciones e historial, explorar la demo y configurar gateways compatibles. La demo usa datos de ejemplo. Las lecturas reales requieren el gateway y la estación encendidos y conectados.

## Trabajo y respaldos

La copia principal está en `C:/Users/angel/Documents/Codex/Aplicacion Estacion Hidrometrica/Codigo/EstacionHidrometrica`. Se trabaja desde el disco de la laptop, no desde la USB. Al terminar una jornada ejecutar `Guardar-Avances.ps1` en la raíz de la copia principal. Sincroniza el código y la aplicación compilada con `C:/Users/angel/Desktop/Aplicacion Estacion Hidrometrica` y `E:/Estacion Hidrometrica Work`, después de verificar la USB. No elimina versiones anteriores ni copia perfiles privados. Incluye un bundle de Git para recuperar el historial.

## Desarrollo

Node.js 22.12 o superior. `npm ci`, `npm test`, `npm run dev` y `npm run build`. `npm run build:pc` compila Windows. Los usuarios de la web no necesitan instalar Node.js ni descargar un ZIP.

## Publicación

Proyecto Vercel: `app-estacion-hidrometrica`, equipo `angelalvarez962s-projects`. Vite compila con `npm run build`, salida `dist`; las funciones están en `api`. Configuración privada sólo en las variables del servidor: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `AUTH_PORTAL_URL`. Nunca añadir prefijo `VITE_` a secretos. `.vercel`, `.env*`, firmware, documentos privados y perfiles locales se excluyen del envío.

Repositorio: https://github.com/AngelAlvarez962/AppEstacionHidrometrica. No se modificó el proyecto Vercel de la primera página web.

La confirmación y recuperación del correo usan el portal público https://acceso-tacotalpa.silkyteal24.chatgpt.site/. El cliente de correo es independiente para permitir abrir enlaces en el celular. La confirmación de correo y RLS siguen activas.

## Estado y límites

Supabase `monitoreo-rio-kits`: migraciones 001–007 ya aplicadas; no repetirlas. Roles y separación por cuenta se comprueban en servidor y base de datos. El gateway recibe RIO_02 y envía a Supabase por HTTPS con credencial limitada. No se cambió su firmware ni calibración en esta publicación.

Los avisos automáticos por correo necesitan proveedor y ejecución de la cola en la nube; no se anuncian como activos. El visualizador USB sin Internet todavía es independiente. La calibración actual de Tacotalpa sigue siendo de práctica, antes de instalar en el río hay que guardar las medidas reales del lugar. Consultar `docs/ESTADO.md` y `docs/API.md`.
