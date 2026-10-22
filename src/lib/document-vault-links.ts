export const vaultID=(ref:string)=>/^vault:([a-f0-9-]{36})$/.exec(ref)?.[1]||null;
export const vaultDownload=(ref:string)=>vaultID(ref)?'/api/sales/vault?id='+encodeURIComponent(vaultID(ref)!):null;
