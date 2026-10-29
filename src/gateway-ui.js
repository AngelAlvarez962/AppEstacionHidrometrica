import {GatewaySerial,gatewayChange} from './gateway.js';
import {displayId} from './onboarding.js';
export function installGatewayUI(ctx){
 const {$,escape,api,openModal,bindModal,reload,showToast}=ctx;
 let usb=null,selected=null,hello=null,recognized=false,remembered=false,lease=null,pending=null,busy=false,lastPost=0,account=null,guideShown=false,step=0;
 const data=()=>ctx.getSnapshot(),user=()=>ctx.getUser(),demo=()=>ctx.getDemo();
 const ownGateways=()=>data().gateways.filter(g=>data().kits.some(k=>k.id===g.kit_id&&k.owner_id===user()?.id));
 const profile=()=>data().profiles?.find(p=>p.user_id===user()?.id);
 function status(text,error=false){if($('usb-status')){$('usb-status').textContent=text;$('usb-status').classList.toggle('error',error)}}
 function controls(){if($('usb-remember'))$('usb-remember').disabled=!recognized||remembered;if($('usb-wifi'))$('usb-wifi').disabled=!remembered||!hello;}
 async function close(){clearInterval(lease);lease=null;remembered=false;recognized=false;hello=null;pending=null;const old=usb;usb=null;await old?.close();if(selected&&!demo())await api('POST',{action:'usb-lease',id:selected,release:true}).catch(()=>{});selected=null;controls();}
 function openGuide(){guideShown=true;ctx.startGuide()}
 async function remember(){const g=ownGateways().find(g=>g.id===selected);if(!g)return;const previous=profile()?.preferred_gateway_id||null;const changed=gatewayChange(previous,g.id);if(changed&&!$('usb-confirm')?.checked)throw Error('Confirma el cambio o conserva tu gateway anterior.');if(demo())demo().preferredGateway=g.id;else await api('POST',{action:'remember-gateway',id:g.id,expected:previous,confirm:changed,station_ids:Array.from(document.querySelectorAll('[name=move_station]:checked')).map(input=>input.value)});remembered=true;await reload();status('Gateway guardado en tu cuenta. Puedes configurar su Wi-Fi.');controls();}
 async function line(value){
  if(!usb||account!==user()?.id)return;
  if(value.type==='hello'){hello=value;recognized=true;controls();if($('usb-select-form'))status(remembered?'Gateway compatible. Puedes guardar su Wi-Fi.':'Gateway detectado. Comprueba tu selección y pulsa Guardar gateway.');return}
  if(value.type==='saved'&&pending){const current=pending;pending=null;try{await api('POST',{action:'gateway-finish',id:selected,ticket:current.ticket,proof:value.proof});status('Red guardada en el gateway. Esperando su primera lectura por Internet…');await reload();}catch{status('No se confirmó el guardado. Vuelve a configurar el Wi-Fi antes de retirar el USB.',true)}return}
  if(value.type!=='reading')return;recognized=true;controls();
  if(!remembered){status('Recibiendo por USB. Pulsa Guardar gateway para vincularlo a esta cuenta.');return}
  // Compatible firmware publishes directly. Never forward its samples a second time.
  if(hello?.internet_ok){status('El gateway está enviando por Internet. La vinculación se conserva al retirar el USB.');return}
  const s=data().stations.find(s=>s.gateway_id===selected&&s.node_label===value.node);
  if(!s){status('Se recibe radio, pero esta estación no está vinculada al gateway seleccionado.',true);return}
  if(busy||Date.now()-lastPost<1500)return;busy=true;lastPost=Date.now();
  try{await api('POST',{action:'usb-reading',id:selected,station_serial:s.serial,...value});status('USB: '+value.distance_cm+' cm. Lectura guardada.');void reload()}catch{status('Se recibe USB, pero no se pudo guardar. Revisa Internet y la configuración de la estación.',true)}finally{busy=false}
 }
 function openUSB(){
  const gateways=ownGateways(),previous=profile()?.preferred_gateway_id||null;
  openModal('Conecta tu gateway',`<p class="modal-copy">Conecta el USB, elige tu receptor y guarda la vinculación. Desconectar el USB no borra el equipo ni su historial.</p>${demo()?'<p class="info">Estás en la demo. No se conectarán equipos reales.</p>':''}<form id="usb-select-form"><label>Gateway de esta cuenta<select name="gateway" id="usb-choice" ${usb?'disabled':''}>${gateways.map(g=>`<option value="${escape(g.id)}" ${(selected||previous)===g.id?'selected':''}>${escape(displayId(g))} · ${escape(g.name)}</option>`).join('')}</select></label><p id="usb-change-copy" class="info" hidden></p><label id="usb-confirm-label" class="confirm-choice" hidden><input type="checkbox" id="usb-confirm">Sí, usar este gateway en lugar del anterior. Los equipos y el historial se conservan.</label><div id="usb-move-stations"></div><div class="modal-actions"><button type="submit" class="primary" ${usb||!gateways.length||demo()?'disabled':''}>Elegir puerto USB</button><button type="button" id="usb-remember" class="secondary" disabled>Guardar gateway</button><button type="button" id="usb-disconnect" class="secondary" ${usb?'':'disabled'}>Desconectar USB</button></div></form><p id="usb-status" role="status" class="info">${usb?'USB conectado.':'Usa un cable de datos. Cierra el monitor serie de Arduino si está abierto.'}</p><button id="usb-wifi" class="primary" disabled>Configurar Wi-Fi</button><p class="modal-copy">El envío por USB necesita esta app abierta. Para usar sólo corriente, guarda una red Wi-Fi de 2.4 GHz en un gateway compatible y comprueba una lectura por Internet.</p>`);

  const update=()=>{const choice=$('usb-choice').value,changed=gatewayChange(previous,choice);$('usb-confirm-label').hidden=!changed;$('usb-change-copy').hidden=!changed;$('usb-change-copy').textContent=changed?'Ya tienes un gateway guardado. ¿Deseas cambiar al nuevo?':'';$('usb-confirm').checked=false;
   const affected=changed?data().stations.filter(s=>s.gateway_id===previous&&data().kits.some(k=>k.id===s.kit_id&&k.owner_id===user()?.id)):[];
   $('usb-move-stations').innerHTML=affected.length?'<p>Elige qué estaciones usarán el nuevo receptor:</p>'+affected.map(s=>`<label class="confirm-choice"><input type="checkbox" name="move_station" value="${escape(s.id)}" checked>${escape(s.name)}</label>`).join(''):'';
  };update();$('usb-choice').onchange=update;
  bindModal(async fields=>{const id=String(fields.get('gateway'));if(!gateways.some(g=>g.id===id))throw Error('Selecciona un gateway de tu cuenta.');if(gatewayChange(previous,id)&&!$('usb-confirm').checked)throw Error('Confirma el cambio antes de conectar el nuevo gateway.');selected=id;
   usb=new GatewaySerial({onLine:value=>void line(value),onClose:()=>{status('USB desconectado. La vinculación sigue guardada.');recognized=false;controls()}});
   try{await usb.choose();await api('POST',{action:'usb-lease',id});lease=setInterval(()=>void api('POST',{action:'usb-lease',id}).catch(()=>{}),10000);await new Promise(resolve=>setTimeout(resolve,900));await usb.connect();$('usb-choice').disabled=true;$('usb-disconnect').disabled=false;status('USB conectado. Esperando identificación o una lectura de radio…');}catch{await close();throw Error('No se pudo abrir el USB. Selecciona el gateway, cierra otros lectores y vuelve a intentarlo.')}});
  $('usb-remember').onclick=()=>void remember().catch(error=>status(error.message,true));$('usb-disconnect').onclick=async()=>{await close();openUSB()};$('usb-wifi').onclick=openWifi;controls();
 }
 function openWifi(){if(!hello||!remembered)return;openModal('Guarda el Wi-Fi en el gateway',`<p class="modal-copy">Usa una red de 2.4 GHz con Internet. La contraseña se envía sólo al equipo conectado por USB. Al guardarla podrás alimentar el gateway con su cargador.</p><form><label>Nombre de red (Wi-Fi)<input name="ssid" required maxlength="32" autocomplete="off"></label><label>Contraseña del Wi-Fi<input name="password" type="password" minlength="8" maxlength="63" required autocomplete="new-password"></label><div class="modal-actions"><button type="submit" class="primary">Guardar en el gateway</button></div></form><p id="usb-status" role="status"></p>`);
  bindModal(async fields=>{if(!usb||!hello)throw Error('Vuelve a conectar el gateway.');if(pending)throw Error('Espera la confirmación del gateway antes de volver a guardar.');const ssid=String(fields.get('ssid')),password=String(fields.get('password'));if(new TextEncoder().encode(ssid).length>32)throw Error('El nombre de red supera los 32 bytes.');const configuration=await api('POST',{action:'gateway-prepare',id:selected,hardware:hello.hardware});pending={ticket:configuration.ticket};await usb.send({cmd:'configure',ssid,password,...configuration});$('modal-content').querySelector('form').reset();hello.configured=true;status('Esperando confirmación del gateway. No retires el USB todavía.');setTimeout(()=>{if(pending?.ticket===configuration.ticket){pending=null;status('El gateway no confirmó el guardado. Vuelve a conectar el USB y repite el paso.',true)}},15000);});
 }
 function render(){if(account!==user()?.id){void close();account=user()?.id;guideShown=false;}const el=$('guide-open');if(el)el.hidden=!!data().admin;const usbButton=$('connect-usb');if(usbButton)usbButton.hidden=!!data().admin&&!ownGateways().length;}
 function suggestGuide(){if(!data().admin&&!profile()?.guide_completed&&!demo()?.guideCompleted&&!guideShown&&!$('modal').open){guideShown=true;ctx.startGuide();return true}return false}
 $('guide-open').onclick=openGuide;$('connect-usb').onclick=openUSB;
 return {render,suggestGuide,close,openUSB};
}
