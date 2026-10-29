# Contrato inicial · API de monitoreo de kits

## Permisos y entidades (ampliación)

El administrador autenticado ve todos los kits, gateways, estaciones y lecturas; el comprador ve solo sus equipos. `profiles` proporciona el nombre del propietario en la vista administrativa. Los roles proceden de `kit_admins`, no de los metadatos de registro.

GET /api/kits también devuelve `personalEntities` y `archivedStations`. Solo para administradores devuelve `adminEntities` y `adminAssignments`; estas dos claves se retiran de la respuesta de compradores. La base de datos también impide que un comprador consulte las entidades internas por REST directamente.

POST /api/kits con `{action:"entity-create",scope:"personal",name:"Mi casa"}` crea una entidad del usuario verificado. Para administración usa scope `admin` y exige ese rol. PATCH con action `entity-rename`, scope, id y name cambia su nombre. DELETE con action `entity-delete`, scope e id la elimina conservando las estaciones.

PATCH /api/kits con action `station` admite `personal_entity_id` (UUID o null). La entidad debe pertenecer al propietario de la estación, incluso cuando el administrador modifica esa estación.

POST /api/kits con `{action:"admin-classify",station_id:"UUID",entity_id:"UUID-O-NULL"}` organiza internamente una estación. El valor null se envía como JSON null, no como texto. La actualización es atómica y solo para administradores; no modifica la entidad personal del comprador.

DELETE /api/kits con `{action:"delete-station",id:"UUID"}` retira la estación mediante deleted_at; no elimina sus datos físicamente. POST con action `restore-station` e id la restaura. Ambas acciones usan el JWT y los permisos del actor. La ingesta rechaza estaciones retiradas.

La web y una futura APK comparten estas rutas. Las respuestas son JSON; los errores usan `{ "error": "mensaje" }`. Los secretos de Supabase se usan únicamente en el backend.

## Acceso

Registro, login, confirmación y recuperación usan **Supabase Auth**. La APK puede utilizar el SDK oficial de Supabase para su plataforma. Las rutas de usuario esperan:

```text
Authorization: Bearer ACCESS_TOKEN_DEL_USUARIO
```

La API consulta `/auth/v1/user` para verificar la identidad; no confía en un `owner_id` enviado por el cliente. Requiere correo confirmado. Una credencial de gateway no es una sesión de comprador.

## GET /api/config

Devuelve `configured`, URL y clave pública. Nunca devuelve la clave privada. No es una verificación de salud de la base de datos.

## GET /api/kits

Devuelve `admin`, `kits`, `gateways`, `stations` y `readings` pertenecientes al usuario. Las lecturas incluyen las últimas 120 por estación ordenadas por recepción. El servidor agrega `inventory` de los últimos 100 kits únicamente a administradores.

Las estaciones tienen UUID `id`, UUID `kit_id`, UUID `gateway_id` (puede ser null durante configuración), `friendly_code`, `setup_pending`, `serial` global, `node_label`, nombre, ubicación y cuatro medidas. Los cuatro valores de calibración son inicialmente `null`; se guardan juntos.

## POST /api/kits · Registro propio (actual)

`{action:"register-owned",request_id:"UUID-NUEVO",kind:"complete",name:"Mi estación",node_label:"RIO_01",gateway_id:null}`

Requiere correo confirmado. kind: complete, station o gateway. El propietario se toma de auth.uid(), nunca del cuerpo. En station, gateway_id puede ser un receptor de la misma cuenta; null deja la configuración pendiente. node_label debe coincidir con el LoRa y admite 1–32 letras, cifras, guion o guion bajo.

Devuelve 201 con kit_id, station_id y gateway_id (null cuando no corresponde). Se conserva el mismo request_id al reintentar para evitar duplicados. La transacción bloquea por cuenta, limita a 20 altas/hora y rechaza una estación activa con igual identificador en ese gateway. No entrega claves de dispositivo. La preparación física por USB sigue usando prueba/confirmación del receptor y credenciales limitadas.

