// Test Verification Script for ICOP CyberBusiness 360 Core Engines
// Verifies Dynamic Pricing, BoQ, DoA, and Scoping formulas

import {
  calculateDAI,
  calculateHRCost,
  calculateBoQ,
  calculate3Ranges,
  CLIENT_TIER_MULTIPLIERS,
} from './src/lib/pricing-engine';
import { evaluateQuotationDoA } from './src/lib/doa-engine';
import { calculateVaptMandays, calculateSocSizing } from './src/lib/scoping-calculator';
import { generateQuotationNumber, getRomanMonth } from './src/lib/formatters';

console.log('================================================================');
console.log('ICOP CYBERBUSINESS 360 — PHASE 1 CORE COMMERCIAL TEST SUITE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${testName}`);
    process.exitCode = 1;
  }
}

// 1. DAI Calculation Test
const testDAI = calculateDAI({
  cpi_index: 1.10,
  fx_index: 1.05,
  market_index: 1.00,
  urgency_index: 1.20,
});
// 0.4*1.10 (0.44) + 0.3*1.05 (0.315) + 0.2*1.00 (0.20) + 0.1*1.20 (0.12) = 1.075
assert(testDAI === 1.075, `DAI Calculation correctly yields 1.075 (got: ${testDAI})`);

// 2. Client Tier Multipliers Test
assert(CLIENT_TIER_MULTIPLIERS['S'].default === 1.40, 'Tier S multiplier is 1.40 (BUMN Holding/Tier 1 Bank)');
assert(CLIENT_TIER_MULTIPLIERS['A'].default === 1.00, 'Tier A multiplier is 1.00 (Enterprise Tbk Baseline)');
assert(CLIENT_TIER_MULTIPLIERS['C'].default === 2.00, 'Tier C multiplier is 2.00 (High-Growth Fintech)');

// 3. HR Cost & BoQ Calculation Test
const staffing = [
  { role_level: 'project_manager' as const, mandays: 2 }, // 2 * 1.5jt = 3jt
  { role_level: 'lead' as const, mandays: 4 },            // 4 * 2.0jt = 8jt
  { role_level: 'senior' as const, mandays: 8 },          // 8 * 1.0jt = 8jt
  { role_level: 'junior' as const, mandays: 4 },          // 4 * 0.5jt = 2jt
];
const hrResult = calculateHRCost(staffing, 'remote');
assert(hrResult.totalHRCost === 21000000, `Component A HR Cost equals Rp 21 Juta (got: ${hrResult.totalHRCost})`);

// 4. BoQ Internal & Floor Price Test
const boq = calculateBoQ({
  component_a_total: 21000000,
  component_b_total: 2000000,
  component_c_total: 2000000,
  component_d_total: 3500000,
  component_e_total: 0,
  quoted_price: 60000000,
});
assert(boq.total_internal_cost === 28500000, `Total direct internal cost is Rp 28.5 Juta (got: ${boq.total_internal_cost})`);
assert(boq.gross_profit === 31500000, `Gross profit is Rp 31.5 Juta (got: ${boq.gross_profit})`);
assert(boq.gross_margin_pct === 52.5, `Gross margin pct is 52.5% (got: ${boq.gross_margin_pct}%)`);
assert(boq.margin_warning === false, 'Margin warning is false for 52.5% margin (threshold >= 25%)');

// 5. Margin Warning Low Margin Test
const lowMarginBoQ = calculateBoQ({
  component_a_total: 21000000,
  component_b_total: 2000000,
  component_c_total: 2000000,
  component_d_total: 3500000,
  component_e_total: 0,
  quoted_price: 32000000,
});
// (32M - 28.5M) / 32M = 3.5 / 32 = 10.94% (< 25%)
assert(lowMarginBoQ.margin_warning === true, 'Margin warning triggers TRUE when margin < 25%');

// 6. Floor Price Formula Test: Cost / (1 - 0.20)
const ranges = calculate3Ranges({
  totalInternalCost: 28500000,
  totalSellingBaseline: 70000000,
  dai: 1.0,
  tierMultiplier: 1.0,
});
const expectedFloor = Math.round(28500000 / 0.80); // 35625000
assert(ranges.floor_price === expectedFloor, `Floor price correctly guarantees >= 20% margin: ${ranges.floor_price}`);
assert(ranges.premium_price === Math.round(ranges.standard_price * 1.25), 'Premium price is Standard * 1.25');

// 7. DoA Matrix Escalation Tests
const normalDeal = evaluateQuotationDoA({
  grandTotal: 45000000,
  discountPct: 4.0,
  grossMarginPct: 35.0,
});
assert(normalDeal.requiredLevel === 'manager', 'Deal <= Rp 50M with <= 5% discount requires Manager level');

const vpDeal = evaluateQuotationDoA({
  grandTotal: 150000000,
  discountPct: 8.0,
  grossMarginPct: 30.0,
});
assert(vpDeal.requiredLevel === 'vp', 'Deal > Rp 50M with 8% discount requires VP / Head Sales level');

const directorDeal = evaluateQuotationDoA({
  grandTotal: 650000000,
  discountPct: 18.0,
  grossMarginPct: 22.0,
});
assert(directorDeal.requiredLevel === 'director', 'Deal > Rp 500M and discount > 15% requires Direktur level');

// 8. Smart Scoping VAPT Mandays Test
const webAppMD = calculateVaptMandays({
  vapt_type: 'web_app',
  web_complexity: 'medium',
  box_method: 'grey_box',
  is_financial_compliance: true,
  web_n_api_endpoints: 15,
  web_n_roles: 4,
});
// Base 5 + ceil(15/15)*1.5 (1.5) + (4-3)*0.5 (0.5) = 7.0 * 1.0 + 2.0 (financial) = 9.0 MD
assert(webAppMD === 9.0, `VAPT Web App scoping accurately calculates 9.0 MD (got: ${webAppMD})`);

// 9. Quotation Numbering Format Test
const qNum = generateQuotationNumber(15, 1);
const romanNow = getRomanMonth();
const yearNow = new Date().getFullYear();
assert(qNum === `015/DEIT-RCS/${romanNow}/${yearNow}`, `Quotation number format matches NNN/DEIT-RCS/MM/YYYY: ${qNum}`);

const qNumRev = generateQuotationNumber(15, 2);
assert(qNumRev === `015/DEIT-RCS/${romanNow}/${yearNow}/REV-1`, `Revision number includes /REV-1 suffix: ${qNumRev}`);

console.log('\n================================================================');
console.log(`TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('================================================================');
