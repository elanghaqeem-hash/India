// INDIA CyberBusiness 360 In-Memory Preview Store
// Seeded with realistic data from BRD v2.0 & Technotama test scenarios.
// Preview state is deliberately non-persistent.

import {
  Company,
  Opportunity,
  PricingSession,
  Proposal,
  ApprovalRequest,
  FlexGuardWallet,
  Tender,
  AIProviderConfig,
  FlexGuardTransaction,
  ProposalStatus,
} from './types';
import { DEFAULT_AI_CONFIGS } from './ai-engine';

export interface AppStore {
  companies: Company[];
  opportunities: Opportunity[];
  pricingSessions: PricingSession[];
  proposals: Proposal[];
  approvals: ApprovalRequest[];
  wallets: FlexGuardWallet[];
  tenders: Tender[];
  aiConfigs: AIProviderConfig[];
}

// Initial Seed Data
const INITIAL_COMPANIES: Company[] = [
  {
    id: 'comp-01',
    name: 'PT Bank Central Nusantara Tbk',
    legal_name: 'PT Bank Central Nusantara Tbk',
    customer_id: 'DEIT-2026-001',
    npwp: '01.234.567.8-012.000',
    industry: 'Banking',
    client_tier: 'A',
    address: 'Jl. Jend. Sudirman Kav. 52-53, SCBD',
    city: 'Jakarta Selatan',
    contacts: [
      { id: 'c-1', name: 'Budi Santoso', email: 'budi.santoso@bcn.co.id', phone: '0811987654', role_title: 'Head of Information Security', is_primary: true },
      { id: 'c-2', name: 'Dewi Lestari', email: 'dewi.lestari@bcn.co.id', phone: '0812345678', role_title: 'Procurement Specialist', is_primary: false },
    ],
    created_at: '2026-01-15T09:00:00Z',
  },
  {
    id: 'comp-02',
    name: 'PT Telco Mandiri Solusindo (BUMN)',
    legal_name: 'PT Telco Mandiri Solusindo',
    customer_id: 'DEIT-2026-002',
    npwp: '02.345.678.9-023.000',
    industry: 'BUMN',
    client_tier: 'S',
    address: 'Menara Mandiri Lt. 18, Jl. Gatot Subroto',
    city: 'Jakarta Selatan',
    contacts: [
      { id: 'c-3', name: 'Rian Pratama', email: 'rian.pratama@telcoms.id', phone: '0813998877', role_title: 'VP Technology & Risk', is_primary: true },
    ],
    created_at: '2026-02-10T10:30:00Z',
  },
  {
    id: 'comp-03',
    name: 'PT Dompet Kilat Nusantara (PayFintech)',
    legal_name: 'PT Dompet Kilat Nusantara',
    customer_id: 'DEIT-2026-003',
    npwp: '03.456.789.0-034.000',
    industry: 'Fintech',
    client_tier: 'C',
    address: 'Pacific Century Place Lt. 21, SCBD',
    city: 'Jakarta Selatan',
    contacts: [
      { id: 'c-4', name: 'Michael Chen', email: 'michael@dompetkilat.id', phone: '0818223344', role_title: 'Chief Technology Officer', is_primary: true },
    ],
    created_at: '2026-03-05T14:15:00Z',
  },
  {
    id: 'comp-04',
    name: 'BPR Sejahtera Abadi Mandiri',
    legal_name: 'PT BPR Sejahtera Abadi Mandiri',
    customer_id: 'DEIT-2026-004',
    npwp: '04.567.890.1-045.000',
    industry: 'Banking',
    client_tier: 'E',
    address: 'Jl. Pemuda No. 88',
    city: 'Semarang',
    contacts: [
      { id: 'c-5', name: 'Agus Wijaya', email: 'agus@bprs-abadi.co.id', phone: '0856112233', role_title: 'Direktur Kepatuhan & IT', is_primary: true },
    ],
    created_at: '2026-04-12T11:00:00Z',
  },
];

