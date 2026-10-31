import type {Metadata} from 'next';
import Link from 'next/link';
import {ArrowRight, BadgeCheck, Building2, KeyRound, LockKeyhole, LogOut, ShieldCheck} from 'lucide-react';
import {LoginSessionStatus} from '@/components/auth/LoginSessionStatus';

export const metadata: Metadata = {
  title: 'Login INDIA | Technotama',
  description: 'Masuk ke INDIA Enterprise ERP & PSA melalui Cloudflare Access dan hak akses sesuai role.',
};

/**
 * Human-facing login entry only. Cloudflare Access owns authentication/OTP;
 * authorizeBoQ on the server verifies JWT, active D1 membership and resource policy.
 * Never accept passwords, OTPs or client-asserted roles in this page.
 */
export default function IndiaLoginPage() {
  return (
    <main className="relative isolate min-h-[100dvh] overflow-x-hidden bg-[#080f23] text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_10%_15%,rgba(78,45,142,0.38),transparent_52%),radial-gradient(ellipse_at_90%_90%,rgba(6,182,212,0.09),transparent_46%)]" />
      <div className="relative mx-auto grid min-h-[100dvh] w-full max-w-6xl items-center gap-10 px-4 py-8 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16 lg:py-12">
        <section className="mx-auto hidden w-full max-w-xl flex-col gap-12 py-8 lg:flex" aria-label="Tentang platform INDIA">
          <header className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10">
              <ShieldCheck className="h-7 w-7 text-cyan-300" aria-hidden="true" />
            </span>
            <div>
              <p className="text-2xl font-extrabold tracking-tight">INDIA</p>
              <p className="text-xs font-semibold tracking-wide text-slate-300">TECHNOTAMA · ENTERPRISE PLATFORM</p>
            </div>
          </header>

          <div className="space-y-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Cybersecurity Enterprise ERP + PSA</p>
            <h2 className="max-w-lg text-4xl font-bold leading-[1.15] tracking-tight xl:text-5xl">
              Satu platform untuk operasional bisnis dan layanan keamanan siber.
            </h2>
            <p className="max-w-lg text-base leading-7 text-slate-300">
              Kelola alur Marketing, Sales, Presales, Project Delivery, Finance, Procurement, dan Cybersecurity Operations dalam satu workspace berbasis peran.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <Building2 className="mb-3 h-5 w-5 text-cyan-300" aria-hidden="true" />
              <p className="text-sm font-bold">Terintegrasi</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">ERP, CRM dan PSA</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <KeyRound className="mb-3 h-5 w-5 text-cyan-300" aria-hidden="true" />
              <p className="text-sm font-bold">Berbasis role</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">Menu sesuai izin</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <BadgeCheck className="mb-3 h-5 w-5 text-cyan-300" aria-hidden="true" />
              <p className="text-sm font-bold">Terverifikasi</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">Audit & identitas</p>
            </div>
          </div>
          <p className="text-xs text-slate-400">© 2026 Technotama · Internal Business Platform</p>
        </section>

        <section aria-labelledby="login-heading" className="mx-auto w-full max-w-md">
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 text-slate-900 shadow-[0_32px_90px_rgba(0,0,0,0.32)] sm:p-9">
            <div className="mb-7 flex items-center gap-3 lg:hidden">
              <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#2B124C] to-indigo-900">
                <ShieldCheck className="h-6 w-6 text-cyan-300" />
              </span>
              <div>
                <p className="text-xl font-extrabold tracking-tight">INDIA</p>
                <p className="text-xs text-slate-500">Technotama Enterprise Platform</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-[#522b86]">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> Akses perusahaan
            </span>
            <h1 id="login-heading" className="mt-5 text-3xl font-bold tracking-tight text-slate-950">Login INDIA</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Masuk dengan email perusahaan yang terdaftar. Jika diminta, selesaikan verifikasi identitas di halaman resmi Cloudflare Access.
            </p>

            <LoginSessionStatus />

            <Link href="/" className="mt-6 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#2B124C] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#43206e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600">
              <LockKeyhole className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="flex-1 text-center">Masuk dengan Cloudflare Access</span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Link>
            <a href="/cdn-cgi/access/logout" className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-violet-600">
              <LogOut className="h-4 w-4" aria-hidden="true" /> Logout / Ganti akun
            </a>

            <div className="mt-7 space-y-3 border-t border-slate-200 pt-5">
              <p className="flex items-start gap-2 text-xs leading-5 text-slate-600">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                Akses dilindungi Cloudflare Access. INDIA tidak menyimpan password atau kode OTP pengguna.
              </p>
              <p className="text-xs leading-5 text-slate-500">
                Belum terdaftar atau role tidak sesuai? Hubungi Administrator INDIA untuk aktivasi akun, unit kerja dan izin akses.
              </p>
            </div>
          </div>
          <p className="mt-5 text-center text-xs leading-5 text-slate-400 lg:hidden">© 2026 Technotama · Secure Enterprise Access</p>
        </section>
      </div>
    </main>
  );
}
