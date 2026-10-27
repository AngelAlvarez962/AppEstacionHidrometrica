export function installSidebar(){
 const root=document.documentElement,sidebar=document.querySelector('.sidebar');
 sidebar.id='app-navigation';
 const toggle=document.createElement('button');
 toggle.type='button';toggle.className='sidebar-toggle';toggle.setAttribute('aria-controls',sidebar.id);
 toggle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path class="sidebar-icon-divider" d="M9 4v16"/><path class="sidebar-icon-content" d="M12 8h5m-5 4h5m-5 4h5"/></svg><span class="sidebar-toggle-label">Ocultar menú</span>';
 const apply=collapsed=>{
  root.classList.toggle('sidebar-collapsed',collapsed);
  const label=collapsed?'Desplegar menú':'Contraer menú';
  toggle.setAttribute('aria-expanded',String(!collapsed));toggle.setAttribute('aria-label',label);toggle.title=label;
  toggle.querySelector('.sidebar-toggle-label').textContent=collapsed?'Mostrar menú':'Ocultar menú';
  requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
 };
 let collapsed=false;
 try{collapsed=localStorage.getItem('hi-sidebar-collapsed')==='true'}catch{}
 apply(collapsed);
 toggle.onclick=()=>{
  const next=!root.classList.contains('sidebar-collapsed');apply(next);
  try{localStorage.setItem('hi-sidebar-collapsed',String(next))}catch{}
 };
 sidebar.querySelector('.brand').after(toggle);
 sidebar.addEventListener('transitionend',event=>{if(event.target===sidebar&&event.propertyName==='width')window.dispatchEvent(new Event('resize'))});
 sidebar.addEventListener('pointerover',event=>{const button=event.target.closest('nav button');if(button)button.title=button.textContent.trim()});
 for(const button of sidebar.querySelectorAll('.sidebar-tools button,#signout')){
  const label=button.textContent.trim();button.title=label;button.setAttribute('aria-label',label);
 }
 document.getElementById('guide-open').addEventListener('click',()=>apply(false),{capture:true});
}
