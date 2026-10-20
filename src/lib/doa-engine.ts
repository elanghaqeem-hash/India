// ICOP CyberBusiness 360 Delegation of Authority (DoA) Engine
// Sourced from Master Prompt Section L & ICOP_PreDev_Decisions_v1.0.docx

export type DoALevel = 'manager' | 'vp' | 'director';

export interface DoAEvaluation {
  requiredLevel: DoALevel;
  requiresDirector: boolean;
  reasons: string[];
  flags: {
    valueExceededManager: boolean;
    valueExceededVP: boolean;
    discountExceededManager: boolean;
    discountExceededVP: boolean;
    marginAlert: boolean;
  };
}

export function evaluateQuotationDoA(params: {
  grandTotal: number;
  discountPct: number;
  grossMarginPct: number;
}): DoAEvaluation {
  const { grandTotal, discountPct, grossMarginPct } = params;
  const reasons: string[] = [];

  let level: DoALevel = 'manager';

  const valueExceededManager = grandTotal > 50000000;
  const valueExceededVP = grandTotal > 500000000;

  const discountExceededManager = discountPct > 5.0;
  const discountExceededVP = discountPct > 15.0;

  const marginAlert = grossMarginPct > 0 && grossMarginPct < 25.0;

  // 1. Transaction Value Checks
  if (valueExceededVP) {
    level = 'director';
    reasons.push(`Nilai transaksi di atas Rp 500 Juta (${formatIDRCompact(grandTotal)}) memerlukan otorisasi Direktur`);
  } else if (valueExceededManager) {
    if (level !== 'director') level = 'vp';
    reasons.push(`Nilai transaksi di atas Rp 50 Juta (${formatIDRCompact(grandTotal)}) memerlukan otorisasi VP / Head Sales`);
  } else {
    reasons.push(`Nilai transaksi standar (≤ Rp 50 Juta) - Wewenang Sales Manager`);
  }

  // 2. Discount Checks
  if (discountExceededVP) {
    level = 'director';
    reasons.push(`Diskon ${discountPct.toFixed(1)}% (> 15%) memerlukan otorisasi Direktur`);
  } else if (discountExceededManager) {
    if (level !== 'director') level = 'vp';
    reasons.push(`Diskon ${discountPct.toFixed(1)}% (5% - 15%) memerlukan otorisasi VP / Head Sales`);
  }

  // 3. Margin Exception Checks
  if (marginAlert) {
    if (level !== 'director') level = 'vp';
    reasons.push(`Gross Margin ${grossMarginPct.toFixed(1)}% di bawah threshold minimum 25% (Pengecualian Margin)`);
  }

  return {
    requiredLevel: level,
    requiresDirector: level === 'director',
    reasons,
    flags: {
      valueExceededManager,
      valueExceededVP,
      discountExceededManager,
      discountExceededVP,
      marginAlert,
    },
  };
}

function formatIDRCompact(amount: number): string {
  if (amount >= 1000000000) {
    return `Rp ${(amount / 1000000000).toFixed(2)} Miliar`;
  }
  if (amount >= 1000000) {
    return `Rp ${(amount / 1000000).toFixed(1)} Juta`;
  }
  return `Rp ${amount.toLocaleString('id-ID')}`;
}