const INITIAL_OPPORTUNITIES: Opportunity[] = [
  {
    id: 'opp-01',
    company_id: 'comp-01',
    company_name: 'PT Bank Central Nusantara Tbk',
    name: 'Annual Mobile & Internet Banking VAPT 2026',
    stage: 'quotation_sent',
    service_type: 'VAPT',
    estimated_value: 175000000,
    probability: 60,
    expected_closing_date: '2026-11-30',
    account_manager: 'M. Nadhil',
    notes: 'Kebutuhan pemenuhan POJK & SEOJK tahunan untuk core digital banking',
    created_at: '2026-10-01T08:00:00Z',
  },
  {
    id: 'opp-02',
    company_id: 'comp-02',
    company_name: 'PT Telco Mandiri Solusindo (BUMN)',
    name: '24x7 SOC/MDR Monitoring & Threat Hunting (12 Bulan)',
    stage: 'negotiation',
    service_type: 'SOC',
    estimated_value: 780000000,
    probability: 75,
    expected_closing_date: '2026-12-15',
    account_manager: 'M. Nadhil',
    notes: 'Monitoring 500 endpoint + 80 server BUMN, SLA 24x7 15 menit',
    created_at: '2026-09-15T09:30:00Z',
  },
  {
    id: 'opp-03',
    company_id: 'comp-03',
    company_name: 'PT Dompet Kilat Nusantara (PayFintech)',
    name: 'FlexGuard Cybersecurity Token Wallet (100 MD)',
    stage: 'qualified',
    service_type: 'VAPT',
    estimated_value: 243000000,
    probability: 50,
    expected_closing_date: '2026-11-20',
    account_manager: 'Siti Sarah',
    notes: 'Model token wallet on-demand untuk security sprint release setiap 2 minggu',
    created_at: '2026-10-10T14:00:00Z',
  },
];

const INITIAL_PROPOSALS: Proposal[] = [
  {
    id: 'prop-01',
    opportunity_id: 'opp-01',
    opportunity_name: 'Annual Mobile & Internet Banking VAPT 2026',
    company_id: 'comp-01',
    company_name: 'PT Bank Central Nusantara Tbk',
    quotation_number: '014/DEIT-RCS/X/2026',
    version: 1,
    status: 'approved',
    subtotal: 155000000,
    vat_amount: 17050000,
    grand_total: 172050000,
    discount_pct: 0,
    payment_terms: '30-50-20',
    valid_days: 14,
    valid_until: '2026-11-03',
    client_tier: 'A',
    selected_price_range: 'standard',
    line_items: [
      {
        line_number: 1,
        service_type: 'VAPT',
        description: 'Penetration Testing Mobile Banking Application (Android & iOS) Grey-Box',
        quantity: 1,
        unit: 'Paket',
        unit_price: 85000000,
        line_total: 85000000,
      },
      {
        line_number: 2,
        service_type: 'VAPT',
        description: 'Penetration Testing Internet Banking Web App & Microservice APIs Grey-Box',
        quantity: 1,
        unit: 'Paket',
        unit_price: 70000000,
        line_total: 70000000,
      },
    ],
    created_by: 'M. Nadhil (Sales)',
    submitted_at: '2026-10-18T10:00:00Z',
    approved_by: 'Reza Fahlevi (Head Sales)',
    approved_at: '2026-10-19T11:30:00Z',
    notes: 'Disetujui oleh Head Sales. Memenuhi margin target 38.5%.',
    created_at: '2026-10-18T09:00:00Z',
  },
  {
    id: 'prop-02',
    opportunity_id: 'opp-02',
    opportunity_name: '24x7 SOC/MDR Monitoring & Threat Hunting (12 Bulan)',
    company_id: 'comp-02',
    company_name: 'PT Telco Mandiri Solusindo (BUMN)',
    quotation_number: '015/DEIT-RCS/X/2026',
    version: 1,
    status: 'pending_approval',
    subtotal: 680000000,
    vat_amount: 74800000,
    grand_total: 754800000,
    discount_pct: 8.5,
    payment_terms: '30-60-10',
    valid_days: 30,
    valid_until: '2026-11-19',
    client_tier: 'S',
    selected_price_range: 'standard',
    line_items: [
      {
        line_number: 1,
        service_type: 'SOC',
        description: 'Managed Detection & Response (MDR) 24x7 Service Subscription - 12 Bulan',
        quantity: 12,
        unit: 'Bulan',
        unit_price: 56666666.67,
        line_total: 680000000,
      },
    ],
    created_by: 'M. Nadhil (Sales)',
    submitted_at: '2026-10-20T08:30:00Z',
    notes: 'Menunggu otorisasi Direktur karena nilai total > Rp 500 Juta dan diskon > 5%.',
    created_at: '2026-10-20T08:00:00Z',
  },
];

const INITIAL_APPROVALS: ApprovalRequest[] = [
  {
    id: 'appr-01',
    entity_type: 'quotation',
    entity_id: 'prop-02',
    title: 'Quotation #015/DEIT-RCS/X/2026 - PT Telco Mandiri Solusindo',
    requestor_name: 'M. Nadhil',
    requestor_role: 'sales',
    required_level: 'director',
    status: 'pending',
    transaction_value: 754800000,
    discount_pct: 8.5,
    gross_margin_pct: 34.2,
    reason: 'Nilai proyek melebihi Rp 500 Juta dan diskon komersial 8.5% melebihi wewenang Manager (5%).',
    created_at: '2026-10-20T08:30:00Z',
  },
];

