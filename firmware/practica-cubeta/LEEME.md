# Práctica con cubeta y gateway USB — 14 de octubre de 2026

Esta carpeta prepara la estación EST-000001 y el gateway GW-000001 para la aplicación 0.2.0. El gateway físico está en COM3. No corresponde a la web ni al proyecto Supabase anteriores.

## Referencia de la cubeta

La medida con regla desde la cara del sensor hasta el fondo interior es **62.3 cm**. La altura útil de agua es **16 cm**. En la aplicación, la distancia al fondo y la capacidad son valores distintos: el porcentaje se calcula sobre los 16 cm, no sobre los 62.3 cm.

- Vacía: distancia esperada 62.3 cm; nivel 0 cm.
- Agua a 8 cm: distancia esperada 54.3 cm; 50%.
- Agua a 16 cm: distancia esperada 46.3 cm; 100%.
- Umbral amarillo propuesto para esta práctica: 12 cm de agua.
- Umbral rojo propuesto: 15 cm de agua. Es un aviso previo al borde, no una confirmación de desbordamiento.

**La lectura física todavía no está validada.** Con la cubeta vacía el sensor muestra aproximadamente 49–60 cm, bastante menos que la regla. No usar 50.4 cm como fondo ni compensar esa diferencia con un ajuste: podría estar detectando otra superficie. `sensor_validated` permanece en `false` y el lector no publica niveles en la nube.

Como el soporte no se puede mover, probar elevando la cubeta vacía sobre una base firme aproximadamente 17 cm. Medir de nuevo desde la cara del sensor al fondo interior; no suponer que quedaron exactamente 45 cm. Centrar la cubeta debajo del sensor. Comparar la lectura en vacío y después con agua a una altura medida (por ejemplo 8 cm). Si no coincide o fluctúa varios centímetros, revisar el eco y probar un recipiente más ancho antes de calibrar.

Si se cambia la posición, actualizar la medida real al fondo en la aplicación, en `configuracion.json` y en `SENSOR_A_FONDO_CM` del sketch de estación si se utiliza su OLED. La capacidad continúa en 16 cm si se conserva la cubeta. Registrar ambas pruebas antes de activar la publicación.

## Abrir el diagnóstico USB

1. Conectar el gateway a la laptop con USB. COM3 es el puerto actual; puede cambiar en otra PC.
2. Cerrar el monitor serial de Arduino y cualquier otro programa que ocupe ese puerto.
3. Abrir `CONECTAR-GATEWAY.cmd`. La ventana muestra las distancias reales recibidas por radio. Cerrar con Ctrl+C o cerrando la ventana.
4. No desconectar la USB de archivos mientras los programas estén ejecutándose desde ella.

El parser acepta la identidad técnica de esta estación y, durante la transición, el transmisor anterior `RIO_01`. Rechaza otras estaciones y líneas malformadas. `-SoloLectura` fuerza diagnóstico incluso después de validar el sensor. `-ProbarParser` prueba el formato sin abrir COM ni llamar a Supabase.

## Firmware preparado

- `Gateway_USB/Gateway_USB.ino`: Heltec WiFi LoRa 32 V2, recibe LoRa y entrega tramas por USB a 115200 baudios. No usa Wi-Fi ni contiene claves de Supabase. Cargar exclusivamente en el gateway.
- `Estacion_Cubeta/Estacion_Cubeta.ino`: transmisor con identidad técnica de EST-000001, sensor en TRIG 13 / ECHO 23 y pantalla de distancia, nivel y porcentaje. Cargar exclusivamente en la estación. El transmisor actual RIO_01 puede utilizarse para la primera prueba USB sin cambiarlo.
- Ambos usan radio de 915 MHz, SF7, ancho 125 kHz, CR4/5, sync 0x12 y CRC. Mantener la antena conectada al usar la radio.

Antes de reemplazar firmware se guarda una copia privada de la memoria original en el perfil de esta laptop. La copia puede contener datos anteriores de conexión: no compartirla ni copiarla al repositorio o al kit.

## Conexión a la app: alcance actual

El lector es una herramienta de desarrollo de esta laptop, **todavía no una función USB integrada en la aplicación de compradores**. En diagnóstico funciona sin Internet y sin claves privadas; la app 0.2.0 no incorpora todavía un monitor USB offline propio.

Cuando el eco esté validado, el puente puede enviar las lecturas reales al Supabase nuevo y la aplicación puede consultarlas. Esa ruta necesita Internet en la PC y el perfil privado ya configurado fuera de la USB. Nunca entregar ese perfil ni la clave administrativa a compradores. En una segunda PC, el diagnóstico USB puede funcionar sin ese perfil, pero la publicación de desarrollo requiere configurarla aparte.

`configuracion.json` identifica los equipos propios de esta práctica y se excluye de Git. No editarlo para asociar equipos ajenos. No escribir contraseñas ni credenciales en los sketches.

## Comprobaciones de archivos

El gateway compiló correctamente con ESP32 core 3.3.12 para Heltec WiFi LoRa 32 V2 (309476 bytes de programa). El parser USB y las pruebas existentes de cálculo de nivel/porcentaje pasaron. Esta comprobación de software no valida el eco físico ni equivale a cargar el firmware en la placa. No se cambió el firmware del gateway: la copia de respaldo se interrumpió dos veces. El firmware anterior puede seguir usándose con el lector de esta práctica.

La estación también compiló correctamente con ESP32 core 3.3.12 para Heltec V2 (313151 bytes de programa). Ambos códigos están preparados, sin cargar en las placas.
