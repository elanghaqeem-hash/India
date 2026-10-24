import type {D1DB} from './boq-auth';

export type PostalArea={
 region_code:string;postal_code:string;province_code:string;province_name:string;
 regency_code:string;regency_name:string;district_code:string;district_name:string;
 village_name:string;village_kind:'Desa'|'Kelurahan'
};
export const POSTAL_FIELDS=[
 'hq_postal','hq_province','hq_province_code','hq_regency','hq_regency_code',
 'hq_district','hq_district_code','hq_village','hq_village_code','hq_village_kind'
] as const;
export const postalRegex=/^[0-9]{5}$/;
export const fieldPatch=(area:PostalArea)=>({
 hq_postal:area.postal_code,hq_province:area.province_name,hq_province_code:area.province_code,
 hq_regency:area.regency_name,hq_regency_code:area.regency_code,
 hq_district:area.district_name,hq_district_code:area.district_code,
 hq_village:area.village_name,hq_village_code:area.region_code,hq_village_kind:area.village_kind
});
export async function assertPostalReferenceReady(db:D1DB){
 const meta=await db.prepare("SELECT source_version FROM india_postal_import_state WHERE singleton=1 AND status='ready' AND row_count>=80000 AND province_count=38 AND postal_count>0").first<{source_version:string}>();
 if(!meta)throw new Error('Referensi wilayah nasional belum siap. Hubungi Administrator.');
 return meta.source_version;
}
/**
 * Unified postal lookup. UAT retains its normalized village table; production
 * uses one JSON-array record per postal code to stay below D1 Free daily write
 * limits. Both paths return the exact same canonical PostalArea shape.
 */
export async function findPostalAreasByCode(db:D1DB,postal:string):Promise<PostalArea[]>{
 if(!postalRegex.test(postal))throw new Error('Kode pos harus terdiri dari 5 angka.');
 await assertPostalReferenceReady(db);
 const table=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='india_postal_lookup'")
  .first<{name:string}>();
 if(table){
  const populated=await db.prepare('SELECT 1 AS present FROM india_postal_lookup LIMIT 1').first<{present:number}>();
  if(populated){
   const row=await db.prepare('SELECT areas_json,village_count FROM india_postal_lookup WHERE postal_code=?')
    .bind(postal).first<{areas_json:string;village_count:number}>();
   if(!row)return [];
   const parsed:unknown=JSON.parse(row.areas_json);
   if(!Array.isArray(parsed)||parsed.length!==row.village_count||parsed.length>500||
      parsed.some((area:unknown)=>!area||typeof area!=='object'||
       (area as PostalArea).postal_code!==postal||
       typeof (area as PostalArea).region_code!=='string'||
       typeof (area as PostalArea).province_name!=='string'||
       typeof (area as PostalArea).village_name!=='string')){
    throw new Error('Referensi wilayah pada kode pos ini tidak konsisten. Hubungi Administrator.');
   }
   return parsed as PostalArea[];
  }
 }
 const rows=await db.prepare(
  'SELECT region_code,postal_code,province_code,province_name,regency_code,regency_name,district_code,district_name,village_name,village_kind FROM india_postal_areas WHERE postal_code=? ORDER BY province_name,regency_name,district_name,village_name LIMIT 501'
 ).bind(postal).all<PostalArea>();
 if(rows.results.length>500)throw new Error('Terlalu banyak wilayah untuk satu kode pos.');
 return rows.results;
}
/** Server-side integrity gate. Never trust the region names/codes submitted by a browser. */
export async function canonicalPostalFields(db:D1DB,fields:Record<string,string>){
 const postal=fields.hq_postal||'',village=fields.hq_village_code||'';
 if(!postal&&!village)return fields; // Legacy customers may not yet have a postal address.
 if(!postalRegex.test(postal)||!village)throw new Error('Pilih kode pos 5 digit dan desa/kelurahan dari database.');
 const areas=await findPostalAreasByCode(db,postal);
 const area=areas.find(a=>a.region_code===village);
 if(!area)throw new Error('Kombinasi kode pos dan wilayah tidak terdaftar; periksa pilihan alamat.');
 for(const [key,value] of Object.entries(fieldPatch(area))){
  if(fields[key]&&fields[key]!==value)throw new Error('Alamat wilayah berubah atau tidak konsisten. Pilih kembali desa/kelurahan.');
 }
 return {...fields,...fieldPatch(area)};
}
