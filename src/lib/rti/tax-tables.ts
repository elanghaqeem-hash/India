// Statutory payroll tax and social security tables (Indonesia). Amounts are integer cents (Rp × 100).
// Loaded into D1 by migration 0042 (india_tax_ter_brackets, india_tax_ptkp, india_tax_progressive_brackets,
// india_payroll_contribution_rates). Values transcribed from the regulations listed in LEGAL_BASIS and cross-checked
// against a second published transcription; any regulatory change is a new effective-dated row, never an edit.
import { applyRate, prorate } from './money';
import { progressiveTax, type TerBracket, type ProgressiveBracket } from './formulas';

export const LEGAL_BASIS = {
  TER: 'PP 58/2023 Lampiran (TER bulanan A/B/C dan TER harian); PMK 168/2023',
  PTKP: 'PMK 101/PMK.010/2016',
  PASAL17: 'UU 7/2021 (HPP) Pasal 17 ayat (1) huruf a',
  BIAYA_JABATAN: 'PMK 168/2023: 5% penghasilan bruto, maksimal Rp6.000.000 setahun',
  PPN: 'UU 7/2021 (HPP) Pasal 7; PMK 131/2024 Pasal 3 (DPP nilai lain 11/12 untuk BKP/JKP non-mewah)',
  PPH23: 'UU PPh Pasal 23 ayat (1) huruf c (2% jasa) dan ayat (1a) (100% lebih tinggi tanpa NPWP); PMK 112/2022 (NIK sebagai NPWP)',
  PPH_BADAN: 'UU 7/2021 (HPP) Pasal 17 ayat (1) huruf b (22%); UU PPh Pasal 31E (fasilitas 50% peredaran bruto s.d. Rp50 miliar)',
  CORETAX: 'PMK 81/2024 (e-Faktur dan bukti potong unifikasi di Coretax)',
  BPJS_KES: 'Perpres 82/2018 jo. Perpres 64/2020: 5% (4% pemberi kerja, 1% pekerja), batas upah Rp12.000.000',
  BPJS_JHT: 'PP 46/2015: 5,7% (3,7% pemberi kerja, 2% pekerja)',
  BPJS_JP: 'PP 45/2015: 3% (2% pemberi kerja, 1% pekerja); batas upah Rp11.086.300 mulai Maret 2026 (SE BPJS Ketenagakerjaan B/1226/022026)',
  BPJS_JKK: 'PP 44/2015 jo. PP 82/2019: 0,24% / 0,54% / 0,89% / 1,27% / 1,74% sesuai kelompok risiko',
  BPJS_JKM: 'PP 44/2015: 0,30% pemberi kerja',
} as const;

