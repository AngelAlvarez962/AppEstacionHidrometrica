import {telegramExampleMessage} from '../src/telegram-examples.js';
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
export const botUsername='HackeandoInundacionesAvisosBot';
export const webhookUrl='https://estacionhidrometrica.ideasdisruptivas.com/api/telegram';
export const telegramConfigured=env=>/^\d+:[A-Za-z0-9_-]{20,}$/.test(env.TELEGRAM_BOT_TOKEN||'');
export const webhookSecret=env=>createHmac('sha256',env.TELEGRAM_BOT_TOKEN||'').update('hydro-telegram-webhook-v1').digest('hex');
export function validWebhook(header,env){const expected=webhookSecret(env);return telegramConfigured(env)&&typeof header==='string'&&Buffer.byteLength(header)===Buffer.byteLength(expected)&&timingSafeEqual(Buffer.from(header),Buffer.from(expected))}
async function telegram(method,body,env,fetcher){
 try{const r=await fetcher('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});const data=await r.json();return {...data,ok:r.ok&&data.ok===true}}catch{return {ok:false}}
}
export async function configureTelegram(env,fetcher=fetch){
 if(!telegramConfigured(env))throw Error('El token de Telegram no está configurado correctamente en el servidor.');
 const identity=await telegram('getMe',{},env,fetcher);
 if(!identity.ok||identity.result?.username?.toLowerCase()!==botUsername.toLowerCase())throw Error('No se pudo comprobar el bot esperado. Revisa el token guardado en Vercel.');
 const result=await telegram('setWebhook',{url:webhookUrl,secret_token:webhookSecret(env),allowed_updates:['message'],max_connections:5},env,fetcher);
 if(!result.ok)throw Error('Telegram no pudo activar la conexión. Inténtalo nuevamente.');
 return {ok:true};
}
export function telegramMessage(e){
 if(e.severity==='linked')return 'Telegram vinculado a Hackeando las inundaciones. Los avisos de tus estaciones están activados. Puedes pausarlos en la app o enviar /stop. Usa /help para ver ayuda.';
 if(e.severity==='test')return telegramExampleMessage(e.test_kind||'test');
 const label={yellow:'Aviso amarillo',red:'Alerta roja',error:'Revisa el sensor',normal:'Recuperación: lectura en rango normal'}[e.severity];
 return [label,e.station_name+' ('+e.station_code+')',e.level_cm==null?'El sensor no proporciona una lectura válida. No interpretes el cero como nivel real.':'Nivel calculado: '+Number(e.level_cm)+' cm.', 'Registrado: '+e.created_at,'Revisa la lectura actual y la instalación en '+webhookUrl.replace('/api/telegram','/'),'No sustituye los avisos de las autoridades.'].join('\n');
}
export async function deliverTelegram(service,{env=process.env,fetcher=fetch}={}){
 if(!telegramConfigured(env))return;
 try{for(let i=0;i<3;i++){
  const event=await service('rpc/kit_telegram_take','POST',{});if(!event)return;
  const result=await telegram('sendMessage',{chat_id:event.recipient,text:telegramMessage(event)},env,fetcher);
  await service('rpc/kit_telegram_finish','POST',{p_id:event.id,p_lease:event.lease_id,p_success:result.ok,p_retry:Number.isInteger(result.parameters?.retry_after)?Math.max(300,result.parameters.retry_after):300,p_blocked:result.error_code===403});
  if(!result.ok)return;
 }}catch{/* Do not log bot URLs, tokens, chat IDs or message contents. Readings remain saved. */}
}
export async function receiveTelegram(req,res,service,{env=process.env,fetcher=fetch}={}){
 if(req.method!=='POST')return res.status(405).json({error:'Método no permitido.'});
 if(!validWebhook(req.headers['x-telegram-bot-api-secret-token'],env))return res.status(403).json({error:'Solicitud no autorizada.'});
 let update;try{update=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!update||JSON.stringify(update).length>16384)throw Error()}catch{return res.status(400).json({error:'Solicitud inválida.'})}
 const m=update.message,chat=m?.chat;
 if(!Number.isSafeInteger(update.update_id)||chat?.type!=='private'||!Number.isSafeInteger(chat.id)||chat.id<=0||m.from?.id!==chat.id||typeof m.text!=='string')return res.status(200).json({ok:true});
 try{
 const match=/^\/start ([a-f0-9]{64})$/.exec(m.text);
 if(match){const linked=await service('rpc/kit_telegram_consume','POST',{p_hash:createHash('sha256').update(match[1]).digest('hex'),p_chat:chat.id});if(linked)await deliverTelegram(service,{env,fetcher})}
 else if(m.text==='/stop')await service('rpc/kit_telegram_stop','POST',{p_chat:chat.id});
 else if(['/start','/help','/settings'].includes(m.text)){
 // Telegram retries may repeat a help response, so do not include station/account data.
 await telegram('sendMessage',{chat_id:chat.id,text:'Vincula tu cuenta desde la app: abre Avisos por Telegram y pulsa Vincular Telegram. El enlace vence en 10 minutos. /stop pausa tus avisos. Ajustes y ayuda: https://estacionhidrometrica.ideasdisruptivas.com/'},env,fetcher);
 }
 return res.status(200).json({ok:true});
 }catch{return res.status(503).json({error:'Inténtalo nuevamente.'})}
}
