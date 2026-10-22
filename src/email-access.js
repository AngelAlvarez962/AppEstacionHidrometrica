export function publicEmailPortal(value){
 try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash||url.pathname!=='/'||!url.hostname.includes('.')||/^(localhost|127\.|0\.|\[)/i.test(url.hostname))return null;return url.href}catch{return null}
}
export function createEmailRequester(createClient,config){
 const redirect=publicEmailPortal(config.authPortalUrl);if(!redirect)return null;
 // Email requests must work on a different device. Keep this client isolated
 // from the signed-in app; the public callback holds a session in memory only.
 const client=createClient(config.url,config.key,{auth:{storageKey:'hi-email-request-'+crypto.randomUUID(),flowType:'implicit',persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 return {client,redirect};
}
