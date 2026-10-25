/**
 * INDIA customer registration taxonomy.
 * Presentation catalogs only: persisted values remain plain CRM strings.
 * Never rewrite historical customer fields or apply implicit industry changes.
 */
export const CUSTOMER_SEGMENTS = [
 'Corporate','Enterprise','UMKM / SME','Startup',
 'BUMN','BUMD','Pemerintah Pusat','Pemerintah Daerah',
 'Institusi Keuangan','Pendidikan','Organisasi Nirlaba','Perorangan',
] as const;

export const CUSTOMER_INDUSTRIES = [
 'Banking','Asuransi','Multifinance','Sekuritas','Fintech',
 'BUMN','Pemerintah','Healthcare','Retail','Manufaktur','Teknologi Informasi',
 'Telekomunikasi','Pendidikan','Energi & Pertambangan','Transportasi & Logistik',
 'Properti & Konstruksi','Agribisnis','Pariwisata & Hospitality','Media & Kreatif','Lainnya',
] as const;

/** Prefer standard business activities for the selected industry. */
const BUSINESS_BY_INDUSTRY:Record<string,readonly string[]> = {
 Banking:['Bank Umum Konvensional','Bank Umum Syariah','Bank Digital','BPR / BPRS','Infrastruktur Sistem Pembayaran'],
 Asuransi:['Asuransi Jiwa','Asuransi Umum','Reasuransi','Pialang Asuransi','Penjaminan'],
 Multifinance:['Perusahaan Pembiayaan','Pembiayaan Syariah','Sewa Guna Usaha / Leasing','Modal Ventura','Pergadaian'],
 Sekuritas:['Perusahaan Efek / Sekuritas','Manajer Investasi','Bursa dan Infrastruktur Pasar Modal','Kustodian','Lembaga Kliring'],
 Fintech:['Fintech Lending','Payment Gateway','Dompet Digital','Teknologi Keuangan / Open Banking','RegTech'],
 BUMN:['Holding BUMN','Jasa Keuangan BUMN','Infrastruktur BUMN','Energi BUMN','Jasa dan Perdagangan BUMN'],
 Pemerintah:['Kementerian / Lembaga','Pemerintah Provinsi','Pemerintah Kabupaten / Kota','Badan Layanan Umum','Lembaga Pemerintah Non-Kementerian'],
 Healthcare:['Rumah Sakit','Klinik','Laboratorium Kesehatan','Farmasi','Telemedicine'],
 Retail:['Perdagangan Ritel','E-Commerce','Distributor / Grosir','Produk Konsumen (FMCG)'],
 Manufaktur:['Makanan dan Minuman','Industri Otomotif','Elektronik','Kimia dan Farmasi','Tekstil dan Garmen'],
 'Teknologi Informasi':['Layanan Teknologi Informasi','Pengembangan Perangkat Lunak','Pusat Data / Cloud','Managed Service Provider','Keamanan Siber','Integrasi Sistem'],
 Telekomunikasi:['Operator Seluler','Penyedia Internet (ISP)','Infrastruktur Jaringan','Penyedia Layanan Komunikasi'],
 Pendidikan:['Universitas / Perguruan Tinggi','Sekolah','Lembaga Pelatihan','EdTech'],
 'Energi & Pertambangan':['Minyak dan Gas','Pertambangan','Pembangkit Listrik','Energi Terbarukan','Utilitas'],
 'Transportasi & Logistik':['Logistik dan Pergudangan','Pelayaran / Pelabuhan','Transportasi Darat','Penerbangan','Jasa Kurir'],
 'Properti & Konstruksi':['Pengembang Properti','Konstruksi / EPC','Manajemen Gedung','Konsultan Teknik'],
 Agribisnis:['Pertanian','Perkebunan','Peternakan','Perikanan','Pengolahan Hasil Pertanian'],
 'Pariwisata & Hospitality':['Perhotelan','Perjalanan Wisata','Restoran dan F&B','Pengelolaan Destinasi'],
 'Media & Kreatif':['Media dan Penyiaran','Periklanan','Konten Digital','Industri Kreatif'],
 Lainnya:['Jasa Profesional','Konsultan','Perdagangan Umum','Layanan Publik','Yayasan / Nirlaba'],
};
export const POPULAR_BUSINESS_TYPES = [
 'Layanan Teknologi Informasi','Pengembangan Perangkat Lunak','Keamanan Siber',
 'Bank Umum Konvensional','Bank Umum Syariah','Bank Digital',
 'Perusahaan Pembiayaan','Perusahaan Efek / Sekuritas','Asuransi Umum',
 'Kementerian / Lembaga','Pemerintah Provinsi','Pemerintah Kabupaten / Kota',
 'Rumah Sakit','Perdagangan Ritel','Manufaktur','Jasa Profesional',
] as const;

export const STANDARD_BUSINESS_TYPES=[...new Set<string>([...POPULAR_BUSINESS_TYPES,...Object.values(BUSINESS_BY_INDUSTRY).flat()])];

export function businessTypeOptions(industry:string):string[]{
 // Do not include artificial "Lainnya" as a stored value: users provide the real activity.
 return [...new Set(BUSINESS_BY_INDUSTRY[industry]||STANDARD_BUSINESS_TYPES)];
}
