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
/** Validate at write time: never trust the selected names/codes from a browser. */
export async function canonicalPostalFields(db:D1DB,fields:Record<string,string>){
 const postal=fields.hq_postal||'',village=fields.hq_village_code||'';
 if(!postal&&!village)return fields; // Legacy customers may not yet have a postal address.
 if(!postalRegex.test(postal)||!village)throw new Error('Pilih kode pos 5 digit dan desa/kelurahan dari database.');
 const area=await db.prepare(
  'SELECT region_code,postal_code,province_code,province_name,regency_code,regency_name,district_code,district_name,village_name,village_kind FROM india_postal_areas WHERE region_code=? AND postal_code=?'
 ).bind(village,postal).first<PostalArea>();
 if(!area)throw new Error('Kombinasi kode pos dan wilayah tidak terdaftar; periksa pilihan alamat.');
 // Reject stale selection, not merely silently overwrite it.
 for(const [key,value] of Object.entries(fieldPatch(area))){
  if(fields[key]&&fields[key]!==value)throw new Error('Alamat wilayah berubah atau tidak konsisten. Pilih kembali desa/kelurahan.');
 }
 return {...fields,...fieldPatch(area)};
}
