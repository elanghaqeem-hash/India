'use client';
import React,{useEffect,useState} from 'react';
type Member={email:string;role:string;active:number;unit_key?:string};
const roles=['admin','marketing','finance','presales','sales','approver','legal','viewer'];
export default function BoQUsers(){
 const [members,setMembers]=useState<Member[]>([]),[email,setEmail]=useState(''),[role,setRole]=useState('viewer'),[error,setError]=useState(''),[units,setUnits]=useState<{setting_key:string;title:string}[]>([]),[unit,setUnit]=useState('');
 const load=async()=>{const r=await fetch('/api/boq/members',{cache:'no-store'}),j=await r.json();if(!r.ok)setError(j.message||'Akses ditolak');else {setMembers(j.users);setUnits(j.units||[]);}};
 useEffect(()=>{void load();},[]);
 const save=async(member:{email:string;role:string;active:boolean;unit_key?:string})=>{
  setError('');
  try{const r=await fetch('/api/boq/members',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(member)});
   const j=await r.json();if(!r.ok)throw Error(j.message);await load();setEmail('');
  }catch(e){setError(String(e));}
 };
 return <main className="space-y-5"><header><h1 className="text-xl font-bold">Users, Roles & Unit Kerja</h1>
  <p className="text-xs text-slate-500">Khusus Admin. Akses Cloudflare Access juga harus mengizinkan identitas sebelum dapat login.</p></header>
  {error&&<p role="alert" className="rounded border border-red-200 p-3 text-xs text-red-800">{error}</p>}
  <section className="flex flex-wrap gap-2 rounded-xl border bg-white p-4"><input type="email" placeholder="email@perusahaan.com" value={email} onChange={e=>setEmail(e.target.value)} className="min-w-48 flex-1 rounded-lg border p-2 text-sm"/>
   <select aria-label="Peran" className="rounded-lg border p-2 text-sm" value={role} onChange={e=>setRole(e.target.value)}>{roles.map(x=><option key={x}>{x}</option>)}</select>
   <select aria-label="Unit kerja" value={unit} onChange={e=>setUnit(e.target.value)} className="rounded-lg border p-2 text-sm"><option value="">Tanpa unit kerja</option>{units.map(x=><option key={x.setting_key} value={x.setting_key}>{x.title}</option>)}</select>
   <button type="button" onClick={()=>void save({email,role,active:true,unit_key:unit})} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white">Tambah / Perbarui</button></section>
  <section className="space-y-2">{members.map(m=><div key={m.email} className="flex flex-wrap items-center gap-3 rounded-lg border bg-white p-3 text-xs">
   <b className="min-w-0 flex-1 break-all">{m.email}</b><span>{m.role} · {m.active?'Aktif':'Nonaktif'} · {m.unit_key||'Tanpa unit'}</span>
   <button type="button" onClick={()=>void save({email:m.email,role:m.role,active:!m.active})} className="rounded-lg border px-3 py-2">{m.active?'Nonaktifkan':'Aktifkan'}</button>
  </div>)}</section></main>;
}
