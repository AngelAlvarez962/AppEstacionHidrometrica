import test from 'node:test';import assert from 'node:assert/strict';
import {DemoStore} from '../src/demo.js';import {pendingForUser,availableGateways,pendingStation} from '../src/onboarding.js';
import {deliverAlerts,emailConfigured} from '../lib/email.js';
test('estación sin gateway es visible y pendiente; expansión usa gateway propio',()=>{
 const demo=new DemoStore(),extra=demo.addKit('station'),other=demo.addKit('gateway');demo.assign(extra.activation_code);
 let data=demo.snapshot();assert.equal(data.stations.length,4);assert.equal(pendingForUser(data,demo.user.id).length,1);assert(availableGateways(extra.stations[0],data).length);
 demo.assign(other.activation_code,'bruno');assert(!availableGateways(extra.stations[0],demo.snapshot()).some(g=>g.id===other.gateway.id));
 assert.throws(()=>demo.editStation(extra.stations[0].id,{gateway_id:other.gateway.id}));
 demo.editStation(extra.stations[0].id,{gateway_id:data.gateways[0].id,bed_height:65,capacity_height:16,yellow_alert:12,red_alert:15});assert(!pendingStation(demo.snapshot().stations.at(-1)));
});
test('sin proveedor no se envía; reintento usa la misma clave de idempotencia y fallo no propaga',async()=>{
 const event={id:'event-1',lease_id:'lease-1',recipient:'buyer@example.invalid',station_code:'EST-000001',station_name:'Cubeta',severity:'yellow',level_cm:12,created_at:'2026-10-14'};
 let called=0;const service=async(route,method,body)=>{called++;if(route.endsWith('take'))return event;assert.equal(body.p_success,false)};
 await deliverAlerts(service,{env:{},fetcher:()=>{throw Error('No debe enviar')}});assert.equal(called,0);assert.equal(emailConfigured({}),false);
 await deliverAlerts(service,{env:{RESEND_API_KEY:'test-only',ALERT_EMAIL_FROM:'Avisos <test@example.invalid>'},fetcher:async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');assert.equal(options.headers['Idempotency-Key'],'hydro-alert-event-1');assert.equal(JSON.parse(options.body).to[0],event.recipient);return new Response('{}',{status:503})}});assert.equal(called,2);
});
