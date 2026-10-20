# Organización — laptop, 20 de octubre de 2026

La carpeta principal de la USB contiene ABRIR-APP.cmd, Aplicaciones, Codigo, LEEME.txt y Bitacora.txt.

**Aplicaciones/v0.2.1** es la versión actual, lista para abrir sin descomprimir. **Aplicaciones/v0.2.0** conserva la edición previa al nuevo monitoreo. **Aplicaciones/v0.1.0** conserva la primera edición y, en Archivos-anteriores, sus ejecutables históricos y la compilación parcial. La versión antigua se conserva como referencia: el backend ya tiene el modelo de la 0.2.0.

**Codigo/EstacionHidrometrica** contiene el proyecto activo y su repositorio Git. No se duplican dependencias por cada versión. El historial del código anterior está en Git (0.1.0: 555cab9; primera 0.2.0: 4d0708b). No cambies las medidas ni el firmware desde una copia histórica.

ABRIR-APP.cmd usa la versión indicada en Aplicaciones/Actual.txt. Reutiliza la copia de esta laptop solo si VERSION.txt coincide; de lo contrario prepara una copia local de esa versión desde la USB una sola vez. Cada versión tiene ABRIR-ESTA-VERSION.cmd para abrirla directamente. El ejecutable y sus archivos internos están en Programa. Cierra la app antes de abrir otra versión.

COMPILAR-APP-PC.cmd crea Aplicaciones/v<versión> y actualiza Actual.txt y la copia local de Windows. Ya no genera ZIP. Para una nueva versión, cambia la versión de package.json y desktop/package.json antes de compilar; conserva la versión anterior.

Los lanzadores de desarrollo/configuración usan rutas relativas y continúan funcionando desde Codigo/EstacionHidrometrica. El acceso directo de Windows sigue apuntando a la copia local del programa. Las claves privadas no se movieron y siguen fuera de la USB.
