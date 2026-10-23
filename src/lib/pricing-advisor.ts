/**
 * Pricing advisory: numeric advice stays in the browser.
 * Only allowlisted, qualitative context is shared with external AI after consent.
 */
import type { ClientTier, LocationType, PriceRange } from './types';

export type PricingAdvisorSnapshot = {
  clientTier: ClientTier;
  locationType: LocationType;
  selectedRange: PriceRange;
  discountPct: number;
  totalCost: number;
  quotedPrice: number;
  grossMarginPct: number;
  floorPrice: number;
  standardPrice: number;
  premiumPrice: number;
  requiredLevel: string;
};

const money = (value: number) => 'Rp ' + Math.ceil(value).toLocaleString('id-ID');
const TARGET_MARGIN = 25;

export function localPricingInsights(input: PricingAdvisorSnapshot): string[] {
  const minimumAtTarget = input.totalCost / (1 - TARGET_MARGIN / 100);
  const minimum = Number.isFinite(minimumAtTarget) ? Math.ceil(minimumAtTarget) : 0;
  const margin = Number.isFinite(input.grossMarginPct) ? input.grossMarginPct : 0;
  const notes: string[] = [];

  if (input.quotedPrice <= 0) {
    notes.push('Harga penawaran harus lebih dari nol sebelum profitabilitas dapat dievaluasi.');
  } else if (margin < TARGET_MARGIN) {
    const gap = Math.max(0, minimum - input.quotedPrice);
    notes.push('Margin saat ini ' + margin.toFixed(2) + '% di bawah target ' + TARGET_MARGIN +
      '%. Harga setelah diskon perlu minimal ' + money(minimum) +
      ' (selisih ' + money(gap) + ') untuk mencapai target, dengan asumsi biaya tetap.');
  } else {
    notes.push('Margin ' + margin.toFixed(2) + '% memenuhi target ' + TARGET_MARGIN +
      '%. Pastikan setiap revisi harga tetap di atas ' + money(minimum) + ' setelah diskon.');
  }

  if (input.selectedRange === 'floor') {
    notes.push('Harga Floor dihitung dengan margin dasar 20%, berbeda dari target komersial 25%. Validasi kembali sebelum menyetujui penawaran Floor.');
  } else {
    notes.push('Posisi harga dipilih pada skenario ' + (input.selectedRange === 'premium' ? 'Premium' : 'Standard') +
      '; gunakan scope, deliverables, SLA, dan nilai layanan sebagai dasar negosiasi.');
  }

  if (input.discountPct > 0) {
    notes.push('Diskon ' + input.discountPct.toFixed(2) + '% sudah memengaruhi harga akhir; hitung ulang margin dan wajibkan persetujuan DoA.');
  }
  notes.push('Otorisasi yang dihitung: ' + input.requiredLevel.toUpperCase() +
    '. Rekomendasi ini bukan persetujuan; review Finance dan alur DoA tetap berlaku.');
  return notes;
}

/** This prompt intentionally contains no customer identity, exact price, BoQ, cost, or margin. */
export function anonymousPricingPrompt(input: Pick<PricingAdvisorSnapshot,
  'clientTier' | 'locationType' | 'selectedRange' | 'discountPct'>): string {
  const tier = (['S', 'A', 'B', 'C', 'D', 'E'] as string[]).includes(input.clientTier)
    ? input.clientTier : 'tidak diketahui';
  const location = (['remote', 'jabotabek', 'luar_jabotabek', 'overseas'] as string[])
    .includes(input.locationType) ? input.locationType : 'tidak diketahui';
  const range = (['floor', 'standard', 'premium'] as string[]).includes(input.selectedRange)
    ? input.selectedRange : 'tidak diketahui';
  const hasDiscount = Number.isFinite(input.discountPct) && input.discountPct > 0;
  return [
    'Berikan 3-4 rekomendasi strategi komersial umum untuk layanan keamanan siber DefendIT360.',
    'Konteks anonim: Tier pelanggan ' + tier + ', pelaksanaan ' + location +
      ', skenario harga ' + range + ', diskon ' + (hasDiscount ? 'dipertimbangkan' : 'tidak diterapkan') + '.',
    'Tidak disertakan identitas pelanggan, HPP, nominal penawaran, BoQ, nilai margin, atau informasi rahasia.',
    'Fokus pada positioning nilai, negosiasi berbasis scope/SLA, penjagaan target margin, dan review DoA.',
    'Jangan mengarang angka, keputusan persetujuan, jaminan win rate, atau fakta pelanggan. Hasil berupa draft yang harus ditinjau.'
  ].join('\n');
}