La migración 008 está aplicada. La pantalla de preparación administrativa se retiró; las rutas create/claim se conservan para compatibilidad con equipos/códigos anteriores. No reejecutar migraciones aplicadas.

## POST /api/kits · Reclamar kit

```json
{"action":"claim","code":"KIT-32_CARACTERES_HEXADECIMALES"}
```

Código real: `KIT-` seguido de 32 caracteres hexadecimales. Se normaliza a mayúsculas. La API calcula SHA-256 y reclama el kit mediante una transacción con bloqueo. La activación asigna todo el kit y solo se puede hacer una vez. Máximo 10 intentos por cuenta y ventana de una hora; se persiste en la base de datos, no en la memoria del servidor.

Devuelve `kit_id`; no permite seleccionar el nuevo propietario. Un código inválido o consumido produce 409; límite de intentos, 429.

## PATCH /api/kits · Configurar estación

```json
{"action":"station","id":"UUID-DE-LA-ESTACION","gateway_id":"UUID-DEL-GATEWAY","name":"Cubeta de prueba","location":"Laboratorio","bed_height":65,"capacity_height":16,"yellow_alert":12,"red_alert":15}
```

Las medidas están en cm. Sensor a fondo > 20 y ≤ 600; 0 < fondo a tope ≤ sensor a fondo; 0 ≤ amarilla < roja ≤ fondo a tope. Permite elegir un gateway de la misma cuenta; no permite cambiar propietario, serie o identidad. Se ejecuta con el JWT del comprador y RLS; si no pertenece a esa cuenta devuelve 404.

El nivel se calcula a partir de la distancia bruta; el porcentaje divide entre fondo a tope. El valor en cm puede superar la capacidad; la barra se limita al 100%. No se calcula nivel para un error de sensor, una lectura en zona ciega o una estación sin calibrar. El CSV usa la calibración actual; no representa volumen en litros.

## PATCH /api/kits · Renombrar gateway

```json
{"action":"gateway","id":"UUID-DEL-GATEWAY","name":"Gateway del laboratorio"}
```

No cambia la red Wi-Fi ni envía comandos al equipo.

## POST /api/kits · Preparar kit (administrador)

```json
{"action":"create","kind":"complete"}
```

Presentaciones: `complete` (una estación y un gateway), `station` (una estación) y `gateway` (un gateway). Se verifica `kit_admins` y el SQL vuelve a comprobarlo. La respuesta entrega identificadores amigables, series técnicas y código de activación; la credencial del gateway solo aparece si la presentación lo incluye. Cada compra puede compartir un receptor de la misma cuenta.

Guarda la respuesta en un archivo privado para preparar el equipo. Los códigos/tokens originales no se guardan en la base de datos y no tienen una ruta de recuperación. Nunca publiques estas fichas JSON.

## POST /api/device · Telemetría (gateway)

```text
Content-Type: application/json
Authorization: Bearer GW_TOKEN_HEXADECIMAL_DE_64_CARACTERES
```

```json
{"station_serial":"EST-16_CARACTERES_HEXADECIMALES","distance_cm":57,"sensor_status":"OK","packet":18,"rssi":-77}
```

La serie real tiene `EST-` seguido de 16 caracteres hexadecimales en mayúsculas. El token real comienza `GW_` y continúa con 64 caracteres hexadecimales en minúsculas. Usa exclusivamente los valores generados en la ficha.

El servidor autentica el gateway por el hash de su token, rechaza credenciales revocadas y comprueba que esa estación esté vinculada al mismo gateway. No acepta un propietario suministrado en la medición. Devuelve 201 y `received:true` con el ID de la lectura.

`sensor_status`: OK, ERR_CABLE, ERR_CORTO, SIN_ECO, MUY_CERCA, FUERA_RANGO o ERR_DESBORDE. Distancia numérica finita entre 0 y 10000; packet entero seguro no negativo; RSSI entero de -200 a 0. Los estados inválidos no se insertan. Una distancia OK fuera de 20–600 cm se conserva como dato bruto pero no produce un nivel válido en el panel.

