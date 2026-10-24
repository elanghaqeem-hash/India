import type {D1DB} from './boq-auth';
import {TENANT} from './sales-workflow';
export const jakartaDate=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
export const periodOK=(x:unknown):x is string=>typeof x==='string'&&/^20\d\d-(0[1-9]|1[0-2])$/.test(x);
export const txt=(x:unknown,max=2000)=>typeof x==='string'&&x.trim().length<=max?x.trim():'';
export const positive=(x:unknown,max=1e14):x is number=>typeof x==='number'&&Number.isFinite(x)&&x>0&&x<max;
export const integer=(x:unknown,max=1e14):x is number=>positive(x,max)&&Number.isSafeInteger(x);
export const operationEvent=(db:D1DB,area:string,id:string,action:string,email:string,data:unknown)=>db.prepare('INSERT INTO india_operations_events(id,tenant_id,area,entity_id,action,actor_email,snapshot_json) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),TENANT,area,id,action,email,JSON.stringify(data));
export const csvText=(head:string[],rows:unknown[][])=>'\uFEFF'+[head,...rows].map(r=>r.map(x=>'"'+(typeof x==='number'?String(x):String(x??'').replace(/^[\s]*[=+@-]/,m=>"'"+m)).replace(/"/g,'""')+'"').join(',')).join('\r\n');
export function financialSum(xs:number[]){const total=xs.reduce((a,x)=>{if(!Number.isFinite(x))throw Error('Nilai finansial tidak valid');return a+BigInt(Math.round(x*100));},0n);if(total>BigInt(Number.MAX_SAFE_INTEGER)||total< -BigInt(Number.MAX_SAFE_INTEGER))throw Error('Presisi agregasi terlampaui');return Number(total)/100;}