export type TerCategory = 'A' | 'B' | 'C';
export const TER_MONTHLY: Record<TerCategory, TerBracket[]> = {
  A: [
    { up_to: 5_400_000_00, rate: '0' },
    { up_to: 5_650_000_00, rate: '0.0025' },
    { up_to: 5_950_000_00, rate: '0.005' },
    { up_to: 6_300_000_00, rate: '0.0075' },
    { up_to: 6_750_000_00, rate: '0.01' },
    { up_to: 7_500_000_00, rate: '0.0125' },
    { up_to: 8_550_000_00, rate: '0.015' },
    { up_to: 9_650_000_00, rate: '0.0175' },
    { up_to: 10_050_000_00, rate: '0.02' },
    { up_to: 10_350_000_00, rate: '0.0225' },
    { up_to: 10_700_000_00, rate: '0.025' },
    { up_to: 11_050_000_00, rate: '0.03' },
    { up_to: 11_600_000_00, rate: '0.035' },
    { up_to: 12_500_000_00, rate: '0.04' },
    { up_to: 13_750_000_00, rate: '0.05' },
    { up_to: 15_100_000_00, rate: '0.06' },
    { up_to: 16_950_000_00, rate: '0.07' },
    { up_to: 19_750_000_00, rate: '0.08' },
    { up_to: 24_150_000_00, rate: '0.09' },
    { up_to: 26_450_000_00, rate: '0.1' },
    { up_to: 28_000_000_00, rate: '0.11' },
    { up_to: 30_050_000_00, rate: '0.12' },
    { up_to: 32_400_000_00, rate: '0.13' },
    { up_to: 35_400_000_00, rate: '0.14' },
    { up_to: 39_100_000_00, rate: '0.15' },
    { up_to: 43_850_000_00, rate: '0.16' },
    { up_to: 47_800_000_00, rate: '0.17' },
    { up_to: 51_400_000_00, rate: '0.18' },
    { up_to: 56_300_000_00, rate: '0.19' },
    { up_to: 62_200_000_00, rate: '0.2' },
    { up_to: 68_600_000_00, rate: '0.21' },
    { up_to: 77_500_000_00, rate: '0.22' },
    { up_to: 89_000_000_00, rate: '0.23' },
    { up_to: 103_000_000_00, rate: '0.24' },
    { up_to: 125_000_000_00, rate: '0.25' },
    { up_to: 157_000_000_00, rate: '0.26' },
    { up_to: 206_000_000_00, rate: '0.27' },
    { up_to: 337_000_000_00, rate: '0.28' },
    { up_to: 454_000_000_00, rate: '0.29' },
    { up_to: 550_000_000_00, rate: '0.3' },
    { up_to: 695_000_000_00, rate: '0.31' },
    { up_to: 910_000_000_00, rate: '0.32' },
    { up_to: 1_400_000_000_00, rate: '0.33' },
    { up_to: null, rate: '0.34' },
  ],
  B: [
    { up_to: 6_200_000_00, rate: '0' },
    { up_to: 6_500_000_00, rate: '0.0025' },
    { up_to: 6_850_000_00, rate: '0.005' },
    { up_to: 7_300_000_00, rate: '0.0075' },
    { up_to: 9_200_000_00, rate: '0.01' },
    { up_to: 10_750_000_00, rate: '0.015' },
    { up_to: 11_250_000_00, rate: '0.02' },
    { up_to: 11_600_000_00, rate: '0.025' },
    { up_to: 12_600_000_00, rate: '0.03' },
    { up_to: 13_600_000_00, rate: '0.04' },
    { up_to: 14_950_000_00, rate: '0.05' },
    { up_to: 16_400_000_00, rate: '0.06' },
    { up_to: 18_450_000_00, rate: '0.07' },
    { up_to: 21_850_000_00, rate: '0.08' },
    { up_to: 26_000_000_00, rate: '0.09' },
    { up_to: 27_700_000_00, rate: '0.1' },
    { up_to: 29_350_000_00, rate: '0.11' },
    { up_to: 31_450_000_00, rate: '0.12' },
    { up_to: 33_950_000_00, rate: '0.13' },
    { up_to: 37_100_000_00, rate: '0.14' },
    { up_to: 41_100_000_00, rate: '0.15' },
    { up_to: 45_800_000_00, rate: '0.16' },
    { up_to: 49_500_000_00, rate: '0.17' },
    { up_to: 53_800_000_00, rate: '0.18' },
    { up_to: 58_500_000_00, rate: '0.19' },
    { up_to: 64_000_000_00, rate: '0.2' },
    { up_to: 71_000_000_00, rate: '0.21' },
    { up_to: 80_000_000_00, rate: '0.22' },
    { up_to: 93_000_000_00, rate: '0.23' },
    { up_to: 109_000_000_00, rate: '0.24' },
    { up_to: 129_000_000_00, rate: '0.25' },
    { up_to: 163_000_000_00, rate: '0.26' },
    { up_to: 211_000_000_00, rate: '0.27' },
    { up_to: 374_000_000_00, rate: '0.28' },
    { up_to: 459_000_000_00, rate: '0.29' },
    { up_to: 555_000_000_00, rate: '0.3' },
    { up_to: 704_000_000_00, rate: '0.31' },
    { up_to: 957_000_000_00, rate: '0.32' },
    { up_to: 1_405_000_000_00, rate: '0.33' },
    { up_to: null, rate: '0.34' },
  ],
  C: [
    { up_to: 6_600_000_00, rate: '0' },
    { up_to: 6_950_000_00, rate: '0.0025' },
    { up_to: 7_350_000_00, rate: '0.005' },
    { up_to: 7_800_000_00, rate: '0.0075' },
    { up_to: 8_850_000_00, rate: '0.01' },
    { up_to: 9_800_000_00, rate: '0.0125' },
    { up_to: 10_950_000_00, rate: '0.015' },
    { up_to: 11_200_000_00, rate: '0.0175' },
    { up_to: 12_050_000_00, rate: '0.02' },
    { up_to: 12_950_000_00, rate: '0.03' },
    { up_to: 14_150_000_00, rate: '0.04' },
    { up_to: 15_550_000_00, rate: '0.05' },
    { up_to: 17_050_000_00, rate: '0.06' },
    { up_to: 19_500_000_00, rate: '0.07' },
    { up_to: 22_700_000_00, rate: '0.08' },
    { up_to: 26_600_000_00, rate: '0.09' },
    { up_to: 28_100_000_00, rate: '0.1' },
    { up_to: 30_100_000_00, rate: '0.11' },
    { up_to: 32_600_000_00, rate: '0.12' },
    { up_to: 35_400_000_00, rate: '0.13' },
    { up_to: 38_900_000_00, rate: '0.14' },
    { up_to: 43_000_000_00, rate: '0.15' },
    { up_to: 47_400_000_00, rate: '0.16' },
    { up_to: 51_200_000_00, rate: '0.17' },
    { up_to: 55_800_000_00, rate: '0.18' },
    { up_to: 60_400_000_00, rate: '0.19' },
    { up_to: 66_700_000_00, rate: '0.2' },
    { up_to: 74_500_000_00, rate: '0.21' },
    { up_to: 83_200_000_00, rate: '0.22' },
    { up_to: 95_600_000_00, rate: '0.23' },
    { up_to: 110_000_000_00, rate: '0.24' },
    { up_to: 134_000_000_00, rate: '0.25' },
    { up_to: 169_000_000_00, rate: '0.26' },
    { up_to: 221_000_000_00, rate: '0.27' },
    { up_to: 390_000_000_00, rate: '0.28' },
    { up_to: 463_000_000_00, rate: '0.29' },
    { up_to: 561_000_000_00, rate: '0.3' },
    { up_to: 709_000_000_00, rate: '0.31' },
    { up_to: 965_000_000_00, rate: '0.32' },
    { up_to: 1_419_000_000_00, rate: '0.33' },
    { up_to: null, rate: '0.34' },
  ],
};
/** TER harian: 0% s.d. Rp450.000; 0,5% s.d. Rp2.500.000; di atas itu tarif Pasal 17 × 50% × bruto harian. */
export const TER_DAILY: TerBracket[] = [{ up_to: 450_000_00, rate: '0' }, { up_to: 2_500_000_00, rate: '0.005' }];