const INITIAL_WALLETS: FlexGuardWallet[] = [
  {
    id: 'w-01',
    company_id: 'comp-01',
    company_name: 'PT Bank Central Nusantara Tbk',
    contract_number: 'PKS-VAPT/DEIT-BCN/2026/04',
    purchased_mandays: 162,
    unit_rate: 1500000,
    total_contract_value: 243000000,
    available_balance: 114,
    reserved_balance: 18,
    consumed_balance: 30,
    expiry_date: '2027-05-15',
    transactions: [
      {
        id: 'tx-01',
        tx_type: 'ISSUANCE',
        mandays: 162,
        service_scope: 'Aktivasi Kontrak Tahunan FlexGuard (162 Mandays)',
        reference_code: 'INV-2026-089',
        executed_by: 'Finance DEIT',
        created_at: '2026-05-15T10:00:00Z',
      },
      {
        id: 'tx-02',
        tx_type: 'DEBIT',
        mandays: 30,
        service_scope: 'Eksekusi VAPT Mobile Banking Sprint Q2',
        reference_code: 'BAST-2026-042',
        executed_by: 'Project Manager (Bambang)',
        created_at: '2026-07-20T16:00:00Z',
      },
      {
        id: 'tx-03',
        tx_type: 'RESERVE',
        mandays: 18,
        service_scope: 'Reservasi VAPT API Gateway Integration',
        reference_code: 'SR-2026-105',
        executed_by: 'Pre-Sales (Hendri)',
        created_at: '2026-10-15T09:00:00Z',
      },
    ],
  },
];

const INITIAL_TENDERS: Tender[] = [
  {
    id: 'tnd-01',
    code: 'TND-LPSE-2026-881',
    title: 'Pengadaan Jasa Asesmen Kerentanan & Penetration Testing Aplikasi Core Perbankan',
    source: 'LPSE',
    agency_name: 'PT Bank Pembangunan Daerah Jawa Tengah',
    pagu_budget: 450000000,
    hps_budget: 420000000,
    service_type: 'VAPT',
    deadline_submission: '2026-11-15T15:00:00Z',
    eligibility_status: 'qualified',
    bid_decision: 'go',
    bid_score: 92,
    summary: 'Ruang lingkup 2 web apps, 2 mobile apps, 40 API endpoints. Persyaratan: Terdaftar LK SMPI BSSN & ISO 27001.',
    created_at: '2026-10-14T08:00:00Z',
  },
  {
    id: 'tnd-02',
    code: 'TND-BUMN-2026-412',
    title: 'Layanan Managed Security Operations Center (SOC) 24x7 Berbasis AI & Threat Intelligence',
    source: 'BUMN',
    agency_name: 'PT Industri Telekomunikasi Indonesia (Persero)',
    pagu_budget: 1250000000,
    hps_budget: 1180000000,
    service_type: 'SOC',
    deadline_submission: '2026-12-01T12:00:00Z',
    eligibility_status: 'qualified',
    bid_decision: 'conditional_go',
    bid_score: 84,
    summary: 'Monitoring 1000 endpoints + integrasi SIEM & EDR. Membutuhkan izin khusus distributor teknologi.',
    created_at: '2026-10-18T11:00:00Z',
  },
  {
    id: 'tnd-03',
    code: 'TND-SWT-2026-109',
    title: 'Asesmen Kepatuhan UU PDP & Implementasi ISO 27701 Privacy Information Management',
    source: 'Swasta',
    agency_name: 'PT Asuransi Jiwa Mega Proteksi',
    pagu_budget: 350000000,
    hps_budget: 330000000,
    service_type: 'PDP',
    deadline_submission: '2026-11-25T16:00:00Z',
    eligibility_status: 'qualified',
    bid_decision: 'pending',
    bid_score: 78,
    summary: 'Audit kesiapan perlindungan data pribadi nasabah dan penyusunan Data Protection Impact Assessment (DPIA).',
    created_at: '2026-10-19T13:30:00Z',
  },
];

// Persistent state singleton for the app session
class StoreService {
  private static instance: StoreService;
  private state: AppStore;
  // Public preview only. No Node filesystem and no pretending writes are durable.
  private constructor() {
    this.state = {
      companies: structuredClone(INITIAL_COMPANIES),
      opportunities: structuredClone(INITIAL_OPPORTUNITIES),
      pricingSessions: [],
      proposals: structuredClone(INITIAL_PROPOSALS),
      approvals: structuredClone(INITIAL_APPROVALS),
      wallets: structuredClone(INITIAL_WALLETS),
      tenders: structuredClone(INITIAL_TENDERS),
      aiConfigs: DEFAULT_AI_CONFIGS.map(({ apiKey, ...config }) => ({
        ...config,
        apiKey: config.provider === 'local' ? 'INTERNAL_BUILTIN' : '',
        status: config.provider === 'local' ? 'active' : 'unconfigured',
      })),
    };
  }

