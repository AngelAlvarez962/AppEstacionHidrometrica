import test from 'node:test';
import assert from 'node:assert/strict';
import {calibration,measurement,sensorDistance,validCode} from '../src/core.js';
import {DemoStore} from '../src/demo.js';
import {authStorage} from '../src/auth-storage.js';
const cfg={bed_height:65,capacity_height:16,yellow_alert:12,red_alert:15};
const reading=(distance,status='OK')=>({distance_cm:distance,sensor_status:status,received_at:new Date().toISOString()});

test('la distancia real permanece visible aunque el nivel calculado sea cero o falten medidas',()=>{
 const actual=reading(68.5);
 assert.equal(sensorDistance(actual).distance,68.5);
 assert.equal(measurement({bed_height:62.3,capacity_height:16,yellow_alert:12,red_alert:15},actual).level,0);
 assert.equal(measurement({...cfg,bed_height:null},actual).state,'uncalibrated');
 assert.equal(sensorDistance(actual).distance,68.5);
});
test('no presenta una distancia antigua o un error como medición actual',()=>{
 for(const data of [null,reading(0,'SIN_ECO'),reading(10),reading('NaN'),{...reading(68.5),received_at:new Date(Date.now()-91000).toISOString()}])assert.equal(sensorDistance(data).distance,undefined);
});
test('nivel y porcentaje utilizan alturas diferentes',()=>{
  for(const [distance,level,percent,state] of [[65,0,0,'normal'],[57,8,50,'normal'],[53,12,75,'yellow'],[50,15,93.75,'red'],[49,16,100,'red']]){
    const result=measurement(cfg,reading(distance));assert.equal(result.level,level);assert.equal(result.percent,percent);assert.equal(result.state,state);
  }
});
test('no fabrica niveles sin calibración, con error o datos antiguos',()=>{
  assert.equal(measurement({...cfg,bed_height:null},reading(57)).state,'uncalibrated');
  assert.equal(measurement(cfg,reading(10)).state,'error');
  assert.equal(measurement(cfg,reading(0,'SIN_ECO')).state,'error');
  assert.equal(measurement(cfg,{...reading(57),received_at:new Date(Date.now()-91000).toISOString()}).state,'offline');
  for(const change of [{capacity_height:66},{red_alert:18},{bed_height:''},{yellow_alert:15}])assert.throws(()=>calibration({...cfg,...change}));
});
test('demo explícita: separación de cuentas y activación única',()=>{
  const demo=new DemoStore();assert.equal(demo.snapshot().stations.length,3);
  const ana=demo.snapshot().stations[0];demo.account='bruno';assert.notEqual(demo.snapshot().stations[0].id,ana.id);assert.throws(()=>demo.editStation(ana.id,{name:'Ajena'}));
  demo.assign(demo.pending.activation_code);assert.equal(demo.snapshot().stations.length,2);assert.throws(()=>demo.assign(demo.pending.activation_code));
  demo.account='ana';assert.equal(demo.snapshot().stations.length,3);
  assert(validCode('KIT-'+ 'A'.repeat(32)));
});
test('sesión permanece por pestaña y PKCE puede completarse desde un correo',()=>{
 const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}};
 const shared=storage(),tab=storage(),otherTab=storage();const a=authStorage(tab,shared),b=authStorage(otherTab,shared),afterReload=authStorage(tab,shared);
 a.setItem('channel-1','token-cuenta-A');b.setItem('channel-2','token-cuenta-B');
 assert.equal(a.getItem('channel-1'),'token-cuenta-A');assert.equal(b.getItem('channel-2'),'token-cuenta-B');assert.equal(afterReload.getItem('channel-3'),'token-cuenta-A');
 a.setItem('channel-1-code-verifier','verificador');assert.equal(b.getItem('channel-2-code-verifier'),'verificador');b.removeItem('channel-2-code-verifier');assert.equal(a.getItem('channel-1-code-verifier'),null);
 b.removeItem('channel-2');assert.equal(a.getItem('channel-1'),'token-cuenta-A');
});

test('recordarme persiste sólo por elección y deja de compartir la sesión al desactivarlo',()=>{
 const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}};
 const shared=memory(),tab=memory(),first=authStorage(tab,shared);
 assert.equal(first.remembered,false);first.setItem('auth','temporal');
 assert.equal(authStorage(memory(),shared).getItem('auth'),null);
 first.setRemember(true);first.setItem('auth','sesion-recordada');first.setItem('auth-user','usuario');
 const reopened=authStorage(memory(),shared);assert.equal(reopened.remembered,true);assert.equal(reopened.getItem('auth'),'sesion-recordada');assert.equal(reopened.getItem('auth-user'),'usuario');
 reopened.setItem('auth','token-renovado');assert.equal(authStorage(memory(),shared).getItem('auth'),'token-renovado');
 reopened.setRemember(false);assert.equal(authStorage(memory(),shared).getItem('auth'),null);assert.equal(authStorage(memory(),shared).getItem('auth-user'),null);
 assert.equal(first.getItem('auth'),'sesion-recordada');
 first.setRemember(true);first.setItem('auth','nuevo-token');first.removeItem('auth');assert.equal(authStorage(memory(),shared).getItem('auth'),null);
});
