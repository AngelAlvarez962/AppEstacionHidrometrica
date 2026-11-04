const names={normal:'Normal',yellow:'Aviso amarillo',red:'Alerta roja',error:'Error del sensor',offline:'Sin comunicación',radio:'Estación sin señal',desconocido:'Sin datos'};
export function installContinuity(ctx){
 const {$,api,escape,openModal,getData,getDemo,getUser}=ctx;
 const stamp=x=>x?new Date(x).toLocaleString('es-MX'):'—';
 async function show(){try{
  const runs=getDemo()?[]:await api('POST',{action:'watch-list'});
  const own=getData().stations.filter(s=>!s.setup_pending&&s.deleted_at==null&&getData().kits.some(k=>k.id===s.kit_id&&k.owner_id===getUser()?.id));
  openModal('Prueba de continuidad','<p class="modal-copy">Registro cada hora y al cambiar de estado. Continúa hasta que la detengas, aunque descargues el archivo.</p><label>Estación<select id="watch-station">'+own.map(s=>'<option value="'+escape(s.id)+'">'+escape(s.name)+'</option>').join('')+'</select></label><label>Objetivo de la prueba<select id="watch-days">'+[1,2,3,4,5,6,7].map(n=>'<option value="'+n+'">'+(n===1?'24 horas':n+' días')+'</option>').join('')+'</select></label><button id="watch-start" class="primary" '+(!own.length||getDemo()?'disabled':'')+'>Iniciar registro</button><p class="modal-copy">'+(getDemo()?'La demo no guarda pruebas.':'Detecta ausencia de datos tras 90 segundos; la revisión se realiza cada minuto. No determina la causa física de una falla.')+'</p><div class="watch-runs">'+runs.map(r=>'<article class="support-card"><strong>'+escape(getData().stations.find(s=>s.id===r.station_id)?.name||'Estación')+'</strong><p>'+stamp(r.started_at)+' · '+(r.stopped_at?'Detenida':'Registrando')+'</p><small>Objetivo: '+stamp(r.ends_at)+'</small><div class="modal-actions"><button class="secondary" data-watch-download="'+r.id+'">Descargar CSV</button>'+(!r.stopped_at?'<button class="secondary" data-watch-stop="'+r.id+'">Detener registro</button>':'')+'</div></article>').join('')+'</div>');
  $('watch-start').onclick=async()=>{const b=$('watch-start');b.disabled=true;try{await api('POST',{action:'watch-start',id:$('watch-station').value,days:Number($('watch-days').value)});await show()}catch(e){$('modal-status').textContent=e.message;b.disabled=false}};
  $('modal-content').querySelectorAll('[data-watch-stop]').forEach(b=>b.onclick=async()=>{try{await api('POST',{action:'watch-stop',id:b.dataset.watchStop});await show()}catch(e){$('modal-status').textContent=e.message}});
  $('modal-content').querySelectorAll('[data-watch-download]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{
   const data=await api('POST',{action:'watch-logs',id:b.dataset.watchDownload});
   const cell=v=>'"'+String(v??'').replaceAll('"','""')+'"';
   const lines=[['Fecha UTC','Evento','Estado','Última lectura UTC','Distancia cm (última lectura)','Nivel cm (sólo válido)'],...data.rows.map(r=>[r.observed_at,r.kind,names[r.status]||r.status,r.last_reading,r.distance_cm,r.level_cm])];
   const url=URL.createObjectURL(new Blob(['\ufeff'+lines.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='continuidad-'+b.dataset.watchDownload+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('modal-status').textContent=data.limited?'Archivo limitado: descarga el resto con soporte.':'Registro descargado. La prueba continúa.';
  }catch(e){$('modal-status').textContent=e.message}finally{b.disabled=false}});
 }catch(e){ctx.showToast(e.message)}}
 const b=document.createElement('button');b.className='secondary';b.id='continuity-open';b.textContent='Prueba de continuidad';b.onclick=show;document.querySelector('.monitoring-tools').append(b);
}
