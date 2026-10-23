// Estación Tacotalpa · entrega revisada el 23 de octubre de 2026
// GUÍA DE AJUSTES DEL KIT: comentarios de entrega con el cableado actual confirmado.
// Estas placas son Heltec WiFi LoRa 32 V2 (ESP32), programadas con Arduino IDE.
// No seleccionar Arduino Uno ni LoRa32 V3: son placas distintas.
//
// Para ubicar un ajuste, usa Ctrl+F y busca estas etiquetas:
// [AJUSTE HABITUAL] = dato identificable que puedes editar siguiendo el ejemplo.
// [CALIBRACION] = medir la instalación antes de cambiar el valor.
// [CAMBIO COORDINADO] = revisar también el otro equipo o la página.
// [HARDWARE] = cambiar sólo si cambió la placa o el cableado real.
// [CONSERVAR] = mecanismo interno; no hace falta editarlo para usar el kit.
//
// Antes de editar: guarda una copia; cambia un dato, pulsa Verificar y prueba.
// Conserva comillas, puntos decimales, nombres y punto y coma de cada línea.
// Ejemplo: 5000 son milisegundos (5 s); en decimales escribe 63.0, no 63,0.
// Los comentarios explican ajustes; no son instrucciones que ejecuta la placa.

// FUNCIÓN: medir distancia y transmitirla por LoRa; esta placa no usa Wi-Fi.

#include <SPI.h>
#include <LoRa.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ===================================================================
// 1. CONFIGURACIÓN DE LA ESTACIÓN
// ===================================================================
// [AJUSTE HABITUAL] IDENTIFICADOR: el nombre que reconocerán gateway y página.
// RIO_02 es el identificador actual vinculado a Tacotalpa en la app.
// Para cambiar el nombre visible, edita Tacotalpa en la app; conserva este ID técnico.
// Cambiar NODE_ID requiere actualizar la asociación del gateway/app; no migra el historial.
// Debe ser único y coincidir exactamente con el ID dado de alta en la página.
// No usar GATEWAY_01 para una estación ni incluir comas dentro del nombre.
const String NODE_ID            = "RIO_02";
// [AJUSTE HABITUAL] INTERVALO_REFRESCO está en MILISEGUNDOS: 1500 = 1.5 s.
// Ejemplo: 5000 deja una pausa base de 5 s. No cambiar el tipo ni quitar ;.
// El ciclo real tarda algo más por las muestras, la radio y la pausa aleatoria.
// Un intervalo mayor reduce frecuencia de envíos; uno menor no garantiza mayor precisión.
const int    INTERVALO_REFRESCO = 1500;
// [CAMBIO COORDINADO] RANGO EN cm: límites para aceptar distancias, no alturas del agua.
// 20.0 es la zona mínima configurada y 600.0 el máximo del programa actual.
// Cambiar estas cifras NO amplía la capacidad física ni elimina la zona ciega del sensor.
// El gateway también valida 20.0 y 600.0 en loop(): revisar ambos lados si cambia el sensor.
// No poner aquí la profundidad de la cubeta ni los umbrales de alerta.
const float  DISTANCIA_MIN_CM   = 20.0;
const float  DISTANCIA_MAX_CM   = 600.0;

// ===================================================================
// 2. PINES DEL SENSOR ULTRASÓNICO AJ-SR04M
// ===================================================================
// Modo TRIG/ECHO
// [HARDWARE] AJ-SR04M en modo TRIG/ECHO, no en modo UART.
// Cable azul TRIG: GPIO13. Cable morado ECHO: GPIO23. Son números GPIO.
// Editar sólo si el cable se conecta realmente a otro GPIO libre y adecuado.
// El código no adapta tensiones. Si ECHO entrega 5V, usar divisor hacia el ESP32 (3.3V).
// Divisor propuesto: ECHO -> 2.2 kOhm -> unión GPIO23 -> 3.3 kOhm -> GND.
// Negro: GND común; rojo: alimentación 5V del sensor. Revisar con el equipo apagado.
const int trigPin = 13;
const int echoPin = 23;   // Cableado actual confirmado por el usuario

// ===================================================================
// 3. PINES HELTEC WiFi LoRa 32 V2
// ===================================================================
// [HARDWARE] Pines de la OLED integrada en Heltec V2: conservar en esta misma placa.
// Cambiar de placa puede requerir revisar radio, alimentación y pantalla, no sólo su nombre.
#define VEXT_PIN 21

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