export type PtkpStatus = 'TK/0' | 'TK/1' | 'TK/2' | 'TK/3' | 'K/0' | 'K/1' | 'K/2' | 'K/3';
export const PTKP_ANNUAL: Record<PtkpStatus, number> = {
  'TK/0': 54_000_000_00, 'TK/1': 58_500_000_00, 'TK/2': 63_000_000_00, 'TK/3': 67_500_000_00,
  'K/0': 58_500_000_00, 'K/1': 63_000_000_00, 'K/2': 67_500_000_00, 'K/3': 72_000_000_00,
};
export const TER_CATEGORY: Record<PtkpStatus, TerCategory> = {
  'TK/0': 'A', 'TK/1': 'A', 'K/0': 'A', 'TK/2': 'B', 'TK/3': 'B', 'K/1': 'B', 'K/2': 'B', 'K/3': 'C',
};
export const PASAL17_INDIVIDUAL: ProgressiveBracket[] = [
  { up_to: 60_000_000_00, rate: '0.05' }, { up_to: 250_000_000_00, rate: '0.15' }, { up_to: 500_000_000_00, rate: '0.25' },
  { up_to: 5_000_000_000_00, rate: '0.30' }, { up_to: null, rate: '0.35' },
];
export const BIAYA_JABATAN = { rate: '0.05', annual_cap: 6_000_000_00, monthly_cap: 500_000_00 };