La hora `received_at` la genera el servidor. Este contrato inicial no incluye hora propia del sensor, autenticación criptográfica del enlace LoRa, caché sin conexión ni deduplicación de reintentos. Se deben completar y probar esas partes del firmware antes de vender los kits. La consulta web es por intervalos; no hay WebSocket ni notificación push en esta fase.


## Cambios de la versión 0.2

Preparación: `POST /api/kits` con `action: "create"` y `kind: "complete" | "station" | "gateway"`, solo administrador. Retira `station_count`. Devuelve identificadores cortos y datos técnicos; solo devuelve `gateway_token` si existe gateway. La ficha es privada.

Configuración: `PATCH /api/kits`, `action: "station"`, ahora requiere `gateway_id` junto con nombre y las cuatro medidas. La base exige que el gateway sea del mismo propietario. La estación conserva su kit aunque use el gateway de otra compra. `setup_pending` es un valor calculado por la base; el cliente no puede falsearlo. Una estación pendiente o eliminada no acepta ingesta.

Correo: `PATCH /api/kits`, `action: "email-preference"`, `enabled: true/false`. Se modifica solo el perfil del usuario verificado. No acepta un destinatario elegido por el cliente. Los envíos necesitan proveedor y servidor activo; no están configurados todavía.


## Conexión de gateway (0.3.0)

Todas las acciones de cuenta conservan el JWT y correo confirmado. `POST remember-gateway` acepta `id`, `expected` (UUID anterior o null), `confirm` y `station_ids`. `kit_connect_gateway` comprueba propiedad y estado previo, bloquea el perfil y las estaciones seleccionadas y guarda el cambio como una transacción. Una selección ajena, un cambio concurrente o la ausencia de confirmación no modifica nada.

`POST usb-lease` con `id` permite al lector de la UI tomar temporalmente el puerto del lector personal de Windows; caduca a los 45 segundos y se renueva mientras está conectado. No abre puertos mediante nombres recibidos del navegador. `POST usb-reading` comprueba gateway propio y serie/alias/estado válidos antes de ingerir. No devuelve hashes ni credenciales del servidor.

`POST gateway-prepare` con `id` y pista `hardware` comprueba propiedad y hasta ocho estaciones configuradas con alias distintos. Genera una credencial nueva de 256 bits y una confirmación aleatoria. Devuelve la configuración sólo a esa sesión; guarda únicamente hashes y una caducidad de diez minutos. La contraseña del Wi-Fi no pasa por esta API: va al gateway por USB.

`POST gateway-finish` con `id`, `ticket` y `proof` comprueba la confirmación del dispositivo y activa la credencial pendiente. No se invalida la anterior si el guardado no se confirma. `PATCH guide` con `completed` guarda el avance en el perfil propio.

`PATCH station` ahora exige `expected_gateway` igual al gateway actual y `confirm_gateway: true` si se cambia un receptor existente. La escritura incluye una comparación del valor anterior para rechazar cambios concurrentes.

Ingesta directa del equipo: `POST https://<proyecto>.supabase.co/rest/v1/rpc/kit_receive`, con `apikey` pública y cuerpo `p_token`, `p_station_serial`, `p_distance`, `p_status`, `p_packet`, `p_rssi`. La credencial de gateway aleatoria se verifica por SHA256; no es una sesión de usuario. La función sólo escribe estaciones vinculadas activas y configuradas. Los reintentos o duplicados simultáneos USB/Wi-Fi de la misma muestra en 30 s no crean otra fila. `internet_last_seen` se actualiza sólo por esta vía directa; la UI requiere una recepción posterior a `internet_configured_at` para indicar Internet comprobado.

## Eliminar receptor sin estaciones

DELETE /api/kits con action delete-gateway e id llama kit_delete_gateway con JWT del usuario. La migración 009 admite al propietario o a un administrador existente. Rechaza receptores con cualquier estación vinculada (incluidas retiradas), revoca acceso al eliminar las claves asociadas y limpia preferencia y preparación pendiente. No elimina estaciones ni lecturas.