#define OLED_SDA 4
#define OLED_SCL 15
#define OLED_RST 16

// Objeto de pantalla OLED integrada
Adafruit_SSD1306 display(
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  &Wire,
  OLED_RST
);

// ===================================================================
// 4. PINES LoRa
// ===================================================================
// [HARDWARE] Cableado interno SPI/radio del Heltec V2: no editar para cambiar de ubicación.
#define LORA_SCK 5
#define LORA_MISO 19
#define LORA_MOSI 27
#define LORA_CS 18
#define LORA_RST 14
#define LORA_DIO0 26

// [CAMBIO COORDINADO] 915E6 significa 915 MHz. Estación y gateway deben coincidir.
// Usar únicamente una banda que soporte el módulo y corresponda a la instalación.
// No cambiar sólo esta placa esperando que el receptor siga escuchándola.
#define BAND 915E6

unsigned long packetCounter = 0;

// ===================================================================
// 5. DIAGNÓSTICOS DEL SENSOR
// ===================================================================
// [CONSERVAR] Diagnósticos internos. SIN_ECO no identifica por sí solo un cable suelto;
// ERR_CORTO es un nombre heredado para Echo alto/bloqueado, no prueba un cortocircuito.
// Conservar los textos transmitidos: la página interpreta esos mismos códigos.
enum DiagnosticoSensor {
  DIAG_OK,
  DIAG_SIN_RESPUESTA,
  DIAG_ECHO_BLOQUEADO,
  DIAG_FUERA_DE_RANGO,
  DIAG_ZONA_CIEGA
};

// ===================================================================
// 6. MEDICIÓN INDIVIDUAL
// ===================================================================
// [CONSERVAR] Tiempos de disparo y espera: 36000 microsegundos es el timeout actual.
// El factor 0.0343 aproxima la velocidad del sonido en cm/us; no es la calibración de altura.
// Si se aumenta mucho el alcance, revisar timeout, límites de ambos equipos y sensor real.
DiagnosticoSensor tomarMuestraIndividual(float &dist) {

  // Echo alto antes del disparo
  if (digitalRead(echoPin) == HIGH) {
    return DIAG_ECHO_BLOQUEADO;
  }

  // Pulso TRIG
  digitalWrite(trigPin, LOW);
  delayMicroseconds(4);

  digitalWrite(trigPin, HIGH);
  delayMicroseconds(20);

  digitalWrite(trigPin, LOW);

  // Medición del ECHO
  unsigned long duracion = pulseIn(
    echoPin,
    HIGH,
    36000
  );

  // Si hubo timeout
  if (duracion == 0) {

    if (digitalRead(echoPin) == HIGH) {

      unsigned long t0 = millis();

      while (
        digitalRead(echoPin) == HIGH &&
        (millis() - t0 < 45)
      ) {
        delayMicroseconds(100);
      }

      return DIAG_FUERA_DE_RANGO;

    } else {

      return DIAG_SIN_RESPUESTA;
    }
  }

  // Conversión de tiempo a distancia
  dist = (duracion * 0.0343) / 2.0;

  // Zona ciega
  if (dist < DISTANCIA_MIN_CM) {

    dist = DISTANCIA_MIN_CM;

    return DIAG_ZONA_CIEGA;
  }

  // Fuera del rango máximo
  if (dist > DISTANCIA_MAX_CM) {

    return DIAG_FUERA_DE_RANGO;
  }

  return DIAG_OK;
}

