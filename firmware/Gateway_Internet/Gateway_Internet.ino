#include <SPI.h>
#include <LoRa.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFi.h>
#include <NetworkClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <mbedtls/sha256.h>
#include <time.h>
#include "certificates.h"

// Heltec WiFi LoRa 32 V2: mismas conexiones y radio que el gateway USB.
// La app guarda por USB la red y una credencial limitada a este gateway.
// No colocar aquí contraseñas de cuentas ni claves privadas de Supabase.
static const char PROJECT_URL[] = "https://njwxrnhfxjbtsxemrmol.supabase.co";
Adafruit_SSD1306 display(128,64,&Wire,16);
Preferences preferences;
SemaphoreHandle_t cfgMutex,serialMutex;
QueueHandle_t readings;
String storedConfig,command,hardware;
bool pantalla=false,discardCommand=false;
volatile uint32_t revision=0,lastCloud=0;
struct Sample { char node[33]; float distance; char status[16]; uint32_t packet; int rssi; uint32_t received; };
Sample latestSample{};
bool hasSample=false;

void emit(JsonDocument& doc){xSemaphoreTake(serialMutex,portMAX_DELAY);Serial.print("HI:");serializeJson(doc,Serial);Serial.println();xSemaphoreGive(serialMutex);}
String configCopy(){xSemaphoreTake(cfgMutex,portMAX_DELAY);String copy=storedConfig;xSemaphoreGive(cfgMutex);return copy;}
void hello(){JsonDocument doc;doc["type"]="hello";doc["protocol"]=1;doc["hardware"]=hardware;doc["configured"]=configCopy().length()>0;doc["internet_ok"]=lastCloud&&millis()-lastCloud<15000;emit(doc);}
String sha256(const String& input){unsigned char bytes[32];mbedtls_sha256((const unsigned char*)input.c_str(),input.length(),bytes,0);char hex[65];for(int i=0;i<32;i++)sprintf(hex+i*2,"%02x",bytes[i]);hex[64]=0;return String(hex);}
bool identifier(const String& s){if(s.length()<1||s.length()>32)return false;for(char c:s)if(!isalnum((unsigned char)c)&&c!='_'&&c!='-')return false;return true;}
bool hexText(const String& s,int size){if(s.length()!=size)return false;for(char c:s)if(!isxdigit((unsigned char)c))return false;return true;}
void commandLine(){
 JsonDocument doc;if(deserializeJson(doc,command))return;
 if(doc["cmd"]=="hello"){hello();return;}
 if(doc["cmd"]!="configure")return;
 String token=doc["token"]|"",ssid=doc["ssid"]|"",password=doc["password"]|"",nonce=doc["nonce"]|"",url=doc["url"]|"",key=doc["key"]|"";
 if(url!=PROJECT_URL||ssid.length()<1||ssid.length()>32||password.length()<8||password.length()>63||token.length()!=67||!token.startsWith("GW_")||!hexText(token.substring(3),64)||!hexText(nonce,32)||key.length()<20||key.length()>2048)return;
 JsonArray mapping=doc["mapping"].as<JsonArray>();if(mapping.size()<1||mapping.size()>8)return;
 for(JsonObject item:mapping){String node=item["node"]|"",serial=item["serial"]|"";if(!identifier(node)||!serial.startsWith("EST-")||!hexText(serial.substring(4),16))return;}
 // A single NVS value commits the complete configuration. Never echo it on Serial.
 doc.remove("cmd");doc.remove("nonce");doc.remove("ticket");String saved;serializeJson(doc,saved);
 if(preferences.putString("config",saved)!=saved.length())return;
 xSemaphoreTake(cfgMutex,portMAX_DELAY);storedConfig=saved;revision++;xSemaphoreGive(cfgMutex);
 JsonDocument reply;reply["type"]="saved";reply["proof"]=sha256(token+":"+nonce);emit(reply);hello();
}

