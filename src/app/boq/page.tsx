'use client';
import React,{useEffect,useState} from 'react';
type Item={description:string;quantity:number;unit:string;unit_price:number;service_type:string};
type Doc={id:string;quotation_number:string;customer_name:string;project_name:string;status:string;version:number;grand_total:number;line_items:Item[];vat_rate:number;payment_terms:string;service_type:string;cost_items?:{code:string;amount:number}[]};
const blank=()=>({quotation_number:'',customer_name:'',project_name:'',service_type:'VAPT',vat_rate:0,payment_terms:'30-50-20',line_items:[{description:'',quantity:1,unit:'Paket',unit_price:0,service_type:'VAPT'}] as Item[]});
export default function BoQPage(){
 const [list,setList]=useState<Doc[]>([]),[selected,setSelected]=useState<Doc|null>(null);
 const [form,setForm]=useState(blank()),[role,setRole]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
 const [costs,setCosts]=useState<Record<string,string>>({});
 const isFinance=['finance','admin'].includes(role);
 const canEdit=['finance','admin','presales','sales'].includes(role)&&(!selected||selected.status==='draft');
 const load=async()=>{try{const r=await fetch('/api/boq',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.message);setList(d.boqs||[]);setRole(d.role);}catch(e){setMsg(String(e));}};
 useEffect(()=>{void load()},[]);
 const choose=(d:Doc)=>{setSelected(d);setForm({...blank(),...d});setCosts(Object.fromEntries((d.cost_items||[]).map(x=>[x.code,String(x.amount)])));setMsg('');};
 const change=(key:string,value:any)=>setForm(p=>({...p,[key]:value}));
 const line=(i:number,key:keyof Item,v:any)=>setForm(p=>({...p,line_items:p.line_items.map((x,j)=>i===j?{...x,[key]:v}:x)}));
 const call=async(action:string)=>{
  setBusy(true);setMsg('');
  try{
   const body:any=selected?{action,payload:{...form}}:{...form};
   if(isFinance){const val=['A','B','C','D','E'].filter(x=>costs[x]!==undefined&&costs[x]!=='').map(code=>({code,amount:Number(costs[code])}));
     if(selected)body.payload.cost_items=val;else body.cost_items=val;}
   if(action==='reject')body.reason=prompt('Alasan penolakan')||'';
   if(action==='approve')body.reason=prompt('Alasan pengecualian margin jika di bawah 25%; jika tidak, kosongkan:')||'';
   const endpoint=selected?'/api/boq/'+selected.id:'/api/boq';
   const response=await fetch(endpoint,{method:selected?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const result=await response.json();if(!response.ok)throw Error(result.message);
   await load();setSelected(null);setForm(blank());setCosts({});setMsg('Berhasil: '+action);
  }catch(e){setMsg(String(e));}finally{setBusy(false);}
 };
 const download=async(format:string)=>{
  if(!selected)return;setBusy(true);
  try{const r=await fetch('/api/boq/export?id='+encodeURIComponent(selected.id)+'&format='+format);if(!r.ok){const j=await r.json();throw Error(j.message);}
  const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='DefendIT360_'+format+'_'+selected.quotation_number.replace(/[^a-zA-Z0-9]/g,'-')+'.xlsx';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }catch(e){setMsg(String(e));}finally{setBusy(false);}
 };
 return <main className="min-w-0 space-y-5 pb-24"><header className="flex flex-wrap justify-between gap-3">
   <div><h1 className="text-xl font-bold text-slate-900">BoQ Management · DefendIT360</h1><p className="text-xs text-slate-500">D1 · Peran {role||'belum terautentikasi'} · Excel</p></div>
   <button className="rounded-lg bg-blue-700 px-3 py-2 text-xs text-white" onClick={()=>{setSelected(null);setForm(blank());setCosts({});}}>+ BoQ Baru</button>
  </header>{msg&&<p role="status" className="rounded-lg border border-blue-200 p-3 text-xs">{msg}</p>}
  <div className="grid gap-4 lg:grid-cols-[240px_1fr]"><aside className="space-y-2">
   <p className="text-xs font-bold">BoQ Tersimpan</p>{list.length===0?<p className="text-xs text-slate-500">Belum ada transaksi</p>:list.map(x=><button key={x.id} onClick={()=>choose(x)}
   className="block w-full rounded-lg border bg-white p-3 text-left text-xs"><b>{x.customer_name}</b><span className="mt-1 block">{x.quotation_number} v{x.version}</span><span className="text-slate-500">{x.status} · Rp {x.grand_total.toLocaleString('id-ID')}</span></button>)}
  </aside><section className="min-w-0 space-y-4 rounded-xl border bg-white p-4">
   <h2 className="font-bold">{selected?'Detail / Revisi BoQ':'Draft BoQ Baru'}</h2>
   <div className="grid gap-3 sm:grid-cols-2">{([
     ['customer_name','Pelanggan'],['project_name','Proyek'],['quotation_number','Nomor Quotation']
    ] as const).map(([k,l])=><label key={k} className="text-xs">{l}<input disabled={!canEdit} value={form[k]} onChange={e=>change(k,e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm"/></label>)}
    <label className="text-xs">Jenis layanan<select disabled={!canEdit} value={form.service_type} onChange={e=>change('service_type',e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm">{['VAPT','SOC','CTI','ISO','PDP','Hardening','IR','GRC','DFIR','TECHNOLOGY','TRAINING','Lainnya'].map(x=><option key={x}>{x}</option>)}</select></label>
    <label className="text-xs">PPN (%)<input disabled={!canEdit} type="number" min="0" max="100" value={form.vat_rate*100} onChange={e=>change('vat_rate',Number(e.target.value)/100)} className="mt-1 w-full rounded-lg border p-2 text-sm"/></label>
    <label className="text-xs">Termin<select disabled={!canEdit} value={form.payment_terms} onChange={e=>change('payment_terms',e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm">{['30-50-20','30-60-10','50-50','100'].map(x=><option key={x}>{x}</option>)}</select></label></div>
   <div className="flex justify-between"><b className="text-sm">Produk / Layanan</b><button disabled={!canEdit} className="text-xs text-blue-700" onClick={()=>change('line_items',[...form.line_items,{description:'',quantity:1,unit:'Paket',unit_price:0,service_type:form.service_type}])}>+ Item</button></div>
   {form.line_items.map((x,i)=><div key={i} className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2 sm:grid-cols-5">
    <input aria-label="Deskripsi" disabled={!canEdit} className="col-span-2 rounded border p-2 text-xs sm:col-span-2" placeholder="Produk, scope atau SKU" value={x.description} onChange={e=>line(i,'description',e.target.value)}/>
    <input aria-label="Volume" disabled={!canEdit} className="rounded border p-2 text-xs" type="number" min="0.001" step="0.001" value={x.quantity} onChange={e=>line(i,'quantity',Number(e.target.value))}/>
    <input aria-label="Harga per unit" disabled={!canEdit} className="rounded border p-2 text-xs" type="number" min="0" value={x.unit_price} onChange={e=>line(i,'unit_price',Number(e.target.value))}/>
    <button disabled={!canEdit||form.line_items.length===1} onClick={()=>change('line_items',form.line_items.filter((_,j)=>j!==i))} className="text-xs text-red-700">Hapus</button></div>)}
   {isFinance&&<div className="space-y-2 border-t pt-4"><h3 className="font-bold text-sm">HPP Internal (Finance)</h3><p className="text-xs text-slate-500">Isi seluruh A-E; nol hanya jika biaya tidak berlaku.</p>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{['A','B','C','D','E'].map(k=><label key={k} className="text-xs">Komponen {k}<input disabled={!canEdit} className="mt-1 w-full rounded border p-2" type="number" min="0" placeholder="Belum diisi" value={costs[k]||''} onChange={e=>setCosts(p=>({...p,[k]:e.target.value}))}/></label>)}</div></div>}
   <div className="flex flex-wrap gap-2 border-t pt-4">{canEdit&&<button disabled={busy} onClick={()=>call(selected?'update':'create')} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white">Simpan ke D1</button>}
     {selected?.status==='draft'&&canEdit&&<button disabled={busy} onClick={()=>call('submit')} className="rounded-lg border p-2 text-xs">Submit Approval</button>}
     {selected?.status==='submitted'&&['admin','approver'].includes(role)&&<><button disabled={busy} onClick={()=>call('approve')} className="rounded-lg border p-2 text-xs">Approve</button><button disabled={busy} onClick={()=>call('reject')} className="rounded-lg border p-2 text-xs">Reject</button></>}
     {selected&&['submitted','approved','rejected'].includes(selected.status)&&canEdit&&<button disabled={busy} onClick={()=>call('revise')} className="rounded-lg border p-2 text-xs">Buat Revisi</button>}</div>
   {selected&&<div className="flex flex-wrap gap-2 border-t pt-4"><b className="w-full text-xs">Download Excel</b>
     <button disabled={busy} onClick={()=>download('customer')} className="rounded-lg bg-slate-900 p-2 text-xs text-white">Customer BoQ</button>
     {isFinance&&['standard','onsite'].map(x=><button key={x} disabled={busy} onClick={()=>download(x)} className="rounded-lg border p-2 text-xs">Internal {x}</button>)}</div>}
  </section></div></main>;
}
