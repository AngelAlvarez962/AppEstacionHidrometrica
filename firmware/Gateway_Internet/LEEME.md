# Gateway USB + Internet (Heltec WiFi LoRa 32 V2)

Preparación inicial: Arduino IDE con ESP32 **3.3.12**, placa **Heltec WiFi LoRa 32 V2**, bibliotecas **LoRa**, **Adafruit GFX**, **Adafruit SSD1306** (con Adafruit BusIO) y **ArduinoJson 7.4.3**. Wi-Fi, Preferences, HTTPClient y NetworkClientSecure vienen con ESP32. No usar Arduino Uno como placa de destino.

Cargar `Gateway_Internet.ino` sin borrar toda la memoria. Antes de reemplazar un gateway en funcionamiento, respaldar y verificar su firmware. No cargar este programa en la estación del sensor.

Después, desde la app 0.3.0: Mis gateways → Conectar por USB → Guardar gateway → Configurar Wi-Fi. Se admiten hasta ocho estaciones con nombres de radio diferentes, ya vinculadas y configuradas en la cuenta. Si se agrega o cambia una estación, vuelve a guardar el Wi-Fi para actualizar esa lista en el receptor.

Radio conservada: 915 MHz, SF7, BW125 kHz, CR4/5, sincronía 0x12 y CRC. SPI 5/19/27, CS18, RST14, DIO0 26; OLED SDA4/SCL15/RST16; VEXT21 activo bajo.

La configuración se conserva en NVS con Preferences. Una sola escritura guarda red, credencial y estaciones. La prueba de confirmación por USB permite activar la nueva credencial en el servidor; si no se confirma, la anterior no se revoca. Nunca se imprime la contraseña ni el token en Serial.

El envío HTTPS se realiza en otra tarea para no bloquear la recepción LoRa; la cola es acotada y se descartan muestras antiguas al volver Internet. No es un registrador histórico sin conexión. Se valida el certificado y se sincroniza la hora por NTP; no se utiliza `setInsecure()`. Los certificados públicos de `certificates.h` deberán actualizarse si cambia la cadena de confianza o antes de su vencimiento.

La URL apunta exclusivamente al proyecto de la app. No utiliza las credenciales ni las tablas de la primera página web.
