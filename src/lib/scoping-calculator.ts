// INDIA CyberBusiness 360 Smart Scoping Sizing Engine
// Sourced from the pricing/proposal schema & Technotama VAPT/SOC guidelines

import { BoxMethod, VaptScopingInput, SocScopingInput } from './types';

export function calculateVaptMandays(input: Partial<VaptScopingInput>): number {
  let md = 0;
  const boxMultiplier: Record<BoxMethod, number> = {
    black_box: 0.9,
    grey_box: 1.0,
    white_box: 1.3,
  };
  const boxFactor = boxMultiplier[input.box_method || 'grey_box'] || 1.0;

  switch (input.vapt_type) {
    case 'web_app': {
      const baseComplexity: Record<string, number> = {
        simple: 3,
        medium: 5,
        complex: 8,
        critical: 12,
      };
      md = baseComplexity[input.web_complexity || 'medium'] || 5;

      if (input.web_n_api_endpoints && input.web_n_api_endpoints > 0) {
        md += Math.ceil(input.web_n_api_endpoints / 15) * 1.5;
      }
      if (input.web_n_roles && input.web_n_roles > 3) {
        md += (input.web_n_roles - 3) * 0.5;
      }
      break;
    }
    case 'mobile_app': {
      const baseComplexity: Record<string, number> = {
        simple: 3,
        medium: 5,
        complex: 8,
      };
      md = baseComplexity[input.mobile_complexity || 'medium'] || 5;
      if (input.mobile_platform === 'both') {
        md = Math.round(md * 1.7);
      }
      if (input.mobile_n_screens && input.mobile_n_screens > 10) {
        md += Math.ceil((input.mobile_n_screens - 10) / 5) * 1.0;
      }
      break;
    }
    case 'api': {
      const endpoints = input.api_n_endpoints || 10;
      md = Math.max(3, Math.ceil(endpoints / 10) * 2.0);
      if (!input.api_has_docs) {
        md += 2.0; // Reverse engineering Swagger/Postman effort
      }
      break;
    }
    case 'network_infra': {
      const extIps = input.net_n_external_ip || 0;
      const intHosts = input.net_n_internal_host || 0;
      md = Math.ceil(extIps / 8) * 1.5 + Math.ceil(intHosts / 20) * 2.0;
      if (input.net_has_ad) md += 3.0;
      md = Math.max(3, md);
      break;
    }
    case 'red_team': {
      const scopeMap: Record<string, number> = {
        assumed_breach: 15,
        limited: 20,
        standard: 30,
        full_apt: 45,
      };
      md = scopeMap[input.redteam_scope || 'standard'] || 30;
      break;
    }
    case 'source_code': {
      md = 7;
      break;
    }
    default:
      md = 5;
  }

  // Multiply by box methodology
  md = md * boxFactor;

  // Financial / Regulated compliance minimum rule
  if (input.is_financial_compliance) {
    md += 2.0;
  }

  return Number(md.toFixed(1));
}

export function calculateSocSizing(input: Partial<SocScopingInput>): {
  calculated_eps: number;
  eps_tier: 'micro' | 'small' | 'medium' | 'large' | 'enterprise';
  recommended_mrc: number;
} {
  const intensityMap: Record<string, number> = {
    low: 0.7,
    medium: 1.0,
    high: 1.5,
  };
  const factor = intensityMap[input.traffic_intensity || 'medium'] || 1.0;

  const serverEPS = (input.n_servers || 0) * 35;
  const netEPS = (input.n_network_devices || 0) * 25;
  const endpointEPS = (input.n_endpoints || 0) * 2;
  const cloudEPS = (input.n_cloud_services || 0) * 20;
  const webEPS = (input.n_web_apps || 0) * 15;
  const adEPS = input.has_active_directory ? 120 : 0;

  const rawEPS = (serverEPS + netEPS + endpointEPS + cloudEPS + webEPS + adEPS) * factor;
  const calculated_eps = Math.max(50, Math.round(rawEPS));

  let eps_tier: 'micro' | 'small' | 'medium' | 'large' | 'enterprise' = 'small';
  let baseMRC = 25000000; // Rp 25jt

  if (calculated_eps <= 250) {
    eps_tier = 'micro';
    baseMRC = 20000000;
  } else if (calculated_eps <= 1000) {
    eps_tier = 'small';
    baseMRC = 35000000;
  } else if (calculated_eps <= 3000) {
    eps_tier = 'medium';
    baseMRC = 65000000;
  } else if (calculated_eps <= 10000) {
    eps_tier = 'large';
    baseMRC = 125000000;
  } else {
    eps_tier = 'enterprise';
    baseMRC = 220000000;
  }

  if (input.service_level === '24x7') {
    baseMRC = Math.round(baseMRC * 1.5);
  }
  if (input.has_threat_hunting) {
    baseMRC += 15000000;
  }
  if (input.has_ir_retainer) {
    baseMRC += 12000000;
  }

  return {
    calculated_eps,
    eps_tier,
    recommended_mrc: baseMRC,
  };
}
