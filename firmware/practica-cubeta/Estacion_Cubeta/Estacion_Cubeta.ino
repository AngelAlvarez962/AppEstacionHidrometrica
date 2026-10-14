#include <SPI.h>
#include <LoRa.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ===================================================================
// 1. CONFIGURACIÓN DE LA ESTACIÓN (CAMBIA EL ID PARA CADA PLACA)
// ===================================================================
const String NODE_ID = "EST-613D1618021DBA1F"; // Serie técnica de EST-000001 en la aplicación nueva.
const char* ETIQUETA = "EST-000001";
const float SENSOR_A_FONDO_CM = 62.3f;
const float ALTURA_AGUA_CM = 16.0f;
const int   INTERVALO_REFRESCO = 1500;     // Envío cada 1.5 seg (+ jitter aleatorio)
const float DISTANCIA_MIN_CM   = 20.0;     // Zona ciega: no permite garantizar detección de desborde
const float DISTANCIA_MAX_CM   = 600.0;    // Límite máximo 6.0 metros (600 cm)

// Pines del Sensor Ultrasónico AJ-SR04M en modo TRIG/ECHO (no UART)
const int trigPin = 13;
const int echoPin = 23;

// Pines Placa Heltec LoRa 32 V2
#define VEXT_PIN 21
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_SDA 4
#define OLED_SCL 15
#define OLED_RST 16

// Objeto de pantalla OLED integrado
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RST);

#define LORA_SCK 5
#define LORA_MISO 19
#define LORA_MOSI 27
#define LORA_CS 18
#define LORA_RST 14
#define LORA_DIO0 26
#define BAND 915E6 // Frecuencia LoRa 915 MHz

unsigned long packetCounter = 0;

enum DiagnosticoSensor {
  DIAG_OK,
  DIAG_SIN_RESPUESTA,  // Cable suelto, desconectado o sin 5V/GND
  DIAG_ECHO_BLOQUEADO, // Cortocircuito o pin Echo pegado en HIGH
  DIAG_FUERA_DE_RANGO, // Más de 6.0 metros o sin rebote
  DIAG_ZONA_CIEGA      // Eco corto: lectura no utilizable
};

// Medición individual con timeout ajustado a 6 metros (~36000 microsegundos)
DiagnosticoSensor tomarMuestraIndividual(float &dist) {
  // 1. Echo alto antes del disparo: señal ocupada o bloqueada; no prueba un corto.
  if (digitalRead(echoPin) == HIGH) {
    return DIAG_ECHO_BLOQUEADO;
  }

  // 2. Pulso de disparo de 10 microsegundos en Trig
  digitalWrite(trigPin, LOW);
  delayMicroseconds(4);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(20);
  digitalWrite(trigPin, LOW);

  // 3. Medir duración del pulso de Echo (límite 36000 us = ~6.1 metros)
  unsigned long duracion = pulseIn(echoPin, HIGH, 36000);

  // Un timeout no permite distinguir cable desconectado de ausencia de eco.
  if (duracion == 0) {
    // Si Echo sigue en HIGH, el sensor sí respondió pero el eco superó los 6 metros
    if (digitalRead(echoPin) == HIGH) {
      unsigned long t0 = millis();
      while (digitalRead(echoPin) == HIGH && (millis() - t0 < 45)) {
        delayMicroseconds(100);
      }
      return DIAG_FUERA_DE_RANGO; // "SIN_ECO" (> 6.0 m)
    } else {
      // Si Echo está en LOW, el sensor no respondió (desconectado o sin 5V/GND)
      return DIAG_SIN_RESPUESTA;  // Se transmite SIN_ECO, sin afirmar una causa física.
    }
  }

  dist = (duracion * 0.0343) / 2.0;

  if (dist < DISTANCIA_MIN_CM) {
    dist = DISTANCIA_MIN_CM;
    return DIAG_ZONA_CIEGA; // "MUY_CERCA" (<= 20 cm / Zona Ciega / Desborde Inminente)
  }
  if (dist > DISTANCIA_MAX_CM) {
    return DIAG_FUERA_DE_RANGO; // "SIN_ECO" (> 6.0 m)
  }

  return DIAG_OK;
}

