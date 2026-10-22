import test from 'node:test';import assert from 'node:assert/strict';import {createEmailRequester,publicEmailPortal} from '../src/email-access.js';
test('correo apunta a HTTPS público y no admite direcciones locales ni redirecciones en parámetros',()=>{
 assert.equal(publicEmailPortal('https://acceso.example.com'),'https://acceso.example.com/');
 for(const value of ['http://127.0.0.1:8790','https://user:secret@example.com','https://example.com/?next=bad','https://127.0.0.1','file:///secret','javascript:alert(1)'])assert.equal(publicEmailPortal(value),null);
});
test('solicitud de correo es independiente del navegador y no conserva ni intercambia sesiones con la app',()=>{
 let call;const factory=(...args)=>{call=args;return {auth:{}}};const cfg={url:'https://test.supabase.co',key:'sb_publishable_TEST',authPortalUrl:'https://acceso.example.com/'};
 const result=createEmailRequester(factory,cfg);assert.equal(result.redirect,cfg.authPortalUrl);assert.equal(call[2].auth.flowType,'implicit');assert.equal(call[2].auth.persistSession,false);assert.equal(call[2].auth.autoRefreshToken,false);assert.equal(call[2].auth.detectSessionInUrl,false);assert.match(call[2].auth.storageKey,/^hi-email-request-/);
 const key=call[2].auth.storageKey;createEmailRequester(factory,cfg);assert.notEqual(call[2].auth.storageKey,key);assert.equal(createEmailRequester(factory,{...cfg,authPortalUrl:null}),null);
});
