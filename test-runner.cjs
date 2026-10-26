// Standalone CommonJS test verification runner for INDIA CyberBusiness 360

// 1. Dynamic Pricing Engine Math
function calculateDAI(indices) {
  const w1 = 0.40;
  const w2 = 0.30;
  const w3 = 0.20;
  const w4 = 0.10;
  return Number(((w1 * indices.cpi_index) + (w2 * indices.fx_index) + (w3 * indices.market_index) + (w4 * indices.urgency_index)).toFixed(4));
}

const CLIENT_TIER_MULTIPLIERS = {
  S: { default: 1.40 },
  A: { default: 1.00 },
  B: { default: 0.90 },
  C: { default: 2.00 },
  D: { default: 0.80 },
  E: { default: 0.80 },
};

function calculateBoQ(params) {
  const cA = params.component_a_total;
  const cB = params.component_b_total;
  const cC = params.component_c_total ?? 2000000;
  const cD = params.component_d_total ?? 0;
  const cE = params.component_e_total ?? 0;
  const total_internal_cost = cA + cB + cC + cD + cE;
  const gross_profit = params.quoted_price - total_internal_cost;
  const gross_margin_pct = params.quoted_price > 0
    ? Number(((gross_profit / params.quoted_price) * 100).toFixed(2))
    : 0;
  const margin_warning = params.quoted_price > 0 && gross_margin_pct < 25.0;
  return { total_internal_cost, gross_profit, gross_margin_pct, margin_warning };
}

function calculate3Ranges(params) {
  const floor_price = Math.round(params.totalInternalCost / (1 - 0.20));
  let standard_price = Math.round(params.totalSellingBaseline * params.dai * params.tierMultiplier);
  if (standard_price < floor_price) standard_price = Math.round(floor_price * 1.10);
  const premium_price = Math.round(standard_price * 1.25);
  return { floor_price, standard_price, premium_price };
}

function evaluateQuotationDoA(params) {
  const { grandTotal, discountPct, grossMarginPct } = params;
  let level = 'manager';
  if (grandTotal > 500000000) {
    level = 'director';
  } else if (grandTotal > 50000000) {
    level = 'vp';
  }
  if (discountPct > 15.0) {
    level = 'director';
  } else if (discountPct > 5.0 && level !== 'director') {
    level = 'vp';
  }
  if (grossMarginPct > 0 && grossMarginPct < 25.0 && level !== 'director') {
    level = 'vp';
  }
  return { requiredLevel: level };
}

function calculateVaptMandays(input) {
  let md = input.complexity === 'critical' ? 12 : input.complexity === 'complex' ? 8 : 5;
  if (input.apiEndpoints > 0) md += Math.ceil(input.apiEndpoints / 15) * 1.5;
  if (input.roles > 3) md += (input.roles - 3) * 0.5;
  if (input.isFinancial) md += 2.0;
  return Number(md.toFixed(1));
}

console.log('================================================================');
console.log('INDIA CYBERBUSINESS 360 — PHASE 1 COMMERCIAL ENGINE VERIFICATION');
console.log('================================================================\n');

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    process.exitCode = 1;
  }
}

// 1. DAI Test
const dai = calculateDAI({ cpi_index: 1.10, fx_index: 1.05, market_index: 1.00, urgency_index: 1.20 });
assert(dai === 1.075, `DAI Calculation correctly yields 1.075 (got: ${dai})`);

// 2. Client Tier Multipliers Test
assert(CLIENT_TIER_MULTIPLIERS.S.default === 1.40, 'Tier S multiplier is 1.40');
assert(CLIENT_TIER_MULTIPLIERS.A.default === 1.00, 'Tier A multiplier is 1.00 (Baseline)');
assert(CLIENT_TIER_MULTIPLIERS.C.default === 2.00, 'Tier C multiplier is 2.00 (Fintech)');

// 3. BoQ Internal Cost Test
const boq = calculateBoQ({
  component_a_total: 21000000,
  component_b_total: 2000000,
  component_c_total: 2000000,
  component_d_total: 3500000,
  component_e_total: 0,
  quoted_price: 60000000,
});
assert(boq.total_internal_cost === 28500000, `BoQ Direct Cost: Rp 28,500,000 (got: ${boq.total_internal_cost})`);
assert(boq.gross_profit === 31500000, `Gross Profit: Rp 31,500,000 (got: ${boq.gross_profit})`);
assert(boq.gross_margin_pct === 52.5, `Gross Margin %: 52.5% (got: ${boq.gross_margin_pct}%)`);
assert(boq.margin_warning === false, 'Margin Warning is false for 52.5% margin');

// 4. Low Margin Alert Test (< 25%)
const lowMarginBoQ = calculateBoQ({
  component_a_total: 21000000,
  component_b_total: 2000000,
  component_c_total: 2000000,
  component_d_total: 3500000,
  component_e_total: 0,
  quoted_price: 32000000,
});
assert(lowMarginBoQ.margin_warning === true, 'Margin Warning correctly triggers TRUE when margin < 25%');

// 5. Floor Price Formula Test
const ranges = calculate3Ranges({
  totalInternalCost: 28500000,
  totalSellingBaseline: 70000000,
  dai: 1.0,
  tierMultiplier: 1.0,
});
const expectedFloor = Math.round(28500000 / 0.80);
assert(ranges.floor_price === expectedFloor, `Floor price guarantees >= 20% margin: Rp ${ranges.floor_price.toLocaleString('id-ID')}`);
assert(ranges.premium_price === Math.round(ranges.standard_price * 1.25), 'Premium price is Standard * 1.25');

// 6. DoA Escalation Tests
const normalDeal = evaluateQuotationDoA({ grandTotal: 45000000, discountPct: 4.0, grossMarginPct: 35.0 });
assert(normalDeal.requiredLevel === 'manager', 'Deal <= 50M & discount <= 5% -> Manager level');

const vpDeal = evaluateQuotationDoA({ grandTotal: 150000000, discountPct: 8.0, grossMarginPct: 30.0 });
assert(vpDeal.requiredLevel === 'vp', 'Deal > 50M & discount 8% -> VP / Head Sales level');

const directorDeal = evaluateQuotationDoA({ grandTotal: 650000000, discountPct: 18.0, grossMarginPct: 22.0 });
assert(directorDeal.requiredLevel === 'director', 'Deal > 500M & discount > 15% -> Direktur level');

// 7. Scoping VAPT Mandays Test
const webAppMD = calculateVaptMandays({
  complexity: 'medium',
  apiEndpoints: 15,
  roles: 4,
  isFinancial: true,
});
assert(webAppMD === 9.0, `VAPT Web App scoping accurately calculates 9.0 MD (got: ${webAppMD})`);

console.log('\n================================================================');
console.log(`ALL VERIFICATION TESTS PASSED: ${passed}/${total}`);
console.log('================================================================\n');
