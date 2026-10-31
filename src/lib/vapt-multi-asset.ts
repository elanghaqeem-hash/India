/**
 * One VAPT engagement may include several distinct assets, even of the same type.
 * Each line is estimated with the existing validated single-asset calculator.
 * The portfolio sum is an engineering estimate, NOT a quoted price.
 */
import { calculateVaptMandays } from './scoping-calculator';
import type { VaptScopingInput, VaptType } from './types';

export const VAPT_ASSET_TYPES: ReadonlyArray<{ id: VaptType; label: string }> = [
  { id: 'web_app', label: 'Web Application' },
  { id: 'mobile_app', label: 'Mobile App (Android/iOS)' },
  { id: 'api', label: 'API / Microservices' },
  { id: 'network_infra', label: 'Network & Infra' },
  { id: 'red_team', label: 'Red Team Simulation' },
  { id: 'source_code', label: 'Source Code Review' },
];

export type VaptAsset = Partial<Omit<VaptScopingInput, 'calculated_md'>> &
  Pick<VaptScopingInput, 'vapt_type' | 'box_method' | 'is_financial_compliance'> & {
    id: string;
    name: string;
    asset_count: number;
  };

export function createVaptAsset(id: string, type: VaptType = 'web_app'): VaptAsset {
  return {
    id,
    name: VAPT_ASSET_TYPES.find(x => x.id === type)?.label || 'Aset VAPT',
    asset_count: 1,
    vapt_type: type,
    box_method: 'grey_box',
    is_financial_compliance: false,
    web_complexity: 'medium',
    web_n_api_endpoints: 0,
    web_n_roles: 4,
    mobile_platform: 'both',
    mobile_complexity: 'medium',
    mobile_n_screens: 18,
    api_n_endpoints: 15,
    api_has_docs: false,
    net_n_internal_host: 20,
    net_n_external_ip: 0,
    net_has_ad: false,
    redteam_scope: 'standard',
  };
}

const validCount = (x: unknown, minimum = 0, maximum = 100000): x is number =>
  typeof x === 'number' && Number.isSafeInteger(x) && x >= minimum && x <= maximum;

/** Errors are scoped by asset index so the UI can explain the blocked transfer. */
export function validateVaptAssets(assets: readonly VaptAsset[]): string[] {
  if (!assets.length) return ['Tambahkan sedikitnya satu aset'];
  if (assets.length > 30) return ['Maksimal 30 baris aset per scoping'];
  const problems: string[] = [];
  const ids = new Set<string>();
  assets.forEach((asset, index) => {
    const row = 'Aset ' + (index + 1);
    if (!asset.id || ids.has(asset.id)) problems.push(row + ': ID duplikat');
    ids.add(asset.id);
    if (!asset.name.trim() || asset.name.trim().length > 120) problems.push(row + ': nama wajib (maksimal 120 karakter)');
    if (!VAPT_ASSET_TYPES.some(t => t.id === asset.vapt_type)) problems.push(row + ': kategori tidak dikenal');
    if (!['black_box', 'grey_box', 'white_box'].includes(asset.box_method)) problems.push(row + ': metodologi tidak valid');
    if (!validCount(asset.asset_count, 1, 100)) problems.push(row + ': jumlah aset harus 1–100');
    switch (asset.vapt_type) {
      case 'web_app':
        if (!['simple', 'medium', 'complex', 'critical'].includes(asset.web_complexity || '')) problems.push(row + ': kompleksitas web tidak valid');
        if (!validCount(asset.web_n_api_endpoints)) problems.push(row + ': jumlah API web tidak valid');
        if (!validCount(asset.web_n_roles, 1)) problems.push(row + ': jumlah role minimal 1');
        break;
      case 'api':
        if (!validCount(asset.api_n_endpoints, 1)) problems.push(row + ': jumlah endpoint API minimal 1');
        break;
      case 'mobile_app':
        if (!['android', 'ios', 'both'].includes(asset.mobile_platform || '')) problems.push(row + ': platform tidak valid');
        if (!['simple', 'medium', 'complex'].includes(asset.mobile_complexity || '')) problems.push(row + ': kompleksitas mobile tidak valid');
        if (!validCount(asset.mobile_n_screens, 1)) problems.push(row + ': jumlah layar minimal 1');
        break;
      case 'network_infra':
        if (!validCount(asset.net_n_internal_host) || !validCount(asset.net_n_external_ip) ||
          ((asset.net_n_internal_host || 0) + (asset.net_n_external_ip || 0) === 0)) {
          problems.push(row + ': isi jumlah host/IP yang valid (minimal satu)');
        }
        break;
      case 'red_team':
        if (!['assumed_breach', 'limited', 'standard', 'full_apt'].includes(asset.redteam_scope || '')) problems.push(row + ': skenario tidak valid');
        break;
    }
  });
  if (problems.length === 0 && calculateVaptPortfolio(assets).total_md > 100000) {
    problems.push('Total effort melebihi batas 100.000 MD untuk BoQ');
  }
  return problems;
}