void internetTask(void*){
 JsonDocument cfg;uint32_t loaded=UINT32_MAX,attempt=0;bool wifiStarted=false;
 for(;;){
  if(loaded!=revision){String raw=configCopy();cfg.clear();deserializeJson(cfg,raw);loaded=revision;WiFi.disconnect(false,false);wifiStarted=false;}
  if(!cfg["ssid"].is<const char*>()){vTaskDelay(pdMS_TO_TICKS(200));continue;}
  if(!wifiStarted||WiFi.status()!=WL_CONNECTED&&millis()-attempt>30000){WiFi.mode(WIFI_STA);WiFi.setAutoReconnect(true);WiFi.begin(cfg["ssid"].as<const char*>(),cfg["password"].as<const char*>());wifiStarted=true;attempt=millis();configTime(0,0,"time.cloudflare.com","pool.ntp.org");}
  Sample sample;if(xQueueReceive(readings,&sample,pdMS_TO_TICKS(100))!=pdTRUE)continue;
  // No replay of stale data after an outage. Radio reception never waits for HTTPS.
  if(WiFi.status()!=WL_CONNECTED||time(nullptr)<1700000000||millis()-sample.received>15000)continue;
  String serial;for(JsonObject item:cfg["mapping"].as<JsonArray>())if(String(item["node"].as<const char*>())==sample.node){serial=item["serial"].as<String>();break;}
  if(!serial.length())continue;
  NetworkClientSecure client;client.setCACert(ROOT_CA);client.setHandshakeTimeout(5);
  HTTPClient http;http.setConnectTimeout(4000);http.setTimeout(5000);
  if(!http.begin(client,String(PROJECT_URL)+"/rest/v1/rpc/kit_receive"))continue;
  http.addHeader("apikey",cfg["key"].as<String>());http.addHeader("Content-Type","application/json");
  JsonDocument body;body["p_token"]=cfg["token"];body["p_station_serial"]=serial;body["p_distance"]=sample.distance;body["p_status"]=sample.status;body["p_packet"]=sample.packet;body["p_rssi"]=sample.rssi;
  String json;serializeJson(body,json);int result=http.POST(json);http.end();
  if(result>=200&&result<300)lastCloud=millis();
 }
}
bool parseSample(char* data,Sample& sample){
 char* first=strchr(data,',');if(!first)return false;*first++=0;char* second=strchr(first,',');if(!second)return false;*second++=0;char* third=strchr(second,',');if(!third)return false;*third++=0;if(strchr(third,','))return false;
 if(!identifier(data)||strlen(second)>15)return false;
 const char* states[]={"OK","ERR_CABLE","ERR_CORTO","SIN_ECO","MUY_CERCA","FUERA_RANGO","ERR_DESBORDE"};bool status=false;for(auto s:states)if(!strcmp(second,s))status=true;if(!status)return false;
 char* end;float distance=strtof(first,&end);if(*end||!isfinite(distance)||distance<0||distance>10000)return false;
 for(char* c=third;*c;c++)if(!isdigit((unsigned char)*c))return false;if(!*third||strlen(third)>10)return false;
 unsigned long long packet=strtoull(third,&end,10);if(*end||packet>UINT32_MAX)return false;
 strlcpy(sample.node,data,sizeof(sample.node));strlcpy(sample.status,second,sizeof(sample.status));sample.distance=distance;sample.packet=(uint32_t)packet;return true;
}
void setup(){
 Serial.begin(115200);cfgMutex=xSemaphoreCreateMutex();serialMutex=xSemaphoreCreateMutex();readings=xQueueCreate(8,sizeof(Sample));
 uint64_t id=ESP.getEfuseMac();char identity[25];snprintf(identity,sizeof(identity),"ESP32-%012llX",(unsigned long long)(id&0xFFFFFFFFFFFF));hardware=identity;
 preferences.begin("hi-gateway",false);storedConfig=preferences.getString("config","");
 pinMode(21,OUTPUT);digitalWrite(21,LOW);delay(50);pinMode(16,OUTPUT);digitalWrite(16,LOW);delay(20);digitalWrite(16,HIGH);Wire.begin(4,15);pantalla=display.begin(SSD1306_SWITCHCAPVCC,0x3C);
 SPI.begin(5,19,27,18);LoRa.setPins(18,14,26);
 if(!LoRa.begin(915E6)){Serial.println("// Falla LoRa. Revisar modulo.");while(true)delay(1000);}
 LoRa.setSpreadingFactor(7);LoRa.setSignalBandwidth(125E3);LoRa.setCodingRate4(5);LoRa.setSyncWord(0x12);LoRa.enableCrc();
 xTaskCreatePinnedToCore(internetTask,"internet",16384,nullptr,1,nullptr,0);hello();
}
void loop(){
 for(int n=0;Serial.available()&&n<256;n++){char c=Serial.read();if(c=='\n'){if(!discardCommand&&command.length())commandLine();command="";discardCommand=false;}else if(c!='\r'){if(command.length()<4096&&!discardCommand)command+=c;else{command="";discardCommand=true;}}}
 int size=LoRa.parsePacket();if(size){char data[129];size_t n=0;bool valid=size<=128;while(LoRa.available()){int c=LoRa.read();if(c<32||c>126||n>=sizeof(data)-1)valid=false;else data[n++]=(char)c;}data[n]=0;
  Sample sample{};sample.rssi=LoRa.packetRssi();sample.received=millis();
  if(valid){xSemaphoreTake(serialMutex,portMAX_DELAY);Serial.print("RX: ");Serial.print(data);Serial.print(" | RSSI: ");Serial.print(sample.rssi);Serial.println(" dBm");xSemaphoreGive(serialMutex);
   if(parseSample(data,sample)){latestSample=sample;hasSample=true;if(xQueueSend(readings,&sample,0)!=pdTRUE){Sample discard;xQueueReceive(readings,&discard,0);xQueueSend(readings,&sample,0);}}
  }
 }
 static uint32_t lastHello=0,lastDisplay=0;if(millis()-lastHello>5000){lastHello=millis();hello();}
 if(pantalla&&millis()-lastDisplay>500){
  lastDisplay=millis();display.clearDisplay();display.setTextSize(1);display.setTextColor(WHITE);display.setCursor(0,0);display.println("GATEWAY TACOTALPA");
  if(hasSample&&millis()-latestSample.received<15000){
   display.setCursor(0,12);display.print(String(latestSample.node).substring(0,13));display.print(" DIST.");
   display.setTextSize(2);display.setCursor(0,24);display.print(latestSample.distance,1);display.print(" cm");
   display.setTextSize(1);display.setCursor(0,44);display.print(latestSample.status);display.print(" RSSI ");display.print(latestSample.rssi);
  }else{
   display.setCursor(0,16);display.println("Sin radio reciente");display.println("Esperando estacion");
  }
  display.setTextSize(1);display.setCursor(0,56);display.print(WiFi.status()==WL_CONNECTED?"WiFi OK ":"Sin WiFi ");display.print(lastCloud&&millis()-lastCloud<90000?"Nube OK":"Nube ...");display.display();
 }
 delay(2);
}
