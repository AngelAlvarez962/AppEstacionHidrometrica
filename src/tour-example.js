import {measurement} from './core.js';

// This is a disposable practice model. It is never added to account snapshots.
export function createTourExample(){return {name:'Estación del puente',location:'Junto al puente',entity:'Zona norte',gateway:'Gateway de ejemplo',bed_height:'100',capacity_height:'100',yellow_alert:'60',red_alert:'80',distance_cm:68.5}}
const editable=new Set(['name','location','entity','bed_height','capacity_height','yellow_alert','red_alert']);
export function updateTourExample(example,key,value){if(editable.has(key))example[key]=String(value).slice(0,180);return example}
export function exampleMeasurement(example){return measurement(example,{received_at:new Date(0).toISOString(),distance_cm:example.distance_cm,sensor_status:'OK'},0)}
export function exampleResultHtml(example,kind,escape){
 const e=escape;
 if(kind==='gateway')return `<div class="tour-result-card"><div class="tour-result-top"><strong>${e(example.gateway)}</strong><span class="status normal">Conectado · ejemplo</span></div><p>Red de ejemplo · Internet comprobado</p><small>Así se mostraría después de vincularlo y comprobar una lectura. No se conecta ningún equipo durante el tutorial.</small></div>`;
 if(kind==='entity')return `<div class="tour-result-card"><div class="tour-result-top"><strong>${e(example.entity||'Mi entidad')}</strong><span class="node-code">1 estación · ejemplo</span></div><p>${e(example.name||'Mi estación')}</p><small>Así se vería tu estación agrupada dentro de esta entidad.</small></div>`;
 const value=exampleMeasurement(example),valid=value.level!==undefined;
 return `<div class="tour-result-card"><div class="tour-result-top"><strong>${e(example.name||'Mi estación')}</strong><span class="status ${valid?value.state:'uncalibrated'}">${e(value.label)}</span></div><p>${e(example.location||'Mi ubicación')} · ${e(example.entity||'Sin entidad')}</p><div class="tour-result-values"><div><small>Distancia del ejemplo</small><strong>${e(example.distance_cm)} <b>cm</b></strong></div><div><small>Nivel calculado</small><strong>${valid?value.level.toFixed(1):'—'} <b>cm</b></strong></div></div><div class="progress ${value.state}"><div style="width:${valid?value.percent:0}%"></div></div><small>${valid?'Sensor a fondo '+e(example.bed_height)+' cm − distancia '+e(example.distance_cm)+' cm.':'Revisa las medidas: sensor a fondo > 20; fondo a tope ≤ sensor a fondo; amarilla < roja ≤ fondo a tope.'}</small></div>`;
}
