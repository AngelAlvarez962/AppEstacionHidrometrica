// Retain the original select as the source of values and change events.
const enhanced=new WeakMap();let sequence=0,opened=null;
document.addEventListener('click',event=>{if(opened&&!opened.wrap.contains(event.target))opened.close()});
export function animatedSelect(select,label){
 if(enhanced.has(select))return enhanced.get(select);
 if(!select.id)select.id='choice-'+(++sequence);
 const wrap=document.createElement('div'),button=document.createElement('button'),list=document.createElement('div');
 wrap.className='animated-select';button.type='button';button.className='select-trigger';button.setAttribute('role','combobox');button.setAttribute('aria-label',label);button.setAttribute('aria-haspopup','listbox');
 list.id=select.id+'-options';list.className='select-options';list.setAttribute('role','listbox');list.setAttribute('aria-label',label);button.setAttribute('aria-controls',list.id);
 select.classList.add('animated-select-native');select.tabIndex=-1;select.setAttribute('aria-hidden','true');select.after(wrap);wrap.append(button,list);let active=0;
 const error=document.createElement('span');error.className='select-error';error.id=select.id+'-error';error.setAttribute('role','alert');error.hidden=true;wrap.append(error);button.setAttribute('aria-describedby',error.id);
 select.addEventListener('invalid',event=>{event.preventDefault();error.textContent=select.validationMessage;error.hidden=false;button.setAttribute('aria-invalid','true');button.focus()});
 const options=()=>Array.from(select.options);
 function close(){list.hidden=true;button.setAttribute('aria-expanded','false');if(opened?.wrap===wrap)opened=null}
 function focus(index){const items=Array.from(list.children);if(!items.length)return;active=(index+items.length)%items.length;items[active].focus();items[active].scrollIntoView({block:'nearest'})}
 function sync(){close();error.hidden=true;button.removeAttribute('aria-invalid');button.textContent=select.selectedOptions[0]?.textContent||label;button.disabled=select.disabled;button.setAttribute('aria-required',String(select.required));list.replaceChildren();options().forEach((option,index)=>{
  const item=document.createElement('button');item.type='button';item.tabIndex=-1;item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.selected));item.textContent=option.textContent;item.disabled=option.disabled;item.style.setProperty('--option-delay',Math.min(index,8)*22+'ms');
  item.onclick=event=>{event.preventDefault();select.value=option.value;close();select.dispatchEvent(new Event('change',{bubbles:true}));button.focus()};list.append(item);
 })}
 function open(){opened?.close();opened={wrap,close};list.hidden=false;button.setAttribute('aria-expanded','true');focus(Math.max(0,select.selectedIndex))}
 button.onclick=event=>{event.preventDefault();list.hidden?open():close()};
 wrap.onkeydown=event=>{
  if(event.key==='Escape'){event.preventDefault();close();button.focus()}
  else if(event.key==='Tab')close();
  else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();if(list.hidden){open();return}focus(event.key==='Home'?0:event.key==='End'?list.children.length-1:active+(event.key==='ArrowDown'?1:-1))}
  else if(event.key.length===1&&!/\s/.test(event.key)&&!list.hidden){const found=options().findIndex(option=>option.textContent.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()));if(found>=0){event.preventDefault();focus(found)}}
 };
 select.addEventListener('change',sync);sync();const api={sync};enhanced.set(select,api);
 new MutationObserver(sync).observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','selected','required','label']});return api;
}
export function installAnimatedSelects(){
 const scan=root=>{for(const select of root.querySelectorAll('select')){if(!enhanced.has(select)){const label=select.getAttribute('aria-label')||Array.from(select.closest('label')?.childNodes||[]).filter(node=>node.nodeType===3).map(node=>node.textContent).join('').trim()||'Seleccionar';animatedSelect(select,label)}}};
 scan(document);new MutationObserver(()=>scan(document)).observe(document.body,{childList:true,subtree:true});
}
