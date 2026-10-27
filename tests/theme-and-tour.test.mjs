import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {createTourExample,updateTourExample,exampleMeasurement,exampleResultHtml} from '../src/tour-example.js';
function themeHarness({saved=null,dark=false,blocked=false}={}){
 const events={},attrs={},writes=[],root={dataset:{},style:{}};
 const button={setAttribute:(key,value)=>attrs[key]=value,addEventListener:(key,fn)=>events['button:'+key]=fn};
 const document={documentElement:root,getElementById:()=>button,addEventListener:(key,fn)=>events[key]=fn};
 const media={matches:dark,addEventListener:(key,fn)=>events['system:'+key]=fn};
 const localStorage={getItem(){if(blocked)throw Error();return saved},setItem(key,value){if(blocked)throw Error();writes.push({key,value})}};
 vm.runInNewContext(fs.readFileSync(new URL('../public/theme-init.js',import.meta.url),'utf8'),{document,window:{matchMedia:()=>media,dispatchEvent(){}},localStorage,CustomEvent:class{}});
 events.DOMContentLoaded();return {events,attrs,writes,root};
}
test('tema respeta sistema, conserva elección y funciona con almacenamiento bloqueado',()=>{
 const h=themeHarness({dark:true});assert.equal(h.root.dataset.theme,'dark');assert.equal(h.attrs['aria-pressed'],'true');
 h.events['button:click']();assert.equal(h.root.dataset.theme,'light');assert.equal(h.attrs['aria-label'],'Activar modo oscuro');assert.deepEqual(h.writes,[{key:'hi-display-theme',value:'light'}]);
 h.events['system:change']({matches:true});assert.equal(h.root.dataset.theme,'light');
 assert.equal(themeHarness({saved:'light',dark:true}).root.dataset.theme,'light');
 const blocked=themeHarness({blocked:true});blocked.events['button:click']();assert.equal(blocked.root.dataset.theme,'dark');
 const automatic=themeHarness();automatic.events['system:change']({matches:true});assert.equal(automatic.root.dataset.theme,'dark');
});
test('práctica usa el cálculo real sin cambiar cuentas y no admite campos técnicos',()=>{
 const first=createTourExample(),second=createTourExample();assert.equal(exampleMeasurement(first).level,31.5);
 updateTourExample(first,'name','Mi puente');updateTourExample(first,'bed_height','110');assert.equal(exampleMeasurement(first).level,41.5);assert.equal(second.name,'Estación del puente');assert.equal(second.bed_height,'100');
 updateTourExample(first,'id','real-id');updateTourExample(first,'gateway_id','other-user');assert.equal(first.id,undefined);assert.equal(first.gateway_id,undefined);
 updateTourExample(first,'capacity_height','999');assert.equal(exampleMeasurement(first).state,'uncalibrated');
});
test('nombres de ejemplo se escapan y los resultados no incluyen acciones reales',()=>{
 const example=createTourExample();updateTourExample(example,'entity','<script>bad()</script>');const escape=s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;');
 for(const kind of ['station','gateway','entity']){const html=exampleResultHtml(example,kind,escape);assert(!html.includes('<script>'));assert(!html.includes('<form'));assert(!html.includes('onclick='));}
 assert(exampleResultHtml(example,'entity',escape).includes('&lt;script&gt;'));
});
