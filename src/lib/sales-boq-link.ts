import {serviceDefinition} from './sales-workflow';
import type {BoQPayload} from './boq-domain';
type Deal={id:string;company_id:string;title:string;stage:string;created_by:string;data_json:string};
type Account={id:string;legal_name:string};
const name=(x:string)=>x.trim().replace(/\s+/g,' ').toLocaleLowerCase('id-ID');
export function checkBoqLink(data:BoQPayload,deal:Deal|null,account:Account|null,role:string,email:string):string|null{
 if(!data.opportunity_id)return 'BoQ wajib terhubung ke Opportunity ID. Daftarkan atau pilih Opportunity dahulu.';
 if(!deal||!account)return 'Opportunity/Customer Master tidak ditemukan di tenant INDIA.';
 if(['closed_won','closed_lost'].includes(deal.stage))return 'Opportunity sudah ditutup; BoQ harus diproses melalui revisi terkontrol.';
 if(role==='sales'&&deal.created_by.toLowerCase()!==email.toLowerCase())return 'Sales hanya dapat mengubah BoQ milik Opportunity sendiri.';
 if(name(data.customer_name)!==name(account.legal_name))return 'Nama perusahaan pada BoQ harus sama dengan Customer Account.';
 if(name(data.project_name)!==name(deal.title))return 'Nama proyek pada BoQ harus sama dengan Opportunity.';
 const family=(JSON.parse(deal.data_json||'{}') as Record<string,string>).service_family||'';
 const accepted:readonly string[]=serviceDefinition(family).boq;
 if(!accepted.includes(data.service_type))return 'Jenis layanan BoQ tidak sesuai Service Family Opportunity.';
 return null;
}
