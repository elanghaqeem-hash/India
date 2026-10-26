'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
const menus=[['Registrasi User','/boq/users'],['Parameter','/settings/system'],['Opsi','/settings/options'],['API Key','/settings/ai']] as const;
export default function AdminNavigation(){
 const pathname=usePathname();
 return <nav aria-label="Administrasi khusus Admin" className="flex flex-wrap gap-2">{menus.map(([label,href])=><Link key={href} href={href} aria-current={pathname===href?'page':undefined} className={'min-h-11 rounded-xl border px-4 py-3 text-xs font-bold '+(pathname===href?'border-indigo-800 bg-indigo-800 text-white':'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>{label}</Link>)}</nav>;
}
