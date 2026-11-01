'use client';

import {useEffect,useId,useMemo,useRef,useState} from 'react';
import {Check,ChevronDown,Search} from 'lucide-react';

export type CompactChoice={value:string;label:string;group?:string;disabled?:boolean};
type Props={
 id?:string;label:string;value:string;options:readonly CompactChoice[];
 onChange:(value:string)=>void;
 placeholder?:string;disabled?:boolean;required?:boolean;
 className?:string;name?:string;searchable?:boolean;
};

/**
 * Compact, accessible application-rendered choice picker.
 * Android/iOS native <select> dialogs ignore option font-size; this keeps the
 * 13px menu typography and 40px touch rows consistent on all browsers.
 */
export function CompactSelect({id,label,value,options,onChange,placeholder='— Pilih —',
 disabled=false,required=false,className='',name,searchable}:Props){
 const [open,setOpen]=useState(false);
 const [query,setQuery]=useState('');
 const rootRef=useRef<HTMLDivElement>(null);
 const triggerRef=useRef<HTMLButtonElement>(null);
 const menuRef=useRef<HTMLDivElement>(null);
 const searchRef=useRef<HTMLInputElement>(null);
 const menuId=useId();
 const showSearch=searchable??options.length>=10;
 const visible=useMemo(()=>{
  const q=query.trim().toLocaleLowerCase('id-ID');
  return q?options.filter(item=>(item.label+' '+(item.group||'')).toLocaleLowerCase('id-ID').includes(q)):options;
 },[options,query]);
 const chosen=options.find(item=>item.value===value);
 const selectedLabel=chosen?.label||value||placeholder;
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{
   if(!rootRef.current?.contains(event.target as Node))setOpen(false);
  };
  document.addEventListener('pointerdown',outside);
  return ()=>document.removeEventListener('pointerdown',outside);
 },[open]);
 useEffect(()=>{
  if(!open)return;
  if(showSearch)searchRef.current?.focus();
  else menuRef.current?.querySelector<HTMLButtonElement>('[role="option"]:not(:disabled)')?.focus();
 },[open,showSearch]);
 const close=()=>{setOpen(false);setQuery('');triggerRef.current?.focus();};
 const select=(next:string)=>{onChange(next);close();};
 const moveFocus=(direction:number)=>{
  const items=[...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)')||[])];
  if(!items.length)return;
  const current=items.indexOf(document.activeElement as HTMLButtonElement);
  const next=current<0?(direction>0?0:items.length-1):(current+direction+items.length)%items.length;
  items[next].focus();
 };
 return <div ref={rootRef} className={'ui-compact-select min-w-0 '+(open?'ui-compact-select--open':'')}>
  {name&&<input type="hidden" name={name} value={value}/>}
  <button id={id} ref={triggerRef} type="button" role="combobox" aria-label={label}
   aria-haspopup="listbox" aria-controls={menuId} aria-expanded={open}
   aria-required={required} disabled={disabled}
   className={'ui-compact-select-trigger '+className}
   onClick={()=>{setQuery('');setOpen(old=>!old);}}
   onKeyDown={event=>{
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setOpen(true);}
    if(event.key==='Escape'&&open){event.preventDefault();close();}
   }}>
   <span className={'ui-compact-select-value '+(!value?'ui-compact-select-placeholder':'')}>{selectedLabel}</span>
   <ChevronDown size={16} className="ui-compact-select-chevron" aria-hidden="true"/>
  </button>
  {open&&<>
   <div aria-hidden="true" className="ui-compact-select-scrim" onClick={()=>close()}/>
   <div id={menuId} ref={menuRef} role="listbox" aria-label={label}
    className="ui-compact-select-menu"
    onKeyDown={event=>{
     if(event.key==='Escape'){event.preventDefault();close();}
     else if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();moveFocus(event.key==='ArrowDown'?1:-1);
     }else if(event.key==='Home'){event.preventDefault();menuRef.current?.querySelector<HTMLButtonElement>('[role="option"]:not(:disabled)')?.focus();}
     else if(event.key==='End'){event.preventDefault();const items=menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)');items?.[items.length-1]?.focus();}
    }}>
    {showSearch&&<div className="ui-compact-select-search">
     <Search size={15} aria-hidden="true"/>
     <input ref={searchRef} type="search" aria-label={'Cari '+label} placeholder="Cari pilihan..."
      autoComplete="off" value={query} onChange={event=>setQuery(event.target.value)}/>
    </div>}
    <div className="ui-compact-select-items">
     {visible.length===0&&<p className="ui-compact-select-empty">Tidak ada pilihan sesuai pencarian.</p>}
     {visible.map((item,index)=><div key={item.value} role="presentation">
      {item.group&&(index===0||visible[index-1].group!==item.group)&&<div className="ui-compact-select-group">{item.group}</div>}
      <button type="button" role="option" aria-selected={item.value===value}
       disabled={item.disabled} className="ui-compact-select-option"
       onClick={()=>select(item.value)}>
       <span>{item.label}</span>
       {item.value===value&&<Check size={16} aria-hidden="true"/>}
      </button>
     </div>)}
    </div>
   </div>
  </>}
 </div>;
}
