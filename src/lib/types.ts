// INDIA CyberBusiness 360 Core Types & Enums
// Sourced from the database schemas and BRD v2.0 / PreDev Decisions

export type SystemRole =
  | 'super_admin'
  | 'head_sales'
  | 'sales'
  | 'pre_sales'
  | 'channel_partner'
  | 'project_manager'
  | 'pentest_lead'
  | 'pentest_member'
  | 'approval_pentest'
  | 'soc_lead'
  | 'soc_analyst'
  | 'finance'
  | 'collection'
  | 'admin_legal'
  | 'strategic_legal'
  | 'hr'
  | 'management'
  | 'client_maker'
  | 'client_approver';

export type ClientTier = 'S' | 'A' | 'B' | 'C' | 'D' | 'E';

export type IndustryType =
  | 'Banking'
  | 'Asuransi'
  | 'Multifinance'
  | 'Sekuritas'
  | 'Fintech'
  | 'BUMN'
  | 'Pemerintah'
  | 'Healthcare'
  | 'Retail'
  | 'Manufaktur'
  | 'Lainnya';

export type OpportunityStage =
  | 'prospecting'     // 10%
  | 'qualified'       // 25%
  | 'quotation_sent'  // 40%
  | 'negotiation'     // 60%
  | 'po_received'     // 85%
  | 'closed_won'      // 100%
  | 'closed_lost';    // 0%

export type ServiceType =
  | 'VAPT'
  | 'SOC'
  | 'CTI'
  | 'ISO'
  | 'PDP'
  | 'Hardening'
  | 'IR'
  | 'Lainnya';

export type ProposalStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'cancelled';

export type PaymentTerms = '30-50-20' | '30-60-10' | '50-50' | '100';

export type PriceRange = 'floor' | 'standard' | 'premium';

export type LocationType = 'remote' | 'jabotabek' | 'luar_jabotabek' | 'overseas';

export type RoleLevel =
  | 'project_manager'
  | 'lead'
  | 'senior'
  | 'junior'
  | 'forensic'
  | 'sme_external'
  | 'soc_analyst_l1'
  | 'soc_analyst_l2'
  | 'cti_analyst'
  | 'technical_writer';

export type VaptType =
  | 'web_app'
  | 'mobile_app'
  | 'api'
  | 'network_infra'
  | 'red_team'
  | 'source_code';

export type BoxMethod = 'black_box' | 'grey_box' | 'white_box';

export type TokenTxType =
  | 'ISSUANCE'
  | 'RESERVE'
  | 'RELEASE'
  | 'DEBIT'
  | 'TOPUP'
  | 'EXPIRY'
  | 'ADJUSTMENT';

export interface Company {
  id: string;
  name: string;
  legal_name?: string;
  customer_id: string;
  npwp?: string;
  industry: IndustryType;
  client_tier: ClientTier;
  address?: string;
  city?: string;
  contacts: Contact[];
  created_at: string;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role_title?: string;
  is_primary?: boolean;
}

export interface Opportunity {
  id: string;
  company_id: string;
  company_name: string;
  name: string;
  stage: OpportunityStage;
  service_type: ServiceType;
  estimated_value: number;
  probability: number;
  expected_closing_date: string;
  account_manager: string;
  notes?: string;
  created_at: string;
}

// Scoping models
export interface VaptScopingInput {
  vapt_type: VaptType;
  box_method: BoxMethod;
  is_financial_compliance: boolean;
  
  // Web
  web_complexity?: 'simple' | 'medium' | 'complex' | 'critical';
  web_n_modules?: number;
  web_n_roles?: number;
  web_n_api_endpoints?: number;

  // Mobile
  mobile_platform?: 'android' | 'ios' | 'both';
  mobile_complexity?: 'simple' | 'medium' | 'complex';
  mobile_n_screens?: number;

  // API
  api_n_endpoints?: number;
  api_has_docs?: boolean;

  // Network
  net_n_external_ip?: number;
  net_n_internal_host?: number;
  net_has_ad?: boolean;

  // Red Team
  redteam_scope?: 'assumed_breach' | 'limited' | 'standard' | 'full_apt';

  calculated_md: number;
}

export interface SocScopingInput {
  n_servers: number;
  n_network_devices: number;
  n_endpoints: number;
  n_cloud_services: number;
  n_web_apps: number;
  has_active_directory: boolean;
  traffic_intensity: 'low' | 'medium' | 'high';
  contract_duration_months: number;
  service_level: '8x5' | '12x5' | '24x7';
  has_threat_hunting: boolean;
  has_ir_retainer: boolean;

  calculated_eps: number;
  eps_tier: 'micro' | 'small' | 'medium' | 'large' | 'enterprise';
}

