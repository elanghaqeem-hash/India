'use client';
import {useEffect,useRef,useState} from 'react';
type Stored={id:string;release_id:string;kind:string;file_name:string;sha256:string;byte_length:number};
type Props={opportunityId:string;kind:string;disabled?:boolean;onSelect:(reference:string,sha:string,name:string)=>void};
export default function VaultPicker({opportunityId,kind,disabled=false,onSelect}:Props){
 const [files,setFiles]=useState<Stored[]>([]),[release,setRelease]=useState(''),[role,setRole]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>{
  const abort=new AbortController();controller.current=abort;setFiles([]);setRelease('');setMessage('');setBusy(false);
  if(opportunityId)void Promise.all([
   fetch('/api/sales/lifecycle?opportunity_id='+encodeURIComponent(opportunityId),{cache:'no-store',signal:abort.signal}).then(r=>r.json()),
   fetch('/api/sales/vault?opportunity_id='+encodeURIComponent(opportunityId),{cache:'no-store',signal:abort.signal}).then(r=>r.json())
  ]).then(([flow,docs])=>{if(abort.signal.aborted)return;if(!flow.success||!docs.success)throw Error(flow.message||docs.message||'Dokumen belum tersedia');setRelease(flow.releases.find((x:{status:string})=>x.status!=='superseded')?.id||'');setRole(flow.role);setFiles(docs.documents);}).catch(e=>{if(!abort.signal.aborted)setMessage(e.message);});
  return()=>abort.abort();
 },[opportunityId,kind]);
 async function upload(file:File|null){
  if(!file||!release)return;const abort=controller.current;if(!abort)return;
  onSelect('','','');setBusy(true);setMessage('');
  try{
   if(file.size===0||file.size>8*1024*1024)throw Error('Pilih file berukuran 1 byte sampai 8 MB.');
   const query=new URLSearchParams({opportunity_id:opportunityId,release_id:release,kind,filename:file.name});
   const r=await fetch('/api/sales/vault?'+query,{method:'POST',credentials:'same-origin',headers:{'Content-Type':file.type||'application/octet-stream'},body:file,signal:abort.signal});
   const x=await r.json();if(!r.ok||!x.success)throw Error(x.message||'Upload gagal');
   if(abort.signal.aborted)return;
   setFiles(v=>[{id:x.id,release_id:release,kind,file_name:x.file_name,sha256:x.sha256,byte_length:x.byte_length},...v]);onSelect(x.reference,x.sha256,x.file_name);setMessage('Dokumen asli tersimpan. Referensi dan checksum sudah terisi.');
  }catch(e){if(!abort.signal.aborted)setMessage(e instanceof Error?e.message:String(e));}finally{if(!abort.signal.aborted)setBusy(false);}
 }
 const canUpload=['admin','sales'].includes(role)||(role==='presales'&&kind==='proposal');
 return <section className="min-w-0 space-y-2 rounded-xl border border-cyan-200 bg-cyan-50/50 p-3" aria-label="Document Vault">
  <label className="block text-xs font-bold">Upload dokumen asli ke Document Vault
   <input type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.eml" disabled={disabled||busy||!release||!canUpload} onChange={e=>{void upload(e.target.files?.[0]||null);e.target.value='';}} className="mt-2 block w-full min-w-0 text-xs"/>
  </label>
  <p className="text-[11px] leading-relaxed text-slate-600">Maksimum 8 MB. Dokumen terenkripsi dan terikat pada versi penawaran. Unduhan diperiksa sesuai hak akses.</p>
  {busy&&<p role="status" className="text-xs">Menyimpan dokumen…</p>}
  {message&&<p role="status" className="break-words text-xs">{message}</p>}
  {!release&&<p className="text-xs text-slate-600">Validasi scope Presales untuk membuka paket penawaran terlebih dahulu.</p>}
  {files.filter(x=>x.kind===kind).map(x=><div key={x.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg bg-white p-2 text-xs">
   <a className="min-w-0 flex-1 break-all font-semibold text-blue-700 underline" href={'/api/sales/vault?id='+encodeURIComponent(x.id)}>{x.file_name}</a>
   {x.release_id===release&&canUpload&&<button type="button" disabled={disabled||busy} className="rounded border px-2 py-1 disabled:opacity-40" onClick={()=>onSelect('vault:'+x.id,x.sha256,x.file_name)}>Gunakan</button>}
  </div>)}
 </section>;
}