// Filtro rápido de 3 muestras
DiagnosticoSensor leerSensorFiltrado(float &distanciaFinal) {
  float validas[3];
  int conteoOk = 0;
  int conteoZonaCiega = 0;
  DiagnosticoSensor ultimoFallo = DIAG_SIN_RESPUESTA;

  for (int i = 0; i < 3; i++) {
    float d = 0.0;
    DiagnosticoSensor res = tomarMuestraIndividual(d);
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

  // Si hubo detección en zona ciega (<= 20 cm) y ninguna distancia > 20cm válida:
  // Eco demasiado corto: no inferir nivel ni causa física.
  if (conteoZonaCiega > 0 && conteoOk == 0) {
    distanciaFinal = DISTANCIA_MIN_CM;
    return DIAG_ZONA_CIEGA;
  }

  if (conteoOk > 0) {
    // Mediana: rechazar un eco aislado cuando hay tres muestras.
    for (int i = 0; i < conteoOk; i++)
      for (int j = i + 1; j < conteoOk; j++)
        if (validas[j] < validas[i]) { float aux = validas[i]; validas[i] = validas[j]; validas[j] = aux; }
    if (conteoOk < 2) { distanciaFinal = 0; return DIAG_SIN_RESPUESTA; }
    distanciaFinal = conteoOk == 3 ? validas[1] : (validas[0] + validas[1]) / 2.0;
    return DIAG_OK;
  }

  if (ultimoFallo == DIAG_ZONA_CIEGA) {
    distanciaFinal = DISTANCIA_MIN_CM;
  } else {
    distanciaFinal = 0.0;
  }
  return ultimoFallo;
}

void setup() {
  Serial.begin(115200);

  // PULLDOWN en Echo: Si desconectas los cables, el pin queda firmemente en 0V
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT_PULLDOWN);
  digitalWrite(trigPin, LOW);

  // Encender pantalla OLED integrada
  pinMode(VEXT_PIN, OUTPUT);
  digitalWrite(VEXT_PIN, LOW);
  delay(50);

  pinMode(OLED_RST, OUTPUT);
  digitalWrite(OLED_RST, LOW);
  delay(20);
  digitalWrite(OLED_RST, HIGH);

  Wire.begin(OLED_SDA, OLED_SCL);
  Wire.setClock(400000);
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  display.clearDisplay();
  display.setTextColor(WHITE);
  display.setTextSize(1);
  display.setCursor(0, 10);
  display.println("INICIANDO NODO...");
  display.println(ETIQUETA);
  display.display();

  // Iniciar módulo LoRa
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
  LoRa.setPins(LORA_CS, LORA_RST, LORA_DIO0);

  if (!LoRa.begin(BAND)) {
    Serial.println(F("Error al iniciar LoRa en Transmisor"));
    display.clearDisplay();
    display.setCursor(0, 20);
    display.println("Falla LoRa!");
    display.display();
    while (1);
  }

  LoRa.setSpreadingFactor(7);
  LoRa.setSignalBandwidth(125E3);
  LoRa.setCodingRate4(5);
  LoRa.setSyncWord(0x12);
  LoRa.enableCrc();
  LoRa.setTxPower(17);
  delay(500);
}

void loop() {
  float distancia = 0.0;
  DiagnosticoSensor diag = leerSensorFiltrado(distancia);
  String estadoTexto = "";

  // 1. Determinar estado
  switch (diag) {
    case DIAG_OK:             estadoTexto = "OK"; break;
    case DIAG_SIN_RESPUESTA:  estadoTexto = "SIN_ECO"; break;
    case DIAG_ECHO_BLOQUEADO: estadoTexto = "ERR_CORTO"; break;
    case DIAG_FUERA_DE_RANGO: estadoTexto = "FUERA_RANGO"; break;
    case DIAG_ZONA_CIEGA:     estadoTexto = "MUY_CERCA"; break;
  }

  // 2. Mostrar en la pantalla OLED del Transmisor
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print(ETIQUETA);
  display.print(" | #");
  display.println(packetCounter);
  display.drawLine(0, 10, 127, 10, WHITE);

  if (diag == DIAG_OK) {
    float nivel = max(0.0f, SENSOR_A_FONDO_CM - distancia);
    float porcentaje = min(100.0f, nivel / ALTURA_AGUA_CM * 100.0f);
    display.setCursor(0, 16);
    display.setTextSize(2);
    display.print(nivel, 1); display.println(" cm");
    display.setTextSize(1);
    display.setCursor(0, 40);
    display.print(porcentaje, 0); display.println("% altura de agua");
    display.setCursor(0, 54);
    display.print("Dist: "); display.print(distancia, 1); display.println(" cm");
  } else {
    display.setCursor(0, 16);
    display.println("ESTADO SENSOR:");
    display.setTextSize(1);
    display.setCursor(0, 32);
    if (diag == DIAG_SIN_RESPUESTA)       display.println("Sin eco / sin respuesta");
    else if (diag == DIAG_ECHO_BLOQUEADO) display.println("Echo bloqueado");
    else if (diag == DIAG_FUERA_DE_RANGO) display.println("Fuera de rango (>6m)");
    else if (diag == DIAG_ZONA_CIEGA) {
      display.println("! ZONA CIEGA (<20cm)");
      display.setCursor(0, 44);
      display.println("Lectura no valida");
      distancia = DISTANCIA_MIN_CM;
    }
  }
  display.display();

  // 3. Enviar por LoRa: "NODE_ID,DISTANCIA,ESTADO,NUM_PAQUETE"
  if (diag == DIAG_ZONA_CIEGA && (distancia <= 0 || distancia < DISTANCIA_MIN_CM)) {
    distancia = DISTANCIA_MIN_CM;
  }
  String paquete = NODE_ID + "," + String(distancia, 1) + "," + estadoTexto + "," + String(packetCounter);

  Serial.print(F("Tx -> "));
  Serial.println(paquete);

  LoRa.beginPacket();
  LoRa.print(paquete);
  LoRa.endPacket();

  packetCounter++;

  // Pausa con jitter aleatorio para evitar colisiones entre estaciones
  delay(INTERVALO_REFRESCO + random(0, 350));
}
