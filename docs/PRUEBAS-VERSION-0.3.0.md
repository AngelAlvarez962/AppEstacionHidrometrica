# Verificación de la versión 0.3.0

- 35 pruebas correctas: cálculo y antigüedad, sesiones, recuperación, API, RLS, propiedad, expansión, persistencia del gateway preferido, confirmación de cambio, transferencia atómica de estaciones, claves pendientes/confirmación/revocación, parser USB, cierre del puerto y rechazo de credenciales inválidas.
- El endpoint HTTPS de producción rechazó una credencial inventada. La clave pública no permitió leer mediciones. Esta prueba no insertó lecturas.
- Compilaciones Vite, Electron Windows x64 y Heltec ESP32 V2 completadas.
- Vista de la guía: seis pasos, anterior/siguiente, terminar y volver después. El modo demo no conecta hardware ni se utiliza como evidencia de mediciones reales.
- Respaldo original del gateway de 8 MB verificado por digest. No se borró NVS al cargar el nuevo programa.
- Recepción física RIO_02 con lecturas reales y envío por Wi-Fi directo comprobado al cerrar el lector serie de la computadora. La vinculación permanece en la cuenta.
- La pantalla del gateway vuelve a mostrar distancia, alias y estado, además de conexión.
- Paquetes USB y copia local verificados por SHA256 de EXE y app.asar. No incluyen el perfil privado de Windows.

No se ensayó la resistencia del cargador ni una instalación en campo. La alimentación física mediante otro cargador y el funcionamiento en otra PC siguen siendo pruebas del usuario. Consultar `GUIA-CONEXION.md` y `ESTADO.md` para los límites actuales.