export type ContributionRate = { program: string; party: 'employer' | 'employee'; rate: string; wage_cap: number | null; basis: string };
export const BPJS_RATES: ContributionRate[] = [
  { program: 'KESEHATAN', party: 'employer', rate: '0.04', wage_cap: 12_000_000_00, basis: LEGAL_BASIS.BPJS_KES },
  { program: 'KESEHATAN', party: 'employee', rate: '0.01', wage_cap: 12_000_000_00, basis: LEGAL_BASIS.BPJS_KES },
  { program: 'JHT', party: 'employer', rate: '0.037', wage_cap: null, basis: LEGAL_BASIS.BPJS_JHT },
  { program: 'JHT', party: 'employee', rate: '0.02', wage_cap: null, basis: LEGAL_BASIS.BPJS_JHT },
  { program: 'JP', party: 'employer', rate: '0.02', wage_cap: 11_086_300_00, basis: LEGAL_BASIS.BPJS_JP },
  { program: 'JP', party: 'employee', rate: '0.01', wage_cap: 11_086_300_00, basis: LEGAL_BASIS.BPJS_JP },
  { program: 'JKM', party: 'employer', rate: '0.003', wage_cap: null, basis: LEGAL_BASIS.BPJS_JKM },
];
/** JKK by risk group; office-based IT services normally fall in group I (sangat rendah). Assignment is per BPJS registration. */
export const JKK_RISK_CLASSES: { class: number; label: string; rate: string }[] = [
  { class: 1, label: 'Sangat rendah', rate: '0.0024' }, { class: 2, label: 'Rendah', rate: '0.0054' }, { class: 3, label: 'Sedang', rate: '0.0089' },
  { class: 4, label: 'Tinggi', rate: '0.0127' }, { class: 5, label: 'Sangat tinggi', rate: '0.0174' },
];

export function terRate(category: TerCategory, grossMonthly: number): string {
  const b = TER_MONTHLY[category].find(x => x.up_to === null || grossMonthly <= x.up_to);
  return b!.rate;
}

/** BPJS contributions for one month. Employee shares reduce take-home; employee JHT/JP are deductible for PPh 21. */
export function bpjsContributions(i: { wage: number; jkk_class: number }) {
  const base = (cap: number | null) => (cap === null ? i.wage : Math.min(i.wage, cap));
  const get = (program: string, party: string) => { const r = BPJS_RATES.find(x => x.program === program && x.party === party)!; return applyRate(base(r.wage_cap), r.rate); };
  const jkk = JKK_RISK_CLASSES.find(x => x.class === i.jkk_class);
  if (!jkk) throw new Error('JKK_CLASS_INVALID');
  const employer = { kesehatan: get('KESEHATAN', 'employer'), jht: get('JHT', 'employer'), jp: get('JP', 'employer'), jkk: applyRate(i.wage, jkk.rate), jkm: get('JKM', 'employer') };
  const employee = { kesehatan: get('KESEHATAN', 'employee'), jht: get('JHT', 'employee'), jp: get('JP', 'employee') };
  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
  return { employer, employee, employer_total: sum(employer), employee_total: sum(employee) };
}

/**
 * Monthly PPh 21 for a permanent employee (Jan–Nov): TER × monthly gross. Gross includes taxable allowances and
 * employer-paid JKK, JKM and BPJS Kesehatan (premi asuransi dibayar pemberi kerja), excluding employer JHT/JP.
 * Rounded down to whole rupiah. Employees without NPWP/NIK-NPWP are taxed 20% higher (UU PPh Pasal 21 ayat 5a).
 */
export function pph21MonthlyTer(i: { status: PtkpStatus; gross_monthly: number; has_npwp: boolean }) {
  const rate = terRate(TER_CATEGORY[i.status], i.gross_monthly);
  let tax = applyRate(i.gross_monthly, rate, 'DOWN');
  if (!i.has_npwp) tax = applyRate(tax, '1.2', 'DOWN');
  return Math.floor(tax / 100) * 100;
}

/** December / final-period recomputation under Pasal 17 minus TER already withheld. */
export function pph21Annual(i: { status: PtkpStatus; annual_gross: number; annual_employee_jht_jp: number; months_worked: number; withheld_before: number; has_npwp: boolean }) {
  const bj = Math.min(applyRate(i.annual_gross, BIAYA_JABATAN.rate, 'DOWN'), BIAYA_JABATAN.monthly_cap * i.months_worked);
  const net = i.annual_gross - bj - i.annual_employee_jht_jp;
  const pkp = Math.max(0, net - PTKP_ANNUAL[i.status]);
  let annual = progressiveTax({ pkp, brackets: PASAL17_INDIVIDUAL });
  if (!i.has_npwp) annual = applyRate(annual, '1.2', 'DOWN');
  annual = Math.floor(annual / 100) * 100;
  return { biaya_jabatan: bj, net, pkp: Math.floor(pkp / 100000) * 100000, annual_tax: annual, final_period_tax: annual - i.withheld_before };
}

/** Non-luxury BKP/JKP: PPN = 12% × (11/12 × harga jual). */
export function ppnNonLuxury(price: number) {
  const dpp = prorate(price, 11, 12, 'HALF_UP');
  return { dpp, ppn: applyRate(dpp, '0.12', 'HALF_UP') };
}
