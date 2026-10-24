import Link from 'next/link';
/** A mutable browser demo wallet must not masquerade as a real token ledger. */
export default function FlexGuardGate(){
 return <main className="mx-auto max-w-3xl space-y-5 pb-24">
  <header className="rounded-2xl border border-slate-200 bg-white p-6">
   <h1 className="text-xl font-bold text-slate-900">FlexGuard · Token Operations</h1>
   <p className="mt-3 text-sm text-slate-700">Reservasi, konsumsi, refund dan saldo token belum tersedia melalui ledger D1 kanonis yang telah diverifikasi. Operasi wallet legacy dinonaktifkan agar tidak menampilkan saldo fiktif atau menyimpan transaksi di memori browser.</p>
   <p role="status" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">Operational wallet: BLOCKED — menunggu migrasi ledger D1, kontrol idempotency/SoD dan UAT dengan pengguna sah.</p>
   <Link href="/sales/renewals" className="mt-5 inline-flex rounded-lg border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-800">Buka kontrak & renewal yang tercatat di D1 →</Link>
  </header>
 </main>;
}
