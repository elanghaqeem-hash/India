// INDIA CyberBusiness 360 Dynamic Pricing & BoQ Calculation Engine
// Sourced from the pricing/proposal schema & pre-development decisions

import {
  ClientTier,
  DAIIndices,
  LocationType,
  RoleLevel,
  BoQHRDetail,
  BoQInternal,
  PriceRange
} from './types';

// Rate Card: Cost Basis per Manday
export const RATE_CARD_COST: Record<LocationType, Record<RoleLevel, number>> = {
  remote: {
    project_manager: 1500000,
    lead: 2000000,
    senior: 1000000,
    junior: 500000,
    forensic: 2000000,
    sme_external: 3000000,
    soc_analyst_l1: 700000,
    soc_analyst_l2: 1200000,
    cti_analyst: 1500000,
    technical_writer: 0, // Tarif belum disetujui: isi manual di Pricing.
  },
  jabotabek: {
    project_manager: 1500000,
    lead: 2000000,
    senior: 1000000,
    junior: 500000,
    forensic: 2000000,
    sme_external: 3000000,
    soc_analyst_l1: 700000,
    soc_analyst_l2: 1200000,
    cti_analyst: 1500000,
    technical_writer: 0, // Tarif belum disetujui: isi manual di Pricing.
  },
  luar_jabotabek: {
    project_manager: 1500000,
    lead: 2000000,
    senior: 1000000,
    junior: 500000,
    forensic: 2000000,
    sme_external: 3000000,
    soc_analyst_l1: 850000,
    soc_analyst_l2: 1400000,
    cti_analyst: 1500000,
    technical_writer: 0, // Tarif belum disetujui: isi manual di Pricing.
  },
  overseas: {
    project_manager: 4000000,
    lead: 4000000,
    senior: 3900000,
    junior: 1500000,
    forensic: 5000000,
    sme_external: 8000000,
    soc_analyst_l1: 2500000,
    soc_analyst_l2: 3500000,
    cti_analyst: 4000000,
    technical_writer: 0, // Tarif belum disetujui: isi manual di Pricing.
  },
};

// Standard Base Selling Rate (per Manday)
export const BASE_SELLING_RATE: Record<RoleLevel, number> = {
  project_manager: 5000000,
  lead: 6000000,
  senior: 4000000,
  junior: 2500000,
  forensic: 7000000,
  sme_external: 10000000,
  soc_analyst_l1: 2000000,
  soc_analyst_l2: 3500000,
  cti_analyst: 4500000,
  technical_writer: 0, // Tarif jual Technical Writer perlu ditetapkan.
};

// Client Tier Multipliers (BRD 3.1 & PreDev 01)
export const CLIENT_TIER_MULTIPLIERS: Record<ClientTier, { default: number; min: number; max: number; label: string }> = {
  S: { default: 1.40, min: 1.30, max: 1.50, label: 'Tier S: BUMN Holding / Tier-1 Bank' },
  A: { default: 1.00, min: 1.00, max: 1.00, label: 'Tier A: Enterprise Tbk / Large Bank (Baseline)' },
  B: { default: 0.90, min: 0.85, max: 0.95, label: 'Tier B: Mid Enterprise / Multifinance' },
  C: { default: 2.00, min: 2.00, max: 2.50, label: 'Tier C: High-Growth Fintech / Tech Unicorn' },
  D: { default: 0.80, min: 0.70, max: 0.90, label: 'Tier D: Government / BUMN Regulated Pagu' },
  E: { default: 0.80, min: 0.75, max: 0.85, label: 'Tier E: BPR/BPRS / SMB' },
};

// Calculate DAI
export function calculateDAI(indices: DAIIndices): number {
  const w1 = 0.40; // CPI
  const w2 = 0.30; // FX
  const w3 = 0.20; // Market
  const w4 = 0.10; // Urgency
  const dai = (w1 * (indices.cpi_index || 1.0)) +
              (w2 * (indices.fx_index || 1.0)) +
              (w3 * (indices.market_index || 1.0)) +
              (w4 * (indices.urgency_index || 1.0));
  return Number(dai.toFixed(4));
}

// Calculate Component A (HR Cost)
export function calculateHRCost(
  hrStaffing: Array<{ role_level: RoleLevel; mandays: number; cost_rate_override?: number; selling_rate_override?: number }>,
  location: LocationType = 'remote'
): { details: BoQHRDetail[]; totalHRCost: number; totalSellingBaseline: number } {
  let totalHRCost = 0;
  let totalSellingBaseline = 0;

  const details: BoQHRDetail[] = hrStaffing.map(item => {
    // Explicit zero is valid for an unconfigured role; do not silently apply another role's rate.
    const costRate = Math.max(0, item.cost_rate_override ?? RATE_CARD_COST[location][item.role_level]);
    const sellingRate = Math.max(0, item.selling_rate_override ?? BASE_SELLING_RATE[item.role_level]);
    const subtotal = item.mandays * costRate;
    totalHRCost += subtotal;
    totalSellingBaseline += item.mandays * sellingRate;

    return {
      role_level: item.role_level,
      mandays: item.mandays,
      daily_cost_rate: costRate,
      subtotal,
    };
  });

  return { details, totalHRCost, totalSellingBaseline };
}

// Calculate BoQ Internal
export function calculateBoQ(params: {
  component_a_total: number;
  component_b_total: number;
  component_c_total?: number;
  component_d_total?: number;
  component_e_total?: number;
  quoted_price: number;
}): BoQInternal {
  const cA = params.component_a_total;
  const cB = params.component_b_total;
  const cC = params.component_c_total ?? 2000000; // Default dokumen Rp 2jt
  const cD = params.component_d_total ?? 0;
  const cE = params.component_e_total ?? 0;

  const total_internal_cost = cA + cB + cC + cD + cE;
  const gross_profit = params.quoted_price - total_internal_cost;
  const gross_margin_pct = params.quoted_price > 0
    ? Number(((gross_profit / params.quoted_price) * 100).toFixed(2))
    : 0;

  // Rule: Margin < 25% triggers red alert / warning
  const margin_warning = params.quoted_price > 0 && gross_margin_pct < 25.0;

  return {
    component_a_total: cA,
    component_b_total: cB,
    component_c_total: cC,
    component_d_total: cD,
    component_e_total: cE,
    total_internal_cost,
    quoted_price: params.quoted_price,
    gross_profit,
    gross_margin_pct,
    margin_warning,
  };
}

// Full 3-Range Pricing Calculator
export function calculate3Ranges(params: {
  totalInternalCost: number;
  totalSellingBaseline: number;
  dai: number;
  tierMultiplier: number;
}): { floor_price: number; standard_price: number; premium_price: number } {
  // Floor: Total Internal Cost / (1 - 0.20) => ensures 20% margin
  const floor_price = Math.round(params.totalInternalCost / (1 - 0.20));

  // Standard: Baseline Selling * DAI * Tier Multiplier
  let standard_price = Math.round(params.totalSellingBaseline * params.dai * params.tierMultiplier);

  // Safeguard: Standard must be >= Floor
  if (standard_price < floor_price) {
    standard_price = Math.round(floor_price * 1.10);
  }

  // Premium: Standard * 1.25
  const premium_price = Math.round(standard_price * 1.25);

  return {
    floor_price,
    standard_price,
    premium_price,
  };
}
