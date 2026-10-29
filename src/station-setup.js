export function suggestedAlerts(capacity){
 const n=Number(capacity);if(!Number.isFinite(n)||n<.1||n>600)return null;
 const red=Math.max(.1,Math.floor(n*8)/10),yellow=Math.max(0,Math.min(Math.floor(n*6),Math.round(red*10)-1)/10);
 return {yellow_alert:yellow,red_alert:red};
}
export function installAlertSuggestions(form){
 const fields=form.elements,manual=new Set(['yellow_alert','red_alert'].filter(k=>fields[k].value!==''));
 const suggest=force=>{const values=suggestedAlerts(fields.capacity_height.value);if(!values)return;for(const key of Object.keys(values))if(force||!manual.has(key))fields[key].value=values[key];};
 for(const key of ['yellow_alert','red_alert'])fields[key].addEventListener('input',()=>manual.add(key));
 fields.capacity_height.addEventListener('input',()=>suggest(false));
 form.querySelector('#suggest-alerts').onclick=()=>{manual.clear();suggest(true)};
 suggest(false);
}
