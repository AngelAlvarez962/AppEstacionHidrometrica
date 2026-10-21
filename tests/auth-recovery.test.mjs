import test from 'node:test';
import assert from 'node:assert/strict';
import {RecoveryFlow} from '../src/auth-recovery.js';
const session={user:{id:'example-user'}};
test('la recuperación no vuelve al panel por eventos posteriores de sesión',()=>{
 const flow=new RecoveryFlow();
 assert.equal(flow.event('PASSWORD_RECOVERY',session),'password');
 for(const event of ['INITIAL_SESSION','SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'])assert.equal(flow.event(event,session),'password');
 flow.complete();assert.equal(flow.event('USER_UPDATED',session),'app');
});
test('recargar la dirección de recuperación mantiene el formulario de cambio',()=>{
 const flow=new RecoveryFlow('?recovery=1');
 assert.equal(flow.event('INITIAL_SESSION',session),'password');
 assert.equal(flow.event('TOKEN_REFRESHED',session),'password');
});
test('un enlace sin sesión permite solicitar otro y no simula un cambio de contraseña',()=>{
 const flow=new RecoveryFlow('?recovery=1');
 assert.equal(flow.event('INITIAL_SESSION',null),'retry');
 assert.equal(flow.event('PASSWORD_RECOVERY',session),'password');
 assert.equal(flow.event('SIGNED_OUT',null),'login');
 assert.equal(flow.event('SIGNED_IN',session),'app');
});
test('el acceso normal no se convierte en recuperación',()=>{
 const flow=new RecoveryFlow();
 assert.equal(flow.event('INITIAL_SESSION',null),'login');
 assert.equal(flow.event('SIGNED_IN',session),'app');
});
