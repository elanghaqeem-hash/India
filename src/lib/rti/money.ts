// Exact money arithmetic. Amounts are integer minor units (IDR "cents" to match migration 0035 *_cents columns).
// Rates are rationals parsed from decimal strings or "a/b" fractions. No floating point is used for money.

export type Rate = { num: bigint; den: bigint };
export type Rounding = 'HALF_UP' | 'HALF_EVEN' | 'DOWN';

export class MoneyError extends Error {}

export function rate(x: string | number | Rate): Rate {
  if (typeof x === 'object') return normalize(x.num, x.den);
  const s = String(x).trim();
  const frac = /^(-?\d+)\s*\/\s*(\d+)$/.exec(s);
  if (frac) return normalize(BigInt(frac[1]), BigInt(frac[2]));
  const dec = /^(-?)(\d+)(?:\.(\d+))?$/.exec(s);
  if (!dec) throw new MoneyError('RATE_INVALID:' + s);
  const fraction = dec[3] || '';
  const num = BigInt(dec[1] + dec[2] + fraction);
  return normalize(num, 10n ** BigInt(fraction.length));
}

function gcd(a: bigint, b: bigint): bigint { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a || 1n; }
function normalize(num: bigint, den: bigint): Rate {
  if (den === 0n) throw new MoneyError('RATE_ZERO_DENOMINATOR');
  if (den < 0n) { num = -num; den = -den; }
  const g = gcd(num, den);
  return { num: num / g, den: den / g };
}

/** Divide two bigints with an explicit rounding rule. */
export function divRound(n: bigint, d: bigint, mode: Rounding = 'HALF_UP'): bigint {
  if (d === 0n) throw new MoneyError('DIVIDE_BY_ZERO');
  if (d < 0n) { n = -n; d = -d; }
  const neg = n < 0n; const a = neg ? -n : n;
  let q = a / d; const r = a % d;
  if (mode === 'HALF_UP' && r * 2n >= d) q += 1n;
  if (mode === 'HALF_EVEN' && (r * 2n > d || (r * 2n === d && q % 2n === 1n))) q += 1n;
  return neg ? -q : q;
}

export function toBig(amount: number | bigint): bigint {
  if (typeof amount === 'bigint') return amount;
  if (!Number.isSafeInteger(amount)) throw new MoneyError('AMOUNT_NOT_SAFE_INTEGER');
  return BigInt(amount);
}
export function toNum(x: bigint): number {
  const n = Number(x);
  if (!Number.isSafeInteger(n)) throw new MoneyError('AMOUNT_OVERFLOW');
  return n;
}

/** amount × rate, rounded to integer minor units. */
export function applyRate(amount: number | bigint, r: string | number | Rate, mode: Rounding = 'HALF_UP'): number {
  const q = rate(r);
  return toNum(divRound(toBig(amount) * q.num, q.den, mode));
}

/** amount × numerator ÷ denominator with a single rounding at the end. */
export function prorate(amount: number | bigint, numerator: number | bigint, denominator: number | bigint, mode: Rounding = 'HALF_UP'): number {
  return toNum(divRound(toBig(amount) * toBig(numerator), toBig(denominator), mode));
}

/** Split a total into parts proportional to weights using the largest-remainder method; Σ parts = total exactly. */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || weights.some(w => w < 0)) throw new MoneyError('ALLOCATION_WEIGHTS_INVALID');
  const T = toBig(total), S = toBig(sum);
  const raw = weights.map(w => { const n = T * toBig(w); return { q: n / S, r: n % S }; });
  const parts = raw.map(x => toNum(x.q));
  let diff = total - parts.reduce((a, b) => a + b, 0);
  const order = raw.map((x, i) => ({ i, r: x.r })).sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
  for (let k = 0; diff > 0; k = (k + 1) % order.length, diff--) parts[order[k].i] += 1;
  return parts;
}

/** Ratio as a rounded basis-point integer (10000 = 100%). Used for KPI ratios that are not money. */
export function ratioBp(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return toNum(divRound(toBig(numerator) * 10000n, toBig(denominator), 'HALF_UP'));
}
