# INDIA Business Management Platform

Repositori ini berisi dokumentasi spesifikasi, perancangan, diagram sistem, dan skema database untuk platform INDIA.

## Struktur Berkas

- **Dokumentasi (.docx)**:
  - `DOK-00_Master_Plan_ICOP_GRC.docx`: Master Plan
  - `DOK-01_BRD_ICOP_GRC-2.docx` & `DOK-01_BRD_ICOP_GRC-4.docx`: Business Requirements Document
  - `DOK-02_SRS_ICOP_GRC-1.docx`: Software Requirements Specification
  - `DOK-03_FRS_ICOP_GRC.docx`: Functional Requirements Specification
  - `DOK-04_TRS_ICOP_GRC-1.docx`: Technical Requirements Specification
  - `DOK-11_Sequence_Diagram_ICOP_GRC.docx`: Sequence Diagram
  - `DOK-12_Activity_Diagram_ICOP_GRC.docx`: Activity Diagram
  - `DOK-14_Component_Diagram_ICOP_GRC.docx`: Component Diagram
  - `DOK-20_Role_Permission_Matrix_ICOP_GRC.docx`: Role Permission Matrix
  - `ICOP_PreDev_Decisions_v1.0.docx`: Pre-Development Decisions
  - `ICOP_ProjectCharter_v1.0.docx`: Project Charter

- **Database Schemas (.sql)**:
  - `icop_auth_rbac_schema-1.sql`: Skema Autentikasi & RBAC
  - `icop_contract_invoice_schema.sql`: Skema Kontrak & Invoice
  - `icop_crm_schema.sql`: Skema CRM
  - `icop_pricing_proposal_schema.sql`: Skema Pricing & Proposal
  - `icop_project_token_schema.sql`: Skema Project Token

## Otomatisasi Sinkronisasi (Auto-Push)

- **`start-auto-push.bat`**: Klik dua kali file ini untuk mengaktifkan pemantauan folder otomatis. Setiap ada file yang dibuat, diedit, atau dihapus, perubahan akan otomatis di-commit dan di-push ke GitHub.
- **`manual-push.bat`**: Klik dua kali file ini untuk langsung melakukan push seluruh perubahan saat ini secara manual.

---
*Status: auto-push lokal hanya aktif selama watcher Windows berjalan. Cloudflare Git integration sudah tertaut namun build aplikasi masih gagal; lihat CLOUDFLARE_DEPLOYMENT.md.*


## Cloudflare CI/CD

Informasi koneksi, penyebab build gagal, keamanan deployment dan verifikasi tersedia di [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md).