  public static getInstance(): StoreService {
    if (!StoreService.instance) {
      StoreService.instance = new StoreService();
    }
    return StoreService.instance;
  }

  private saveToDisk(): void {
    // Deliberately non-persistent in public preview.
    // Production must use a durable authenticated database.
  }

  public getState(): AppStore {
    return this.state;
  }

  // Companies
  public addCompany(company: Company): Company {
    this.state.companies.unshift(company);
    this.saveToDisk();
    return company;
  }

  // Opportunities
  public addOpportunity(opp: Opportunity): Opportunity {
    this.state.opportunities.unshift(opp);
    this.saveToDisk();
    return opp;
  }

  public updateOpportunity(id: string, partial: Partial<Opportunity>): Opportunity | undefined {
    const opp = this.state.opportunities.find(o => o.id === id);
    if (opp) {
      Object.assign(opp, partial);
      this.saveToDisk();
    }
    return opp;
  }

  // Proposals
  public addProposal(prop: Proposal): Proposal {
    this.state.proposals.unshift(prop);
    this.saveToDisk();
    return prop;
  }

  public updateProposalStatus(id: string, status: ProposalStatus, extra?: Partial<Proposal>): Proposal | undefined {
    const prop = this.state.proposals.find(p => p.id === id);
    if (prop) {
      prop.status = status;
      if (extra) Object.assign(prop, extra);
      this.saveToDisk();
    }
    return prop;
  }

  // Approvals
  public addApproval(appr: ApprovalRequest): ApprovalRequest {
    this.state.approvals.unshift(appr);
    this.saveToDisk();
    return appr;
  }

  public updateApproval(
    id: string,
    status: 'approved' | 'rejected' | 'revision_requested',
    approverName: string,
    comments?: string
  ): ApprovalRequest | undefined {
    const item = this.state.approvals.find(a => a.id === id);
    if (item) {
      item.status = status;
      item.approved_by = approverName;
      item.approved_at = new Date().toISOString();
      item.comments = comments;

      // Also cascade to related proposal
      if (item.entity_type === 'quotation') {
        const prop = this.state.proposals.find(p => p.id === item.entity_id);
        if (prop) {
          if (status === 'approved') {
            prop.status = 'approved';
            prop.approved_by = approverName;
            prop.approved_at = new Date().toISOString();
          } else if (status === 'rejected') {
            prop.status = 'rejected';
            prop.rejection_reason = comments;
          }
        }
      }
      this.saveToDisk();
    }
    return item;
  }

  // Tenders
  public addTender(tender: Tender): Tender {
    this.state.tenders.unshift(tender);
    this.saveToDisk();
    return tender;
  }

  public updateTender(id: string, partial: Partial<Tender>): Tender | undefined {
    const item = this.state.tenders.find(t => t.id === id);
    if (item) {
      Object.assign(item, partial);
      this.saveToDisk();
    }
    return item;
  }

  // FlexGuard Wallets
  public addFlexGuardTransaction(walletId: string, tx: FlexGuardTransaction): FlexGuardTransaction | undefined {
    const wallet = this.state.wallets.find(w => w.id === walletId);
    if (wallet) {
      wallet.transactions.unshift(tx);
      if (tx.tx_type === 'ISSUANCE' || tx.tx_type === 'TOPUP') {
        wallet.purchased_mandays += tx.mandays;
        wallet.available_balance += tx.mandays;
      } else if (tx.tx_type === 'RESERVE') {
        wallet.available_balance -= tx.mandays;
        wallet.reserved_balance += tx.mandays;
      } else if (tx.tx_type === 'RELEASE') {
        wallet.reserved_balance -= tx.mandays;
        wallet.available_balance += tx.mandays;
      } else if (tx.tx_type === 'DEBIT') {
        wallet.reserved_balance -= tx.mandays;
        wallet.consumed_balance += tx.mandays;
      }
      this.saveToDisk();
      return tx;
    }
    return undefined;
  }

  // AI Configurations
  public getAIConfigs(): AIProviderConfig[] {
    return this.state.aiConfigs;
  }

  public updateAIConfig(id: string, partial: Partial<AIProviderConfig>): AIProviderConfig | undefined {
    const config = this.state.aiConfigs.find(c => c.id === id);
    if (config) {
      Object.assign(config, partial);
      this.saveToDisk();
    }
    return config;
  }

  public setAIPriorities(orderedIds: string[]): void {
    orderedIds.forEach((id, idx) => {
      const config = this.state.aiConfigs.find(c => c.id === id);
      if (config) {
        config.priority = idx + 1;
      }
    });
    this.saveToDisk();
  }
}

export const appStore = StoreService.getInstance();
