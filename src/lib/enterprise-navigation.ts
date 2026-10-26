/**
 * Canonical INDIA navigation: reuse existing, authenticated D1-backed routes.
 * This only shapes the UI. Every API must independently authorize role + object.
 * Do not add legacy demo pages or inferred approvals/KPI counts here.
 */
import type { BoQRole } from './boq-domain';

export type IndiaNavItem = {
  readonly label: string;
  readonly href: string;
  readonly roles: readonly BoQRole[];
};
export type IndiaNavGroup = {
  readonly id: string;
  readonly label: string;
  readonly items: readonly IndiaNavItem[];
};
const ALL: BoQRole[] = ['admin','marketing','sales','presales','finance','approver','legal','viewer'];
const COMMERCIAL: BoQRole[] = ['admin','sales','presales','finance','approver','legal'];
const SALES: BoQRole[] = ['admin','sales','approver','finance'];
const PRESALES: BoQRole[] = ['admin','presales','approver','finance','legal'];
const FINANCE: BoQRole[] = ['admin','finance','approver'];
const item = (label:string,href:string,roles: readonly BoQRole[]):IndiaNavItem => ({label,href,roles});

export const INDIA_NAVIGATION: readonly IndiaNavGroup[] = [
  {id:'workspace',label:'01 · Executive & My Workspace',items:[
    item('Executive Dashboard','/sales/executive',['admin','finance','approver']),
    item('Activity, SLA & Follow-up','/sales/activities',SALES),
    item('Sales Forecast','/sales/forecast',SALES),
  ]},
  {id:'marketing',label:'02 · Marketing & Lead Intelligence',items:[
    item('Campaign Management','/sales/campaigns',['admin','marketing','sales']),
    item('Lead Register','/sales/leads',['admin','marketing','sales']),
    item('Lead Scoring & Nurturing','/sales/lead-intelligence',['admin','marketing','sales']),
  ]},
  {id:'crm',label:'03 · Customer 360 & Sales CRM',items:[
    item('Customer 360','/customers',COMMERCIAL),
    item('Opportunity Pipeline','/sales/pipeline',SALES),
    item('Communication Timeline','/sales/communications',['admin','sales','approver','legal']),
  ]},
  {id:'presales',label:'04 · Presales, Tender & Solution',items:[
    item('Smart Scoping & Sizing','/scoping',['admin','presales','sales']),
    item('Tender Compliance','/sales/compliance',PRESALES),
    item('Bid Readiness','/sales/bid-readiness',PRESALES),
    item('Resource & Solution Feasibility','/sales/feasibility',PRESALES),
  ]},
  {id:'commercial',label:'05 · Commercial, Pricing & Approval',items:[
    item('BoQ Management','/boq',[...COMMERCIAL,'viewer']),
    item('Approval Center · Lintas Modul','/approvals',COMMERCIAL),
    item('PO / SPK Verification','/sales/award',['admin','sales','finance','approver','legal']),
    item('Submission & Proposal Evidence','/sales/submission',COMMERCIAL),
  ]},
  {id:'delivery',label:'06 · Project Delivery & Operations',items:[
    item('Service Delivery & Projects','/sales/delivery',['admin','presales','finance','approver']),
    item('Official Post-PO Forms','/post-po',['admin','sales','presales','finance','approver','legal']),
  ]},
  {id:'cash',label:'07 · Contract-to-Cash & Renewal',items:[
    item('Billing & Collections','/sales/billing',FINANCE),
    item('Revenue Register','/sales/revenue',FINANCE),
    item('Contracts & Renewal','/sales/renewals',COMMERCIAL),
    item('FlexGuard Token Wallet','/flexguard',['admin','sales','presales','finance','approver']),
  ]},
  {id:'partners',label:'08 · Vendor, OEM & Partners',items:[
    item('Vendor & Partner Records','/partners',PRESALES),
    item('Procurement & Supplier','/sales/procurement',PRESALES),
  ]},
  {id:'reporting',label:'09 · Reporting, Analytics & AI',items:[
    item('Enterprise Reports','/reports',['admin','marketing','sales','finance','approver']),
  ]},
  {id:'governance',label:'10 · Document Center & Governance',items:[
    item('Secure Document Vault','/sales/documents',COMMERCIAL),
  ]},
  {id:'administration',label:'11 · Administrasi · Khusus Admin',items:[
    item('Registrasi User','/boq/users',['admin']),
    item('Parameter','/settings/system',['admin']),
    item('Opsi','/settings/options',['admin']),
    item('Registrasi Opsi Standar','/settings/option-registry',['admin']),
    item('API Key','/settings/ai',['admin']),
  ]},
] as const;

export function navigationForRole(role: string|null|undefined):IndiaNavGroup[] {
  if(!role || !ALL.includes(role as BoQRole))return [];
  return INDIA_NAVIGATION.map(group=>({...group,items:group.items.filter(link=>link.roles.includes(role as BoQRole))}))
    .filter(group=>group.items.length>0);
}

export function firstAccessibleHref(role:string|null|undefined):string|null {
  return navigationForRole(role)[0]?.items[0]?.href??null;
}
