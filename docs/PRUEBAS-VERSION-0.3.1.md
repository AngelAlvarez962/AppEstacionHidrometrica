# Versión 0.3.1 — Correos desde celular

Fecha: 22 de octubre de 2026.

La confirmación de correo y la recuperación de contraseña abren ahora una página pública HTTPS:
https://acceso-tacotalpa.silkyteal24.chatgpt.site/

Para probarlo, abre la app actualizada, solicita un correo nuevo y abre el enlace más reciente desde tu celular. Al terminar, vuelve a iniciar sesión en la app de la computadora. Los correos enviados antes de actualizar pueden conservar la dirección anterior. La página pública atiende el acceso a la cuenta; el panel de monitoreo de esta instalación sigue en la computadora.

La app conserva el cliente principal con PKCE. Las solicitudes de correo usan un cliente independiente sin almacenamiento de sesión, con retorno implícito para permitir abrir el correo en otro dispositivo. El portal retira el fragmento del historial inmediatamente, valida la sesión directamente con Supabase y no conserva tokens en almacenamiento del navegador. Después de confirmar o cambiar la contraseña cierra únicamente la sesión temporal. No se publicaron claves privadas. Se conservaron las URL locales permitidas por compatibilidad y se agregó sólo la URL HTTPS exacta, sin comodines.

Validación: suite completa de la app aprobada; seis pruebas del portal; compilación de Windows; prueba con cuenta sintética de confirmación y recuperación con enlace estándar sin PKCE, cambio y comprobación de contraseña y eliminación de la cuenta de prueba, sin enviar correos. Publicación del portal versión 2 y comprobación en navegador. La prueba final con el correo real en un teléfono queda a cargo del usuario. No se cambió su contraseña.

No se modificó el firmware ni la calibración de la estación o el gateway.