// Dynamic Pricing & BoQ Models
export interface DAIIndices {
  cpi_index: number;    // default 1.0 (weight 0.40)
  fx_index: number;     // default 1.0 (weight 0.30)
  market_index: number; // default 1.0 (weight 0.20)
  urgency_index: number;// default 1.0 (weight 0.10)
}

export interface BoQHRDetail {
  role_level: RoleLevel;
  mandays: number;
  daily_cost_rate: number;
  subtotal: number;
}

export interface BoQInternal {
  component_a_total: number; // HR Cost
  component_b_total: number; // Sales & Partner Commission
  component_c_total: number; // Deliverables & Printing (Default Rp 2,000,000)
  component_d_total: number; // Third party tools & subcon
  component_e_total: number; // Travel & Accommodation
  total_internal_cost: number;
  quoted_price: number;
  gross_profit: number;
  gross_margin_pct: number;
  margin_warning: boolean;   // Gross margin < 25%
}

export interface PricingSession {
  id: string;
  opportunity_id: string;
  version: number;
  service_type: ServiceType;
  client_tier: ClientTier;
  tier_multiplier: number;
  location_type: LocationType;
  dai: DAIIndices;
  calculated_dai: number;
  total_md?: number;
  total_eps?: number;
  floor_price: number;
  standard_price: number;
  premium_price: number;
  selected_range: PriceRange;
  final_price: number;
  boq: BoQInternal;
  hr_details: BoQHRDetail[];
  notes?: string;
  created_at: string;
}

// Proposal & Quotation Models
export interface ProposalLineItem {
  line_number: number;
  service_type: ServiceType;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
}

export interface Proposal {
  id: string;
  opportunity_id: string;
  opportunity_name: string;
  company_id: string;
  company_name: string;
  quotation_number: string;
  version: number;
  status: ProposalStatus;
  subtotal: number;
  vat_amount: number;
  grand_total: number;
  discount_pct: number;
  payment_terms: PaymentTerms;
  valid_days: number;
  valid_until: string;
  client_tier: ClientTier;
  selected_price_range: PriceRange;
  line_items: ProposalLineItem[];
  created_by: string;
  submitted_at?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  sent_at?: string;
  accepted_at?: string;
  notes?: string;
  created_at: string;
}

// Approval Models
export interface ApprovalRequest {
  id: string;
  entity_type: 'quotation' | 'discount' | 'margin_exception' | 'tender' | 'contract';
  entity_id: string;
  title: string;
  requestor_name: string;
  requestor_role: SystemRole;
  required_level: 'manager' | 'vp' | 'director';
  status: 'pending' | 'approved' | 'rejected' | 'revision_requested';
  transaction_value: number;
  discount_pct: number;
  gross_margin_pct: number;
  reason?: string;
  comments?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
}

// FlexGuard Models
export interface FlexGuardWallet {
  id: string;
  company_id: string;
  company_name: string;
  contract_number: string;
  purchased_mandays: number;
  unit_rate: number;
  total_contract_value: number;
  available_balance: number;
  reserved_balance: number;
  consumed_balance: number;
  expiry_date: string;
  transactions: FlexGuardTransaction[];
}

export interface FlexGuardTransaction {
  id: string;
  tx_type: TokenTxType;
  mandays: number;
  service_scope: string;
  reference_code: string;
  executed_by: string;
  notes?: string;
  created_at: string;
}

// AI Multi-Provider Configuration (Admin Priority Controlled)
export type AIProviderType = 'gemini' | 'openai' | 'anthropic' | 'groq' | 'local';

export interface AIProviderConfig {
  id: string;
  provider: AIProviderType;
  name: string;
  apiKey: string;
  model: string;
  priority: number; // 1 = highest priority, cascading downwards
  isEnabled: boolean;
  status: 'active' | 'standby' | 'error' | 'unconfigured';
  lastTestedAt?: string;
  statusMessage?: string;
}

export interface AIServiceResponse {
  providerUsed: string;
  modelUsed: string;
  content: string;
  latencyMs: number;
  tokensEstimate: number;
  isFallback: boolean;
}

// Tender Management Models (Modul 2)
export type TenderSource = 'SiRUP' | 'LPSE' | 'BUMN' | 'Swasta' | 'Undangan Langsung' | 'Lainnya';
export type BidDecision = 'pending' | 'go' | 'conditional_go' | 'no_go';

export interface Tender {
  id: string;
  code: string;
  title: string;
  source: TenderSource;
  agency_name: string;
  pagu_budget: number;
  hps_budget: number;
  service_type: ServiceType;
  deadline_submission: string;
  eligibility_status: 'qualified' | 'needs_partner' | 'disqualified';
  bid_decision: BidDecision;
  bid_score: number;
  summary?: string;
  created_at: string;
}
