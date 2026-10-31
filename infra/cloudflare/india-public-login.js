/**
 * INDIA Technotama — public pre-authentication landing page.
 *
 * This Worker intentionally has NO user-data access, cookies, API proxy, or
 * private resource bindings. Clicking "Masuk" navigates to the SEPARATE,
 * Cloudflare Access-protected production Worker at india.elang-haqeem.workers.dev.
 * Access, identity checks, and D1 RBAC are NEVER bypassed.
 */
const PROTECTED_APPLICATION = 'https://india.elang-haqeem.workers.dev/';
const HTML = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#0A1025">
  <title>Login INDIA | Technotama</title>
  <meta name="description" content="Portal akses resmi INDIA Enterprise ERP & PSA oleh Technotama.">
  <style>
    :root { color-scheme: dark; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; min-height:100dvh; background: radial-gradient(circle at 10% 6%, #382062 0, transparent 43%), radial-gradient(circle at 94% 92%, #083a52 0, transparent 39%), #080f23; color:#f8fafc; }
    main { width:min(1080px,100%); margin:0 auto; padding: min(11vh,86px) 22px 48px; display:grid; grid-template-columns:1.05fr .95fr; min-height:100vh; min-height:100dvh; align-items:center; gap:60px; }
    .brand { display:flex; gap:14px; align-items:center; font-weight:800; font-size:26px; letter-spacing:.02em; }
    .mark { width:49px; height:49px; display:grid; place-items:center; border:1px solid #5eead477; border-radius:15px; background:#22d3ee20; color:#5eead4; font-size:26px; }
    .sub-brand { display:block; color:#cbd5e1; font-size:11px; font-weight:700; letter-spacing:.12em; margin-top:3px; }
    .eyebrow { font-size:12px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; color:#67e8f9; margin:70px 0 18px; }
    h1 { font-size:clamp(35px,4vw,54px); line-height:1.13; letter-spacing:-.045em; margin:0 0 22px; }
    .intro { max-width:480px; color:#cbd5e1; font-size:16px; line-height:1.8; }
    .features { display:flex; flex-wrap:wrap; gap:12px; margin-top:38px; }
    .features span { border:1px solid #ffffff24; border-radius:12px; background:#ffffff0a; padding:12px 14px; color:#e2e8f0; font-size:12px; font-weight:600; }
    .card { background:white; color:#101827; border-radius:25px; border:1px solid #e2e8f0; padding:clamp(24px,4vw,43px); box-shadow:0 30px 100px #0007; }
    .chip { display:inline-block; padding:8px 12px; border-radius:99px; color:#51247d; background:#f3eafa; font-size:12px; font-weight:700; }
    h2 { font-size:clamp(28px,3vw,36px); letter-spacing:-.04em; margin:24px 0 12px; }
    .help { color:#475569; line-height:1.75; font-size:14px; margin:0 0 26px; }
    .button { display:flex; justify-content:center; align-items:center; text-align:center; min-height:52px; padding:14px 16px; border-radius:12px; background:#2B124C; color:white; text-decoration:none; font-size:15px; font-weight:800; }
    .button:hover,.button:focus-visible {background:#482473; outline:2px solid #67e8f9;outline-offset:3px;}
    .security { padding-top:20px; margin-top:25px; border-top:1px solid #e2e8f0; color:#475569; line-height:1.65; font-size:12px; }
    .copyright {font-size:12px;color:#94a3b8;margin-top:45px}
    .mobile-brand {display:none}
    @media(max-width:800px) { main{display:block; padding:26px 16px 40px;min-height:100dvh;} .story{display:none;} .mobile-brand{display:flex; align-items:center;gap:12px;margin:18px 4px 35px} .card{max-width:490px;margin:auto; padding:28px 24px;} .copyright{text-align:center;margin:25px 0;} }
    @media(prefers-reduced-motion:reduce) { *,*:before,*:after{scroll-behavior:auto !important;transition:none !important;} }
  </style>
</head>
<body>
  <main>
    <section class="story" aria-label="Tentang INDIA Technotama">
      <div class="brand"><span class="mark" aria-hidden="true">◆</span><div>INDIA<span class="sub-brand">TECHNOTAMA · ENTERPRISE PLATFORM</span></div></div>
      <p class="eyebrow">Cybersecurity Enterprise ERP + PSA</p>
      <h1>Satu platform untuk operasional bisnis dan layanan keamanan siber.</h1>
      <p class="intro">Kelola Marketing, Sales, Presales, Project Delivery, Finance, Procurement, serta Cybersecurity Operations dalam satu workspace terintegrasi.</p>
      <div class="features"><span>ERP &amp; CRM terintegrasi</span><span>Workspace berbasis role</span><span>Protected by Cloudflare Access</span></div>
      <p class="copyright">© 2026 Technotama · Internal Business Platform</p>
    </section>
    <div class="mobile-brand brand"><span class="mark" aria-hidden="true">◆</span><div>INDIA<span class="sub-brand">TECHNOTAMA · ENTERPRISE PLATFORM</span></div></div>
    <section class="card" aria-labelledby="login-title">
      <span class="chip">🔒 Akses perusahaan aman</span>
      <h2 id="login-title">Login INDIA</h2>
      <p class="help">Selamat datang di INDIA Technotama. Klik tombol masuk untuk memverifikasi identitas melalui Cloudflare Access. Hanya pengguna yang terdaftar dan memiliki izin yang dapat membuka sistem.</p>
      <a class="button" href="https://india.elang-haqeem.workers.dev/" rel="noreferrer">Masuk dengan Cloudflare Access →</a>
      <p class="security"><strong>Autentikasi tetap melalui Cloudflare.</strong> Halaman ini tidak menerima atau menyimpan password, OTP, maupun data pengguna. Sesudah diverifikasi, izin modul dan data tetap diperiksa oleh INDIA.</p>
    </section>
    <p class="copyright" style="grid-column:1/-1;display:none">© Technotama</p>
  </main>
</body>
</html>`;
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    if (url.pathname !== '/' && url.pathname !== '/login') {
      return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
    }
    const headers = {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests",
    };
    return new Response(request.method === 'HEAD' ? null : HTML, { status: 200, headers });
  },
};
