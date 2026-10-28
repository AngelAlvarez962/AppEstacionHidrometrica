// Retain the original select as the source of values and change events.
export function animatedSelect(select,label){
 const wrap=document.createElement('div'),button=document.createElement('button'),list=document.createElement('div');
 wrap.className='animated-select';button.type='button';button.className='select-trigger';button.setAttribute('role','combobox');button.setAttribute('aria-label',label);button.setAttribute('aria-haspopup','listbox');
 list.id=select.id+'-options';list.className='select-options';list.setAttribute('role','listbox');list.setAttribute('aria-label',label);button.setAttribute('aria-controls',list.id);
 select.hidden=true;select.after(wrap);wrap.append(button,list);let active=0;
 const options=()=>Array.from(select.options);
 function close(){list.hidden=true;button.setAttribute('aria-expanded','false')}
 function focus(index){const items=Array.from(list.children);if(!items.length)return;active=(index+items.length)%items.length;items[active].focus();items[active].scrollIntoView({block:'nearest'})}
 function sync(){close();button.textContent=select.selectedOptions[0]?.textContent||label;button.disabled=select.disabled;list.replaceChildren();options().forEach((option,index)=>{
  const item=document.createElement('button');item.type='button';item.tabIndex=-1;item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.selected));item.textContent=option.textContent;item.disabled=option.disabled;item.style.setProperty('--option-delay',Math.min(index,8)*22+'ms');
  item.onclick=event=>{event.preventDefault();select.value=option.value;close();select.dispatchEvent(new Event('change',{bubbles:true}));button.focus()};list.append(item);
 })}
 function open(){list.hidden=false;button.setAttribute('aria-expanded','true');focus(Math.max(0,select.selectedIndex))}
 button.onclick=event=>{event.preventDefault();list.hidden?open():close()};
 wrap.onkeydown=event=>{
  if(event.key==='Escape'){event.preventDefault();close();button.focus()}
  else if(event.key==='Tab')close();
  else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();if(list.hidden){open();return}focus(event.key==='Home'?0:event.key==='End'?list.children.length-1:active+(event.key==='ArrowDown'?1:-1))}
  else if(event.key.length===1&&!/\s/.test(event.key)&&!list.hidden){const found=options().findIndex(option=>option.textContent.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()));if(found>=0){event.preventDefault();focus(found)}}
 };
 document.addEventListener('click',event=>{if(!wrap.contains(event.target))close()});select.addEventListener('change',sync);sync();return {sync};
}