export function calculateVaptAssetMandays(asset: VaptAsset): number {
  if (!validCount(asset.asset_count, 1, 100)) return 0;
  return Number((calculateVaptMandays(asset) * asset.asset_count).toFixed(1));
}

export function calculateVaptPortfolio(assets: readonly VaptAsset[]): {
  total_md: number;
  rows: Array<{ id: string; name: string; asset_count: number; md: number }>;
} {
  const rows = assets.map(asset => ({
    id: asset.id,
    name: asset.name,
    asset_count: asset.asset_count,
    md: calculateVaptAssetMandays(asset),
  }));
  return { rows, total_md: Number(rows.reduce((sum, row) => sum + row.md, 0).toFixed(1)) };
}

export function describeVaptAsset(asset: VaptAsset): string {
  const detail: string[] = [];
  switch (asset.vapt_type) {
    case 'web_app':
      detail.push('kompleksitas ' + asset.web_complexity, 'API ' + asset.web_n_api_endpoints, 'role ' + asset.web_n_roles);
      break;
    case 'mobile_app':
      detail.push('platform ' + asset.mobile_platform, 'kompleksitas ' + asset.mobile_complexity, 'layar ' + asset.mobile_n_screens);
      break;
    case 'api':
      detail.push('endpoint ' + asset.api_n_endpoints, 'dokumentasi ' + (asset.api_has_docs ? 'tersedia' : 'belum tersedia'));
      break;
    case 'network_infra':
      detail.push('host internal ' + asset.net_n_internal_host, 'IP eksternal ' + asset.net_n_external_ip,
        'AD ' + (asset.net_has_ad ? 'ya' : 'tidak'));
      break;
    case 'red_team':
      detail.push('skenario ' + asset.redteam_scope);
      break;
    case 'source_code':
      detail.push('codebase sesuai ruang lingkup yang disepakati');
      break;
  }
  const category = VAPT_ASSET_TYPES.find(x => x.id === asset.vapt_type)?.label || asset.vapt_type;
  return ('VAPT | ' + asset.name.trim() + ' | ' + category + ' | ' + asset.asset_count + ' aset | ' +
    asset.box_method.replaceAll('_', ' ') + ' | regulasi ' + (asset.is_financial_compliance ? 'ya' : 'tidak') +
    ' | ' + detail.join('; ') + ' | estimasi ' + calculateVaptAssetMandays(asset) + ' MD').slice(0, 900);
}

export function vaptAssetBoqLines(assets: readonly VaptAsset[]) {
  if (validateVaptAssets(assets).length) throw new Error('Lengkapi parameter multi-aset VAPT sebelum transfer');
  return assets.map(asset => ({
    description: describeVaptAsset(asset),
    quantity: calculateVaptAssetMandays(asset),
    unit: 'MD',
    service_type: 'VAPT',
  }));
}
