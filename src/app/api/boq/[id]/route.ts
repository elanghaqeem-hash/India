import { NextResponse } from 'next/server';
import { authorizeBoQ, privateHeaders } from '@/lib/boq-auth';
import { validateBoQ,boqTotals,can } from '@/lib/boq-domain';
export const dynamic='force-dynamic';
type Stored={id:string;tenant_id:string;status:string;version:number;quotation_number:string;line_items_json:string;cost_items_json:string;vat_rate:number;project_name:string;customer_name:string;service_type:string;opportunity_id:string|null;payment_terms:string;notes:string|null;created_by:string;updated_at:string};
const answer=(x:unknown,s=200)=>NextResponse.json(x,{status:s,headers:privateHeaders});
const err=(m:string,s=400)=>answer({success:false,message:m},s);
export async function PATCH(req:Request,ctx:{params:Promise<{id:string}>}){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;
 const i=auth.identity;
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return err('Origin ditolak',403);
 try{
  const {id}=await ctx.params,p=await req.json(),action=p.action;
  const row=await i.db.prepare('SELECT * FROM india_boq WHERE id=? AND tenant_id=?').bind(id,'defendit360').first<Stored>();
  if(!row)return err('BoQ tidak ditemukan',404);
  let target=id;
  if(action==='update'){
   if(row.status!=='draft'||!can(i.role,'edit_draft'))return err('Hanya draft yang boleh diperbarui',403);
   const previous={...row,line_items:JSON.parse(row.line_items_json),cost_items:JSON.parse(row.cost_items_json)};
   if(p.payload?.cost_items!==undefined&&!can(i.role,'edit_cost'))return err('Tidak memiliki izin mengubah HPP',403);
   const v=validateBoQ({...previous,...p.payload});
   const changed=await i.db.prepare("UPDATE india_boq SET project_name=?,customer_name=?,quotation_number=?,service_type=?,opportunity_id=?,vat_rate=?,payment_terms=?,line_items_json=?,cost_items_json=?,notes=?,updated_by=?,updated_at=? WHERE id=? AND tenant_id=? AND status='draft' AND updated_at=?")
   .bind(v.project_name,v.customer_name,v.quotation_number,v.service_type,v.opportunity_id||null,v.vat_rate,
    v.payment_terms,JSON.stringify(v.line_items),JSON.stringify(v.cost_items||[]),v.notes||null,
    i.email,new Date().toISOString(),id,'defendit360',row.updated_at).run();
   if((changed as any).meta?.changes===0)return err('Versi data berubah, muat ulang',409);
  }else if(action==='submit'){
   if(row.status!=='draft'||!can(i.role,'submit'))return err('Tidak diizinkan submit',403);
   await i.db.prepare("UPDATE india_boq SET status='submitted',updated_by=?,updated_at=? WHERE id=? AND status='draft'").bind(i.email,new Date().toISOString(),id).run();
  }else if(action==='approve'){
   if(row.status!=='submitted'||!can(i.role,'approve'))return err('Approver diperlukan',403);
   if(row.created_by===i.email&&i.role!=='admin')return err('Segregation of Duties: pembuat tidak boleh menyetujui',403);
   const t=boqTotals(JSON.parse(row.line_items_json),JSON.parse(row.cost_items_json),row.vat_rate);
   if(!t.complete)return err('HPP A-E harus lengkap',409);
   if((t.margin??0)<25&&(i.role!=='admin'||String(p.reason||'').trim().length<15))
    return err('Margin di bawah 25%; alasan exception Admin minimal 15 karakter',409);
   await i.db.prepare("UPDATE india_boq SET status='approved',approved_by=?,updated_by=?,updated_at=? WHERE id=? AND status='submitted'")
    .bind(i.email,i.email,new Date().toISOString(),id).run();
  }else if(action==='reject'){
   if(row.status!=='submitted'||!can(i.role,'approve'))return err('Approver diperlukan',403);
   if(String(p.reason||'').trim().length<5)return err('Alasan penolakan diperlukan');
   await i.db.prepare("UPDATE india_boq SET status='rejected',updated_by=?,updated_at=? WHERE id=? AND status='submitted'")
    .bind(i.email,new Date().toISOString(),id).run();
  }else if(action==='revise'){
   if(!can(i.role,'create')||!['approved','rejected','submitted'].includes(row.status))return err('Revisi tidak diizinkan',403);
   target=crypto.randomUUID();
   await i.db.prepare("INSERT INTO india_boq(id,tenant_id,project_name,customer_name,quotation_number,service_type,opportunity_id,version,status,vat_rate,payment_terms,line_items_json,cost_items_json,notes,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(target,'defendit360',row.project_name,row.customer_name,row.quotation_number,row.service_type,row.opportunity_id,
     row.version+1,'draft',row.vat_rate,row.payment_terms,row.line_items_json,row.cost_items_json,row.notes,i.email,i.email).run();
  }else return err('Aksi tidak dikenal');
  await i.db.prepare('INSERT INTO india_audit_log(id,tenant_id,boq_id,action,actor_email,summary) VALUES (?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),'defendit360',target,action.toUpperCase(),i.email,String(p.reason||'').slice(0,500)).run();
  return answer({success:true,id:target});
 }catch(e){const message=e instanceof Error?e.message:'Gagal memproses perubahan';return err(message,message.includes('UNIQUE constraint')?409:400);}
}
