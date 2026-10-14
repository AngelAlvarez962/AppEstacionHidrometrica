export function emailConfigured(env=process.env){return Boolean(env.RESEND_API_KEY&&/^[^\r\n]+@[^\r\n]+$/.test(env.ALERT_EMAIL_FROM||''))}
export function alertMessage(event){
 const label={yellow:'Aviso amarillo',red:'Alerta roja',error:'Revisa el sensor'}[event.severity];
 if(!label)throw Error('Aviso inválido');
 return {subject:label+' · '+event.station_code,text:[label,event.station_name+' ('+event.station_code+')',event.level_cm===null?'La lectura del sensor requiere revisión.':'Nivel medido: '+Number(event.level_cm)+' cm.', 'Registrado: '+event.created_at,'Abre el monitoreo para revisar los datos y su actualidad.'].join('\n')};
}
let working=false;
export async function deliverAlerts(service,{env=process.env,fetcher=fetch}={}){
 if(working||!emailConfigured(env))return;
 working=true;
 try{
  for(let i=0;i<3;i++){
   const event=await service('rpc/kit_email_take','POST',{});if(!event)return;
   let success=false;
   try{const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'hydro-alert-'+event.id},body:JSON.stringify({from:env.ALERT_EMAIL_FROM,to:[event.recipient],...alertMessage(event)}),signal:AbortSignal.timeout(15000)});success=response.ok;}catch(_){/* Retry through the durable queue. Never log credentials or recipient. */}
   await service('rpc/kit_email_finish','POST',{p_id:event.id,p_lease:event.lease_id,p_success:success});
   if(!success)return;
  }
 }catch(_){/* A delivery failure must not lose a sensor reading. */}finally{working=false}
}
