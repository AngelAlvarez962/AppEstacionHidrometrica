# Aplicación para Windows

La aplicación actual está en Aplicaciones/v0.2.0, fuera de la carpeta del código. Abre ABRIR-APP.cmd en la carpeta principal de la USB o ABRIR-ESTA-VERSION.cmd dentro de esa versión. Los archivos internos están en Programa: no los separes.

Aplicaciones/v0.1.0 conserva la edición anterior como referencia. Cierra la app actual antes de abrir otra versión. La 0.1.0 no es la adecuada para preparar kits con el nuevo modelo del backend. Sus portable/instalador históricos y una compilación incompleta se guardan en Archivos-anteriores; usa la 0.2.0 para tus pruebas.

Esta laptop conserva una copia rápida en %LOCALAPPDATA%\EstacionHidrometrica\App-PC. El lanzador principal la usa únicamente si su VERSION.txt coincide con la versión seleccionada. En otra PC abre la carpeta de la USB. No se necesita Node.js para el programa compilado.

La clave privada de Supabase permanece fuera de la USB, en el perfil de Windows de cada PC de desarrollo. No entregues esa clave a compradores. En una PC sin conexión configurada funciona la demo. Datos reales requieren Internet; el visualizador USB offline todavía no está integrado.

Para editar, entra en Codigo/EstacionHidrometrica y abre DESARROLLAR.cmd. Cierra la app antes de ejecutar COMPILAR-APP-PC.cmd. El compilador genera Aplicaciones/v<versión>/Programa, crea su lanzador y actualiza Actual.txt y la copia local. Ya no genera ZIP. Para otra versión cambia package.json y desktop/package.json antes de compilar.

La versión actual se probó en Windows x64. Los portable/instalador anteriores tenían limitaciones de firma; no se modificaron las protecciones de Windows. Si otra PC bloquea el programa, falta validar la firma allí. Android queda para después.

Consulta PRUEBAS-VERSION-0.2.md para probar registro, configuración, gateways y avisos por correo; el proveedor de envío sigue pendiente.