// ===================================================================
// 7. FILTRO DE 3 MUESTRAS
// ===================================================================
// [CONSERVAR] Filtro de tres muestras: acepta al menos dos, y usa mediana o promedio.
// No cambiar un 3 aislado: arreglo, bucles y elección del resultado deben concordar.
// La pausa de 65 ms separa mediciones. Revisar montaje y ecos antes de alterar el filtro.
DiagnosticoSensor leerSensorFiltrado(float &distanciaFinal) {

  float validas[3];

  int conteoOk = 0;
  int conteoZonaCiega = 0;

  DiagnosticoSensor ultimoFallo = DIAG_SIN_RESPUESTA;

  for (int i = 0; i < 3; i++) {

    float d = 0.0;

    DiagnosticoSensor res =
      tomarMuestraIndividual(d);

    if (res == DIAG_OK) {

      validas[conteoOk] = d;
      conteoOk++;

    } else if (res == DIAG_ZONA_CIEGA) {

      conteoZonaCiega++;
      ultimoFallo = res;

    } else {

      ultimoFallo = res;
    }

    delay(65);
  }

  // Zona ciega
  if (
    conteoZonaCiega > 0 &&
    conteoOk == 0
  ) {

    distanciaFinal = DISTANCIA_MIN_CM;

    return DIAG_ZONA_CIEGA;
  }

  // Lecturas válidas
  if (conteoOk > 0) {

    // Ordenar valores
    for (int i = 0; i < conteoOk; i++) {

      for (int j = i + 1; j < conteoOk; j++) {

        if (validas[j] < validas[i]) {

          float aux = validas[i];

          validas[i] = validas[j];

          validas[j] = aux;
        }
      }
    }

    // Requerir mínimo 2 lecturas válidas
    if (conteoOk < 2) {

      distanciaFinal = 0;

      return DIAG_SIN_RESPUESTA;
    }

    // Mediana o promedio
    if (conteoOk == 3) {

      distanciaFinal = validas[1];

    } else {

      distanciaFinal =
        (validas[0] + validas[1]) / 2.0;
    }

    return DIAG_OK;
  }

  if (ultimoFallo == DIAG_ZONA_CIEGA) {

    distanciaFinal = DISTANCIA_MIN_CM;

  } else {

    distanciaFinal = 0.0;
  }

  return ultimoFallo;
}

// ===================================================================
// 8. SETUP
// ===================================================================
void setup() {

// Monitor Serie del IDE: seleccionar 115200 baudios para leer estos mensajes.
// Cambiar este número sólo si también ajustas la velocidad del monitor/visualizador USB.
  Serial.begin(115200);

  // ---------------------------------------------------------------
  // SENSOR ULTRASÓNICO
  // ---------------------------------------------------------------
  pinMode(trigPin, OUTPUT);

  // ECHO conectado al GPIO23 mediante la adaptación de nivel necesaria.
  pinMode(echoPin, INPUT_PULLDOWN);

  digitalWrite(trigPin, LOW);

  // ---------------------------------------------------------------
  // OLED
  // ---------------------------------------------------------------
  pinMode(VEXT_PIN, OUTPUT);

  digitalWrite(VEXT_PIN, LOW);

  delay(50);

  pinMode(OLED_RST, OUTPUT);

  digitalWrite(OLED_RST, LOW);

  delay(20);

  digitalWrite(OLED_RST, HIGH);

  Wire.begin(
    OLED_SDA,
    OLED_SCL
  );

  Wire.setClock(400000);

  display.begin(
    SSD1306_SWITCHCAPVCC,
    0x3C
  );

  display.clearDisplay();

  display.setTextColor(WHITE);

  display.setTextSize(1);

  display.setCursor(0, 10);

  display.println("INICIANDO NODO...");

  display.println(NODE_ID);

  display.display();

  // ---------------------------------------------------------------
  // LoRa
  // ---------------------------------------------------------------
  SPI.begin(
    LORA_SCK,
    LORA_MISO,
    LORA_MOSI,
    LORA_CS
  );

  LoRa.setPins(
    LORA_CS,
    LORA_RST,
    LORA_DIO0
  );

  if (!LoRa.begin(BAND)) {

    Serial.println(
      F("Error al iniciar LoRa en Transmisor")
    );

    display.clearDisplay();

    display.setCursor(0, 20);

    display.println("Falla LoRa!");

    display.display();

    while (1);
  }

// [CAMBIO COORDINADO] Perfil de radio: conservar los mismos valores en el gateway.
// SF=7, ancho=125E3 (125 kHz), codificación=5 (4/5), SyncWord=0x12 y CRC activado.
// Modificar el perfil puede cambiar alcance, duración del envío y compatibilidad.
  LoRa.setSpreadingFactor(7);

  LoRa.setSignalBandwidth(125E3);

  LoRa.setCodingRate4(5);

  LoRa.setSyncWord(0x12);

  LoRa.enableCrc();

// [CAMBIO DE RADIO] 17 es potencia de transmisión en dBm; no son metros de alcance.
// Una potencia distinta cambia consumo y condiciones de operación. No subirla a ciegas.
  LoRa.setTxPower(17);

  delay(500);
}

