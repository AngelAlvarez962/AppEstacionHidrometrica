# Aplicación para Windows

La aplicación actual está en Aplicaciones/v0.2.1, fuera de la carpeta del código. Abre ABRIR-APP.cmd en la carpeta principal de la USB o ABRIR-ESTA-VERSION.cmd dentro de esa versión. Los archivos internos están en Programa: no los separes.

Aplicaciones/v0.2.0 y Aplicaciones/v0.1.0 conservan las ediciones anteriores como referencia. Cierra la app actual antes de abrir otra versión. La 0.1.0 no es la adecuada para preparar kits con el nuevo modelo del backend. Sus portable/instalador históricos y una compilación incompleta se guardan en Archivos-anteriores; usa la 0.2.1 para tus pruebas.

Esta laptop conserva una copia rápida en %LOCALAPPDATA%\EstacionHidrometrica\App-PC. Tanto el lanzador principal como ABRIR-ESTA-VERSION.cmd la usan únicamente si su VERSION.txt coincide con la versión seleccionada y existe el paquete. Si otra PC no tiene esa versión, el lanzador la copia una sola vez a %LOCALAPPDATA%\EstacionHidrometrica\Aplicaciones\v<versión>. Comprueba el paquete antes de marcar la copia como lista. Las siguientes aperturas leen del disco de esa PC y no vuelven a copiar. No se necesita Node.js para el programa compilado.

Usa los archivos CMD para abrir. Abrir directamente Programa/Hackeando las inundaciones.exe en la USB omite la copia rápida y puede tardar más. Si ya tienes una ventana ejecutándose desde la USB, ciérrala antes de probar el nuevo lanzador: la app evita abrir una segunda instancia y enfoca la que ya estaba abierta. La primera preparación en otra PC seguirá tardando lo que requiera copiar el programa; eso no se repite en cada apertura. Mantén ABRIR.ps1 junto a ABRIR-ESTA-VERSION.cmd para poder usar esa carpeta sin el código fuente.

La clave privada de Supabase permanece fuera de la USB, en el perfil de Windows de cada PC de desarrollo. No entregues esa clave a compradores. En una PC sin conexión configurada funciona la demo. Datos reales requieren Internet; el visualizador USB offline todavía no está integrado.

Para editar, entra en Codigo/EstacionHidrometrica y abre DESARROLLAR.cmd. Cierra la app antes de ejecutar COMPILAR-APP-PC.cmd. El compilador genera Aplicaciones/v<versión>/Programa, crea su lanzador y actualiza Actual.txt y la copia local. Ya no genera ZIP. Para otra versión cambia package.json y desktop/package.json antes de compilar.

La aplicación se genera para Windows x64. Los portable/instalador anteriores tenían limitaciones de firma; no se modificaron las protecciones de Windows. Si otra PC bloquea el programa, falta validar la firma allí. Android queda para después.

Consulta PRUEBAS-VERSION-0.2.md para probar registro, configuración, gateways y avisos por correo; el proveedor de envío sigue pendiente.

El monitoreo 0.2.1 empieza con tarjetas. Al abrir una, muestra el detalle por separado; Volver a mis estaciones conserva el filtro del resumen. Consulta PRUEBAS-VERSION-0.2.1.md.
