import test from 'node:test';import assert from 'node:assert/strict';
import {telegramExamples,telegramExampleMessage} from '../src/telegram-examples.js';
import {telegramMessage} from '../lib/telegram.js';
test('todos los ejemplos enviados coinciden con la vista previa y se distinguen de una alerta real',()=>{
 for(const kind of Object.keys(telegramExamples)){
  const preview=telegramExampleMessage(kind),outbound=telegramMessage({severity:'test',test_kind:kind,station_name:'Nombre real que no debe salir',level_cm:987});
  assert.equal(outbound,preview);assert.match(outbound,/^PRUEBA/);assert.match(outbound,/Datos simulados/);assert.match(outbound,/No es una alerta real/);assert(!outbound.includes('Nombre real'));assert(!outbound.includes('987'));
 }
 assert.throws(()=>telegramExampleMessage('offline'));assert.throws(()=>telegramExampleMessage('__proto__'));
 assert(!telegramMessage({severity:'red',station_name:'Estación real',station_code:'EST-1',level_cm:30,created_at:'ahora'}).startsWith('PRUEBA'));
});
