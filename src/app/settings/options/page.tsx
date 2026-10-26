import Link from 'next/link';
import SystemSettings from '@/components/admin/SystemSettings';
export default function OptionsPage(){return <><nav className="mx-auto mb-4 max-w-6xl rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm"><Link href="/settings/option-registry" className="font-bold text-indigo-800 underline underline-offset-4">Kelola Pilihan Dropdown Terstandar</Link><p className="mt-1 text-xs text-slate-600">Tambah, ubah, urutkan dan nonaktifkan master pilihan terpusat; khusus Admin.</p></nav><SystemSettings mode="options"/></>;}