// ===================================================================
// 9. LOOP
// ===================================================================
void loop() {

  float distancia = 0.0;

  DiagnosticoSensor diag =
    leerSensorFiltrado(distancia);

  String estadoTexto = "";

  // ---------------------------------------------------------------
  // DETERMINAR ESTADO
  // ---------------------------------------------------------------
  switch (diag) {

    case DIAG_OK:

      estadoTexto = "OK";

      break;

    case DIAG_SIN_RESPUESTA:

      estadoTexto = "SIN_ECO";

      break;

    case DIAG_ECHO_BLOQUEADO:

      estadoTexto = "ERR_CORTO";

      break;

    case DIAG_FUERA_DE_RANGO:

      estadoTexto = "SIN_ECO";

      break;

    case DIAG_ZONA_CIEGA:

      estadoTexto = "FUERA_RANGO";

      break;
  }

  // ---------------------------------------------------------------
  // OLED
  // ---------------------------------------------------------------
  display.clearDisplay();

  display.setTextSize(1);

  display.setCursor(0, 0);

  display.print(NODE_ID);

  display.print(" | #");

  display.println(packetCounter);

  display.drawLine(
    0,
    10,
    127,
    10,
    WHITE
  );

  if (diag == DIAG_OK) {

    display.setCursor(0, 16);

    display.println(
      "Distancia al Agua:"
    );

    display.setTextSize(2);

    display.setCursor(10, 32);

    display.print(
      distancia,
      1
    );

    display.setTextSize(1);

    display.println(" cm");

    display.setCursor(0, 52);

    display.println(
      "Rango: 20 - 600 cm"
    );

  } else {

    display.setCursor(0, 16);

    display.println(
      "ESTADO SENSOR:"
    );

    display.setTextSize(1);

    display.setCursor(0, 32);

    if (diag == DIAG_SIN_RESPUESTA) {

      display.println(
        "Sin senal (Cable/5V)"
      );

    } else if (
      diag == DIAG_ECHO_BLOQUEADO
    ) {

      display.println(
        "Echo en corto/bloq."
      );

    } else if (
      diag == DIAG_FUERA_DE_RANGO
    ) {

      display.println(
        "Fuera de rango (>6m)"
      );

    } else if (
      diag == DIAG_ZONA_CIEGA
    ) {

      display.println(
        "! ZONA CIEGA (<20cm)"
      );

      display.setCursor(0, 44);

      display.println(
        "Lectura no valida"
      );

      distancia =
        DISTANCIA_MIN_CM;
    }
  }

  display.display();

  // ---------------------------------------------------------------
  // PREPARAR PAQUETE LoRa
  // ---------------------------------------------------------------
  if (
    diag == DIAG_ZONA_CIEGA &&
    (
      distancia <= 0 ||
      distancia < DISTANCIA_MIN_CM
    )
  ) {

    distancia =
      DISTANCIA_MIN_CM;
  }

// [CONSERVAR] Formato de cuatro campos separados por comas: ID,distancia,estado,contador.
// La distancia viaja en cm; el gateway interpreta ese orden. No agregar campos sin coordinar.
// La altura sensor-fondo y los avisos se configuran en el sistema receptor/página, no aquí.
  String paquete =
      NODE_ID
      + ","
      + String(distancia, 1)
      + ","
      + estadoTexto
      + ","
      + String(packetCounter);

  // ---------------------------------------------------------------
  // SERIAL
  // ---------------------------------------------------------------
  Serial.print(F("Tx -> "));

  Serial.println(paquete);

  // ---------------------------------------------------------------
  // TRANSMISIÓN LoRa
  // ---------------------------------------------------------------
  LoRa.beginPacket();

  LoRa.print(paquete);

  LoRa.endPacket();

  packetCounter++;

  // ---------------------------------------------------------------
  // INTERVALO + JITTER
  // ---------------------------------------------------------------
// [CONSERVAR] La pequeña pausa aleatoria evita que varias estaciones coincidan siempre.
// No elimina todas las colisiones ni garantiza recibir cada paquete.
  delay(
    INTERVALO_REFRESCO
    + random(0, 350)
  );
}