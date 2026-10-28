// Local examples only: no account, device or measurement is created in the cloud.
const ids={ana:'00000000-0000-4000-8000-000000000011',bruno:'00000000-0000-4000-8000-000000000012',admin:'00000000-0000-4000-8000-000000000013'};
const names={ana:'Ana · Cuenta de ejemplo',bruno:'Bruno · Cuenta de ejemplo',admin:'Administrador · Demo'};
const uid=()=>crypto.randomUUID();
const hex=bytes=>Array.from(crypto.getRandomValues(new Uint8Array(bytes)),n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();
export class DemoStore {
 constructor(){
  this.kits=[];this.gateways=[];this.stations=[];this.codes=new Map();this.examples=new Map();this.account='ana';this.personalEntities=[];this.adminEntities=[];this.adminAssignments=[];
  const casa={id:uid(),owner_id:ids.ana,name:'Mi casa'},mama={id:uid(),owner_id:ids.ana,name:'Casa de mamá'},bruno={id:uid(),owner_id:ids.bruno,name:'Mi casa'};this.personalEntities.push(casa,mama,bruno);
  const a=this.addKit(3,'DEMO-A01');this.assign(a.activation_code,'ana');
  const examples=[['Cubeta de demostración','Casa · Patio',65,16,12,15,8,casa.id],['Entrada de mi casa','Casa · Acceso',90,30,22,28,24,casa.id],['Casa de mamá','Patio de mamá',100,40,30,38,12,mama.id]];
  a.stations.forEach((station,i)=>{const [name,location,bed_height,capacity_height,yellow_alert,red_alert,level,personal_entity_id]=examples[i];Object.assign(station,{name,location,bed_height,capacity_height,yellow_alert,red_alert,personal_entity_id});this.examples.set(station.id,{bed:bed_height,level})});
  const b=this.addKit(1,'DEMO-B01');this.assign(b.activation_code,'bruno');const other=b.stations[0];Object.assign(other,{name:'Estación de Bruno',location:'Otra instalación de ejemplo',bed_height:100,capacity_height:40,yellow_alert:30,red_alert:38,personal_entity_id:bruno.id});this.examples.set(other.id,{bed:100,level:18});
  const internal={id:uid(),name:'Pruebas de campo',created_by:ids.admin};this.adminEntities.push(internal);this.adminAssignments.push({entity_id:internal.id,station_id:a.stations[0].id});
  this.pending=this.addKit(1,'DEMO-NUEVO');for(const [code,kid] of this.codes)if(kid===this.pending.kit_id)this.codes.delete(code);this.pending.activation_code='KIT-'+ 'A'.repeat(32);this.codes.set(this.pending.activation_code,this.pending.kit_id);
 }
 get user(){return {id:ids[this.account],email:this.account+'@ejemplo.invalid',user_metadata:{display_name:names[this.account]}}}
 addKit(count,serial){
  const kind=typeof count==='string'?count:'complete',amount=typeof count==='number'?count:kind==='gateway'?0:1;
  if(!['complete','station','gateway'].includes(kind))throw Error('Presentación inválida.');
  const code=(prefix,n)=>prefix+'-'+String(n+1).padStart(6,'0');
  const kit={id:uid(),kind,friendly_code:code('KIT',this.kits.length),serial:serial||'DEMO-'+hex(4),owner_id:null,created_at:new Date().toISOString(),claimed_at:null};const gateway=kind==='station'?null:{id:uid(),kit_id:kit.id,friendly_code:code('GW',this.gateways.length),serial:'GW-DEMO-'+hex(4),name:'Mi gateway',last_seen:null};
  const stations=Array.from({length:amount},(_,i)=>({id:uid(),kit_id:kit.id,gateway_id:gateway?.id||null,friendly_code:code('EST',this.stations.length+i),serial:'EST-DEMO-'+hex(4),node_label:'RIO_'+String(i+1).padStart(2,'0'),name:'Estación '+(i+1),location:'',bed_height:null,capacity_height:null,yellow_alert:null,red_alert:null,personal_entity_id:null,deleted_at:null}));
  this.kits.push(kit);if(gateway)this.gateways.push(gateway);this.stations.push(...stations);const activation_code='KIT-'+hex(16);this.codes.set(activation_code,kit.id);
  return {kit_id:kit.id,kind,friendly_code:kit.friendly_code,serial:kit.serial,gateway,activation_code,...(gateway?{gateway_serial:gateway.serial,gateway_token:'CREDENCIAL-DE-EJEMPLO-NO-FUNCIONA'}:{}),stations};
 }
 assign(code,account=this.account){const kid=this.codes.get(code),kit=this.kits.find(k=>k.id===kid);if(!kit||kit.owner_id)throw Error('Código inválido o ya utilizado.');kit.owner_id=ids[account];kit.claimed_at=new Date().toISOString();this.codes.delete(code);return {kit_id:kid}}
 registerOwned(payload){if(payload.gateway_id&&!this.gateways.some(g=>g.id===payload.gateway_id&&this.kits.some(k=>k.id===g.kit_id&&k.owner_id===this.user.id)))throw Error('Selecciona tu gateway.');if(payload.gateway_id&&this.stations.some(s=>s.gateway_id===payload.gateway_id&&s.node_label===payload.node_label&&!s.deleted_at))throw Error('Ese identificador ya está vinculado.');const result=this.addKit(payload.kind);this.assign(result.activation_code);const station=this.stations.find(s=>s.kit_id===result.kit_id),gateway=this.gateways.find(g=>g.kit_id===result.kit_id);if(station){station.name=payload.name;station.node_label=payload.node_label;if(payload.gateway_id)station.gateway_id=payload.gateway_id}if(gateway&&payload.kind==='gateway')gateway.name=payload.name;return {kit_id:result.kit_id,gateway_id:gateway?.id||null,station_id:station?.id||null}}
 stationOwner(station){return this.kits.find(k=>k.id===station.kit_id)?.owner_id}
 allowedStation(id){const station=this.stations.find(s=>s.id===id);if(!station||(this.account!=='admin'&&this.stationOwner(station)!==this.user.id))throw Error('No tienes acceso a esa estación.');return station}
 snapshot(){
  const admin=this.account==='admin',kits=this.kits.filter(k=>admin||k.owner_id===this.user.id),gateways=this.gateways.filter(g=>kits.some(k=>k.id===g.kit_id));const all=this.stations.filter(s=>kits.some(k=>k.id===s.kit_id)),stations=all.filter(s=>!s.deleted_at),archivedStations=all.filter(s=>s.deleted_at),readings=[];
  for(const station of stations){const example=this.examples.get(station.id);if(!example)continue;for(let i=0;i<25;i++){const level=example.level+(i<16?Math.sin(i/4)*1.5:0);readings.push({id:i+1,station_id:station.id,distance_cm:example.bed-level,sensor_status:'OK',packet:i+1,rssi:-74,received_at:new Date(Date.now()-(24-i)*10000).toISOString()})}gateways.find(g=>g.id===station.gateway_id).last_seen=new Date().toISOString()}
  const data={admin,kits,gateways,stations,archivedStations,readings,profiles:Object.keys(ids).filter(key=>admin||key===this.account).map(key=>({user_id:ids[key],display_name:names[key]})),personalEntities:this.personalEntities.filter(e=>admin||e.owner_id===this.user.id),inventory:admin?this.kits:[]};if(admin){data.adminEntities=this.adminEntities;data.adminAssignments=this.adminAssignments}return structuredClone(data);
 }
 editStation(id,patch){const station=this.allowedStation(id);if(patch.gateway_id){const g=this.gateways.find(g=>g.id===patch.gateway_id);if(!g||(g.kit_id!==station.kit_id&&(!this.stationOwner(station)||this.kits.find(k=>k.id===g.kit_id)?.owner_id!==this.stationOwner(station))))throw Error('Selecciona un gateway de la misma cuenta.');}if(patch.personal_entity_id&&!this.personalEntities.some(e=>e.id===patch.personal_entity_id&&e.owner_id===this.stationOwner(station)))throw Error('La entidad debe pertenecer al propietario de la estación.');Object.assign(station,patch)}
 editGateway(id,name){if(!this.snapshot().gateways.some(g=>g.id===id))throw Error('No tienes acceso a ese gateway.');this.gateways.find(g=>g.id===id).name=name}
 deleteStation(id){this.allowedStation(id).deleted_at=new Date().toISOString()}
 restoreStation(id){this.allowedStation(id).deleted_at=null}
 entity(scope,id){if(scope==='admin'&&this.account!=='admin')throw Error('No autorizado.');const entity=(scope==='admin'?this.adminEntities:this.personalEntities).find(e=>e.id===id);if(!entity||(scope==='personal'&&entity.owner_id!==this.user.id))throw Error('No tienes acceso a esa entidad.');return entity}
 createEntity(scope,name){if(scope==='admin'&&this.account!=='admin')throw Error('No autorizado.');const items=scope==='admin'?this.adminEntities:this.personalEntities;if(items.some(e=>e.name.toLowerCase()===name.toLowerCase()&&(scope==='admin'||e.owner_id===this.user.id)))throw Error('Ya existe una entidad con ese nombre.');const entity={id:uid(),name,...(scope==='admin'?{created_by:this.user.id}:{owner_id:this.user.id})};items.push(entity);return entity}
 renameEntity(scope,id,name){this.entity(scope,id).name=name}
 deleteEntity(scope,id){this.entity(scope,id);if(scope==='admin'){this.adminEntities=this.adminEntities.filter(e=>e.id!==id);this.adminAssignments=this.adminAssignments.filter(a=>a.entity_id!==id)}else{this.personalEntities=this.personalEntities.filter(e=>e.id!==id);for(const s of this.stations)if(s.personal_entity_id===id)s.personal_entity_id=null}}
 classify(id,entityId){if(this.account!=='admin')throw Error('No autorizado.');this.allowedStation(id);if(entityId)this.entity('admin',entityId);this.adminAssignments=this.adminAssignments.filter(a=>a.station_id!==id);if(entityId)this.adminAssignments.push({station_id:id,entity_id:entityId})}
}
