# Estado del proyecto — laptop, 14 de octubre de 2026

Versión 0.2.0. Fuente: E:\Estacion Hidrometrica Work\Codigo\EstacionHidrometrica. Repositorio: AngelAlvarez962/AppEstacionHidrometrica. Supabase: monitoreo-rio-kits, ref njwxrnhfxjbtsxemrmol.

Práctica física del 14 de octubre: se identificó COM3 como gateway de KIT-000001 y se configuró EST-000001 con distancia al fondo 62.3 cm (regla), capacidad 16 cm y avisos a 12/15 cm. El eco no está validado: la cubeta vacía dio unos 49–60 cm, aunque la regla indica 62.3 cm. No corregir esto usando 50.4 como fondo. Se preparó `firmware/practica-cubeta` con sketches y un puente USB de desarrollo; el parser y recepción por USB se probaron, pero publicar lecturas permanece desactivado. La herramienta de diagnóstico no sustituye un monitor USB offline integrado en la app. Los intentos de respaldo de flash se interrumpieron: no se cambió el firmware del gateway ni se afirma que exista un respaldo completo. La estación ya no está disponible; pendientes prueba física y envío real a la app. Ver `firmware/practica-cubeta/LEEME.md`.

Ya hay aplicación para navegador y Windows x64, inicio de sesión y primera cuenta administradora confirmada. Las catorce tablas tienen RLS. Migraciones 001 a 005 aplicadas; no repetirlas en esta base. Se conservan datos e historial existentes.

La versión 0.2.0 agrega tres presentaciones (estación + gateway, solo estación, solo gateway), identificadores cortos y estaciones con propiedad independiente del receptor. Una estación puede usar el gateway de otra compra del mismo comprador. No puede usar un gateway de otra cuenta. La activación exige completar gateway y calibración antes de aceptar lecturas. Incluye activación de un gateway dentro del proceso y cierre de sesión para retomarlo después.

Se mantiene la separación entre entidades personales y clasificación privada del administrador. Los compradores solo ven y modifican sus propios dispositivos. Las estaciones eliminadas pueden restaurarse y conservan historial.

Los avisos por correo tienen preferencia por cuenta, cola privada, deduplicación y reintentos simulados. No hay proveedor ni envío real configurado. El adaptador usa Resend con variables privadas; los mensajes requieren Internet y servidor activo. No se envían avisos de desconexión aún. La autenticación por correo de Supabase es independiente.

Aplicación actual: Aplicaciones/v0.2.0/Programa, fuera del código. ABRIR-APP.cmd en la carpeta principal abre la versión actual. Aplicaciones/v0.1.0 conserva la anterior. El código está en Codigo/EstacionHidrometrica. Se quitaron los ZIP y el compilador ya no los genera. No se publicó una plataforma de descargas.

La clave privada de Supabase permanece únicamente en el perfil de Windows de esta laptop, fuera de la USB y Git. En otra PC sin configuración funciona la demo. Para compradores hace falta una API central; no se les debe entregar una clave privada. Esta edición necesita Internet para datos reales y todavía no incorpora el visualizador USB sin conexión del proyecto anterior.

Validación: pruebas automatizadas de cálculo, API, RLS, migración, expansión de kits, cola de correos, aislamiento de cuentas y protección de navegación de escritorio; compilación web y Windows. Pruebas visuales en demo de registro, medidas inválidas, Escape, activación de receptor y vuelta al panel. La ventana compilada de Windows abrió y mostró el monitoreo de ejemplo; cierre y arranque desde cero comprobados. No se crearon equipos de prueba ni lecturas ficticias en Supabase.

Próximo paso: probar un kit físico (firmware, serie técnica y credencial de la ficha, conexión a esta API) y ajustar errores. Pendientes: Wi-Fi del gateway desde la app, correos reales, segunda PC y API central para compradores. Android queda para después. Consulta PRUEBAS-VERSION-0.2.md.
