// INDIA CyberBusiness 360 Formatting Utilities

export function formatIDR(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number): string {
  if (isNaN(value) || value === null || value === undefined) return '0%';
  return `${value.toFixed(1)}%`;
}

export function getRomanMonth(monthIndex: number = new Date().getMonth() + 1): string {
  const romanMonths: Record<number, string> = {
    1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI',
    7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X', 11: 'XI', 12: 'XII'
  };
  return romanMonths[monthIndex] || 'I';
}

export function generateQuotationNumber(seq: number, version: number = 1): string {
  const padSeq = String(seq).padStart(3, '0');
  const romanMonth = getRomanMonth();
  const year = new Date().getFullYear();
  let num = `${padSeq}/DEIT-RCS/${romanMonth}/${year}`;
  if (version > 1) {
    num += `/REV-${version - 1}`;
  }
  return num;
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}
