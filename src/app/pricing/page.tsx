import {redirect} from 'next/navigation';
type Params={opportunity_id?:string|string[]};
type Props={searchParams:Promise<Params>};
/** Compatibility route only: data and approvals reside in the authenticated D1 workflow. */
export default async function LegacyRoute({searchParams}:Props){
 const params=await searchParams;
 const supplied=params?.opportunity_id;
 const id=typeof supplied==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(supplied)?supplied:null;
 redirect('/boq'+(id?'?opportunity_id='+encodeURIComponent(id):''));
}
