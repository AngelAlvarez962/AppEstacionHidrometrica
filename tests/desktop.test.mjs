import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {cloudUrl,sameOrigin}=createRequire(import.meta.url)('../desktop/runtime.cjs');
test('desktop acepta solo un sitio público HTTPS y no credenciales en URL',()=>{
 assert.equal(cloudUrl(null),null);
 assert.equal(cloudUrl('https://monitoreo.example.com'),'https://monitoreo.example.com/');
 for(const url of ['http://monitoreo.example.com','https://user:secret@example.com','file:///C:/private','https://127.0.0.1','https://example.com/?token=secret','https://example.com/login'])assert.throws(()=>cloudUrl(url));
});
test('desktop impide que la ventana navegue a otro origen o archivos locales',()=>{
 assert.equal(sameOrigin('https://app.example.com/?recovery=1','https://app.example.com/'),true);
 for(const url of ['https://otro.example.com/','file:///C:/private','javascript:alert(1)','http://app.example.com/'])assert.equal(sameOrigin(url,'https://app.example.com/'),false);
});
