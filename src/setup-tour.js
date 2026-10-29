import {createTourExample,updateTourExample,exampleResultHtml} from './tour-example.js';
// All practice changes stay in a disposable model, never in an account snapshot.
export const tourSteps = [
 {view:'stations',target:'#claim-open',title:'Tus equipos',text:'Aquí aparecen tus estaciones. Si todavía no tienes equipos, pulsa Agregar estación al salir del recorrido. Para registrar un receptor, abre Mis gateways y pulsa Agregar gateway.'},
 {view:'stations',detail:true,target:'#edit-station',title:'Abre tu estación',text:'Selecciona una estación para ver sus medidas e historial. Configurar estación abre sus datos de instalación.'},
 {view:'stations',form:'station',target:'[name="name"]',title:'Nombre, ubicación y receptor',text:'Prueba un nombre y una ubicación. La tarjeta de ejemplo cambia mientras escribes. En la configuración real elegirás un gateway de tu cuenta; aquí no se guardan cambios.'},
 {view:'stations',form:'station',target:'[name="bed_height"]',title:'Introduce las medidas reales',text:'Sensor a fondo: desde la cara del sensor hasta el punto de cero de agua. Fondo a tope: altura que representa el 100%. Usa centímetros; no copies las medidas de otra instalación.'},
 {view:'stations',form:'station',target:'[name="yellow_alert"]',title:'Define los avisos',text:'El aviso amarillo debe ser menor que el rojo, y el rojo no debe superar Fondo a tope. Al configurar de verdad, pulsa Guardar y continuar después de revisar todas las medidas.'},
 {view:'gateways',target:'#connect-usb',title:'Vincula el gateway por USB',text:'Esta es la sección Mis gateways. Conecta el receptor con un cable de datos y pulsa Conectar por USB. Elige el puerto y tu gateway, y después Guardar gateway. Si sustituyes otro receptor, se pedirá confirmación.'},
 {view:'gateways',target:'.gateway-info',title:'Prepara Internet',text:'Dentro de Conectar por USB, tras guardar el gateway, utiliza Configurar Wi-Fi con una red de 2.4 GHz. Espera Internet comprobado y una lectura reciente antes de alimentarlo sólo con su cargador. El recorrido no abre puertos ni configura redes.'},
 {view:'entities',target:'#entity-create',title:'Organiza tus lugares',text:'Esta es la sección Mis entidades. Crea grupos por ubicación o uso para organizar tus estaciones. Cada cuenta mantiene sus propias entidades.'},
 {view:'entities',form:'entity',target:'[name="name"]',title:'Crea una entidad y asigna estaciones',text:'Aquí escribes el nombre del grupo. Al salir del recorrido, guarda tu entidad; luego abre Configurar estación y selecciónala en Entidad. Puedes consultar sus estaciones desde esta sección.'},
 {view:'stations',target:'#stations-list',title:'Consulta tus lecturas',text:'La distancia del sensor y el nivel calculado son datos distintos. Abre una estación para ver el historial y exportarlo. Revisa siempre la hora de la última lectura; una lectura antigua no confirma el nivel actual.'}
];

export function installSetupTour(ctx){
 const {$,escape}=ctx;let index=0,active=false,highlight=null,practice=createTourExample();
 const panel=document.createElement('section');panel.id='setup-tour';panel.className='setup-tour';panel.hidden=true;panel.setAttribute('role','region');panel.setAttribute('aria-label','Recorrido de configuración');
 document.body.append(panel);
 function clear(){highlight?.classList.remove('tour-highlight');highlight=null;panel.hidden=true;document.body.classList.remove('tour-running');document.body.append(panel);}
 function stop(){active=false;clear();if($('modal').open)$('modal').close();}
 function kind(){return tourSteps[index].view==='gateways'?'gateway':tourSteps[index].view==='entities'?'entity':'station'}
 function result(){if($('tour-result'))$('tour-result').innerHTML=exampleResultHtml(practice,kind(),escape)}
 function practiceForm(type){
  const form=$('modal-content').querySelector('form');if(!form)return;
  form.onsubmit=event=>event.preventDefault();
  form.querySelectorAll('button:not(.select-trigger):not([role=option])').forEach(button=>button.disabled=true);
  form.querySelectorAll('input,select,textarea').forEach(input=>{
   input.disabled=false;
   if(input.name==='gateway_id'){input.innerHTML='<option value="tour-gateway">Gateway de ejemplo</option>';return}
   if(input.name==='personal_entity_id'){input.innerHTML=`<option value="tour-entity">${escape(practice.entity)}</option>`;input.disabled=true;return}
   const key=type==='entity'&&input.name==='name'?'entity':input.name;
   if(Object.hasOwn(practice,key))input.value=practice[key];
   input.oninput=()=>{updateTourExample(practice,key,input.value);result()};
  });
 }
 function show(){
  clear();const item=tourSteps[index];if($('modal').open)$('modal').close();ctx.switchView(item.view);
  let available=true;
  if(item.form==='station')available=ctx.previewStation();else if(item.form==='entity')ctx.previewEntity();else if(item.detail)available=ctx.previewDetail();
  if(item.form&&available){
   practiceForm(item.form);
   $('modal').append(panel);
  }
  panel.innerHTML=`<div class="tour-heading"><span class="eyebrow">PASO ${index+1} DE ${tourSteps.length}</span><button id="tour-close" class="icon-button" aria-label="Cerrar recorrido">×</button></div><h2 id="tour-title" tabindex="-1">${escape(item.title)}</h2><p>${escape(available?item.text:'Cuando agregues tu estación podrás abrir aquí su detalle real. Esta tarjeta muestra cómo se vería con datos de ejemplo.')}</p><section class="tour-result" aria-label="Resultado de ejemplo"><div class="tour-result-heading"><strong>Así quedaría</strong><span class="node-code">EJEMPLO</span></div><div id="tour-result" aria-live="polite"></div><small>No son lecturas reales. No se guardan equipos ni cambios.</small></section><div class="tour-actions"><button id="tour-prev" class="secondary" ${index?'':'disabled'}>Anterior</button><button id="tour-next" class="primary">${index===tourSteps.length-1?'Terminar recorrido':'Siguiente'}</button></div>`;
  result();
  panel.hidden=false;document.body.classList.add('tour-running');
  highlight=available?(item.form?$('modal-content'):document).querySelector(item.target):document.querySelector('#stations-list');highlight?.classList.add('tour-highlight');highlight?.scrollIntoView({block:'center',behavior:'instant'});
  $('tour-close').onclick=stop;$('tour-prev').onclick=()=>{index--;show()};$('tour-next').onclick=async()=>{if(index<tourSteps.length-1){index++;show();return}try{await ctx.complete();stop();ctx.afterComplete?.()}catch{ctx.showToast('No se pudo guardar el avance. Puedes volver a consultar el recorrido.')}};
  $('tour-title').focus({preventScroll:true});
 }
 return {start(){active=true;index=0;practice=createTourExample();show()},stop,get active(){return active}};
}
