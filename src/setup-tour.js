// Recorrido de lectura: abre las secciones y muestra los formularios sin guardar datos.
export const tourSteps = [
 {view:'stations',target:'#claim-open',title:'Tus equipos',text:'Aquí aparecen tus estaciones. Si todavía no tienes equipos, pulsa Agregar equipos al salir del recorrido y usa el código de tu kit.'},
 {view:'stations',detail:true,target:'#edit-station',title:'Abre tu estación',text:'Selecciona una estación para ver sus medidas e historial. Configurar estación abre sus datos de instalación.'},
 {view:'stations',form:'station',target:'[name="name"]',title:'Nombre, ubicación y receptor',text:'Escribe un nombre reconocible, indica la ubicación y selecciona el gateway de tu cuenta. El identificador técnico se conserva. Este formulario es una vista previa; sal del recorrido para editarlo.'},
 {view:'stations',form:'station',target:'[name="bed_height"]',title:'Introduce las medidas reales',text:'Sensor a fondo: desde la cara del sensor hasta el punto de cero de agua. Fondo a tope: altura que representa el 100%. Usa centímetros; no copies las medidas de otra instalación.'},
 {view:'stations',form:'station',target:'[name="yellow_alert"]',title:'Define los avisos',text:'El aviso amarillo debe ser menor que el rojo, y el rojo no debe superar Fondo a tope. Al configurar de verdad, pulsa Guardar y continuar después de revisar todas las medidas.'},
 {view:'gateways',target:'#connect-usb',title:'Vincula el gateway por USB',text:'Esta es la sección Mis gateways. Conecta el receptor con un cable de datos y pulsa Conectar por USB. Elige el puerto y tu gateway, y después Guardar gateway. Si sustituyes otro receptor, se pedirá confirmación.'},
 {view:'gateways',target:'.gateway-info',title:'Prepara Internet',text:'Dentro de Conectar por USB, tras guardar el gateway, utiliza Configurar Wi-Fi con una red de 2.4 GHz. Espera Internet comprobado y una lectura reciente antes de alimentarlo sólo con su cargador. El recorrido no abre puertos ni configura redes.'},
 {view:'entities',target:'#entity-create',title:'Organiza tus lugares',text:'Esta es la sección Mis entidades. Crea grupos por ubicación o uso para organizar tus estaciones. Cada cuenta mantiene sus propias entidades.'},
 {view:'entities',form:'entity',target:'[name="name"]',title:'Crea una entidad y asigna estaciones',text:'Aquí escribes el nombre del grupo. Al salir del recorrido, guarda tu entidad; luego abre Configurar estación y selecciónala en Entidad. Puedes consultar sus estaciones desde esta sección.'},
 {view:'stations',target:'#stations-list',title:'Consulta tus lecturas',text:'La distancia del sensor y el nivel calculado son datos distintos. Abre una estación para ver el historial y exportarlo. Revisa siempre la hora de la última lectura; una lectura antigua no confirma el nivel actual.'}
];

export function installSetupTour(ctx){
 const {$,escape}=ctx;let index=0,active=false,highlight=null;
 const panel=document.createElement('section');panel.id='setup-tour';panel.className='setup-tour';panel.hidden=true;panel.setAttribute('role','region');panel.setAttribute('aria-label','Recorrido de configuración');
 document.body.append(panel);
 function clear(){highlight?.classList.remove('tour-highlight');highlight=null;panel.hidden=true;document.body.classList.remove('tour-running');document.body.append(panel);}
 function stop(){active=false;clear();if($('modal').open)$('modal').close();}
 function show(){
  clear();const item=tourSteps[index];if($('modal').open)$('modal').close();ctx.switchView(item.view);
  let available=true;
  if(item.form==='station')available=ctx.previewStation();else if(item.form==='entity')ctx.previewEntity();else if(item.detail)available=ctx.previewDetail();
  if(item.form&&available){
   // Preview the real fields, but never submit or change equipment during the tour.
   $('modal-content').querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=true);
   $('modal').append(panel);
  }
  panel.innerHTML=`<div class="tour-heading"><span class="eyebrow">PASO ${index+1} DE ${tourSteps.length}</span><button id="tour-close" class="icon-button" aria-label="Cerrar recorrido">×</button></div><h2 id="tour-title" tabindex="-1">${escape(item.title)}</h2><p>${escape(available?item.text:'Cuando agregues tu primera estación podrás abrir aquí su configuración. Continúa para conocer las demás secciones.')}</p><div class="tour-actions"><button id="tour-prev" class="secondary" ${index?'':'disabled'}>Anterior</button><button id="tour-next" class="primary">${index===tourSteps.length-1?'Terminar recorrido':'Siguiente'}</button></div>`;
  panel.hidden=false;document.body.classList.add('tour-running');
  highlight=available?(item.form?$('modal-content'):document).querySelector(item.target):document.querySelector('#stations-list');highlight?.classList.add('tour-highlight');highlight?.scrollIntoView({block:'center',behavior:'instant'});
  $('tour-close').onclick=stop;$('tour-prev').onclick=()=>{index--;show()};$('tour-next').onclick=async()=>{if(index<tourSteps.length-1){index++;show();return}try{await ctx.complete();stop()}catch{ctx.showToast('No se pudo guardar el avance. Puedes volver a consultar el recorrido.')}};
  $('tour-title').focus({preventScroll:true});
 }
 return {start(){active=true;index=0;show()},stop,get active(){return active}};
}
