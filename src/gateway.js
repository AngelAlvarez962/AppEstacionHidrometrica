// Wire formats are deliberately small; never treat a USB name as account authorization.
export function parseGatewayLine(line){
 if(typeof line!=='string'||line.length>4096)return null;
 if(line.startsWith('HI:')){try{const value=JSON.parse(line.slice(3));if(value.type==='hello'&&value.protocol===1&&/^ESP32-[A-F0-9]{12}$/.test(value.hardware))return value;if(value.type==='saved'&&/^[a-f0-9]{64}$/.test(value.proof))return value;return null}catch{return null}}
 const match=/^RX: ([-A-Za-z0-9_]{1,32}),(\d+(?:\.\d+)?),(OK|ERR_CABLE|ERR_CORTO|SIN_ECO|MUY_CERCA|FUERA_RANGO|ERR_DESBORDE),(\d+) \| RSSI: (-?\d+) dBm$/.exec(line.trim());
 if(!match)return null;
 const distance=Number(match[2]),packet=Number(match[4]),rssi=Number(match[5]);
 return distance<=10000&&Number.isSafeInteger(packet)&&rssi>=-200&&rssi<=0?{type:'reading',node:match[1],distance_cm:distance,sensor_status:match[3],packet,rssi}:null;
}
export function gatewayChange(previous,next){return Boolean(previous&&previous!==next)}
export function internetConfirmed(gateway,now=Date.now()){
 const last=Date.parse(gateway.internet_last_seen),configured=Date.parse(gateway.internet_configured_at)||0;
 return Number.isFinite(last)&&last>=configured&&now-last>=-5000&&now-last<90000;
}

export class GatewaySerial {
 constructor({serial=navigator.serial,onLine=()=>{},onClose=()=>{}}={}){this.serial=serial;this.onLine=onLine;this.onClose=onClose;this.port=null;this.reader=null;this.done=null;this.pending='';}
 async choose(){if(!this.serial)throw Error('Abre esta app de PC o usa Chrome/Edge para conectar por USB.');this.port=await this.serial.requestPort({filters:[{usbVendorId:0x10c4},{usbVendorId:0x1a86},{usbVendorId:0x303a}]});}
 async connect(){if(!this.port)await this.choose();try{await this.port.open({baudRate:115200});await this.port.setSignals({dataTerminalReady:false,requestToSend:false});this.done=this.read();await this.send({cmd:'hello'});}catch(error){await this.close();throw error}}
 async send(data){if(!this.port?.writable)throw Error('El USB se desconectó.');const writer=this.port.writable.getWriter();try{await writer.write(new TextEncoder().encode(JSON.stringify(data)+'\n'))}finally{writer.releaseLock()}}
 async read(){const decoder=new TextDecoder();try{while(this.port?.readable){this.reader=this.port.readable.getReader();try{while(true){const {value,done}=await this.reader.read();if(done)break;this.pending+=decoder.decode(value,{stream:true});let pos;while((pos=this.pending.indexOf('\n'))>=0){const line=this.pending.slice(0,pos);this.pending=this.pending.slice(pos+1);const parsed=parseGatewayLine(line);if(parsed)this.onLine(parsed)}if(this.pending.length>8192)this.pending='';}}finally{this.reader.releaseLock();this.reader=null}break}}catch{/* Disconnects are reported without exposing device/configuration strings. */}finally{this.onClose()}}
 async close(){await this.reader?.cancel().catch(()=>{});await this.done?.catch(()=>{});if(this.port){await this.port.close().catch(()=>{});this.port=null;}this.pending=''}
}
