// Appearance only: never store account credentials with this preference.
(() => {
 const root=document.documentElement,key='hi-display-theme';
 const system=window.matchMedia('(prefers-color-scheme: dark)');
 let preference=null;
 try{const value=localStorage.getItem(key);if(value==='light'||value==='dark')preference=value}catch{}
 function apply(theme){
  root.dataset.theme=theme;root.style.colorScheme=theme;
  const button=document.getElementById('theme-toggle');
  if(button){const label=theme==='dark'?'Activar modo claro':'Activar modo oscuro';button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(theme==='dark'));button.title=label}
  window.dispatchEvent(new CustomEvent('themechange'));
 }
 apply(preference||(system.matches?'dark':'light'));
 document.addEventListener('DOMContentLoaded',()=>{
  const button=document.getElementById('theme-toggle');if(!button)return;
  apply(root.dataset.theme);
  button.addEventListener('click',()=>{preference=root.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem(key,preference)}catch{}apply(preference)});
 },{once:true});
 system.addEventListener('change',event=>{if(!preference)apply(event.matches?'dark':'light')});
})();
