#include <SPI.h>
#include <LoRa.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// Heltec WiFi LoRa 32 V2. No network credentials are stored in this gateway.
#define VEXT_PIN 21
#define OLED_SDA 4
#define OLED_SCL 15
#define OLED_RST 16
#define LORA_SCK 5
#define LORA_MISO 19
#define LORA_MOSI 27
#define LORA_CS 18
#define LORA_RST 14
#define LORA_DIO0 26
Adafruit_SSD1306 display(128, 64, &Wire, OLED_RST);
bool pantalla = false;
unsigned long ultimaLectura = 0;
bool tieneLectura = false;

void aviso(const char* texto) {
  if (!pantalla) return;
  display.clearDisplay(); display.setTextSize(1); display.setTextColor(WHITE);
  display.setCursor(0, 0); display.println("GW-000001 | USB");
  display.setCursor(0, 20); display.println(texto); display.display();
}

void setup() {
  Serial.begin(115200);
  pinMode(VEXT_PIN, OUTPUT); digitalWrite(VEXT_PIN, LOW); delay(50);
  pinMode(OLED_RST, OUTPUT); digitalWrite(OLED_RST, LOW); delay(20); digitalWrite(OLED_RST, HIGH);
  Wire.begin(OLED_SDA, OLED_SCL); Wire.setClock(400000);
  pantalla = display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  aviso("Iniciando LoRa...");
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
  LoRa.setPins(LORA_CS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(915E6)) {
    Serial.println("// Error al iniciar LoRa"); aviso("Falla radio LoRa"); while (true) delay(1000);
  }
  LoRa.setSpreadingFactor(7); LoRa.setSignalBandwidth(125E3);
  LoRa.setCodingRate4(5); LoRa.setSyncWord(0x12); LoRa.enableCrc();
  Serial.println("// GATEWAY_USB_V1 | GW-000001 | 115200 | 915 MHz");
  Serial.println("// Recibe radio y entrega datos por USB; la laptop gestiona la conexion.");
  aviso("Esperando estacion");
}

void loop() {
  int packetSize = LoRa.parsePacket();
  if (!packetSize) {
    if (tieneLectura && millis() - ultimaLectura > 10000) {
      tieneLectura = false; aviso("Sin radio reciente");
    }
    delay(2); return;
  }
  char data[129]; size_t n = 0; bool valido = packetSize <= 128;
  while (LoRa.available()) {
    int c = LoRa.read();
    if (c < 32 || c > 126 || n >= sizeof(data) - 1) valido = false;
    else data[n++] = (char)c;
  }
  data[n] = '\0';
  if (!valido || n == 0) { Serial.println("// Trama LoRa descartada"); return; }
  int rssi = LoRa.packetRssi();
  // One newline per packet. No HTTP requests block reception of radio packets.
  Serial.print("RX: "); Serial.print(data); Serial.print(" | RSSI: "); Serial.print(rssi); Serial.println(" dBm");
  ultimaLectura = millis(); tieneLectura = true;
  if (!pantalla) return;
  display.clearDisplay(); display.setTextSize(1); display.setTextColor(WHITE);
  display.setCursor(0, 0); display.println("GW-000001 | USB");
  display.setCursor(0, 16); display.println(data);
  display.setCursor(0, 52); display.print("RSSI "); display.print(rssi); display.print(" dBm"); display.display();
}
