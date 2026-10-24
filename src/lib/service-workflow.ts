export const serviceParameters:Record<string,{key:string;label:string;numeric?:boolean}[]>={
 vapt_scope:[{key:'assets',label:'Aset / URL / IP yang disetujui'},{key:'test_window',label:'Testing window dan otorisasi'},{key:'methodology',label:'Metodologi dan rules of engagement'}],
 vapt_test:[{key:'tested_assets',label:'Aset diuji dan cakupan hasil'},{key:'findings',label:'Temuan dan tingkat risiko'}],
 vapt_report:[{key:'report_version',label:'Versi laporan final'},{key:'recipient',label:'Penerima laporan'}],
 vapt_retest:[{key:'retest_scope',label:'Temuan / aset untuk retest'},{key:'result',label:'Hasil retest dan residual risk'}],
 soc_logs:[{key:'log_sources',label:'Daftar log source dan tipe integrasi'},{key:'source_count',label:'Jumlah log source',numeric:true},{key:'use_cases',label:'Use case / detection rule'}],
 soc_sla:[{key:'service_window',label:'Jam layanan'},{key:'response_minutes',label:'SLA respons (menit)',numeric:true},{key:'escalation',label:'Matriks eskalasi dan PIC'}],
 soc_report:[{key:'coverage',label:'Cakupan monitoring / availability'},{key:'incidents',label:'Insiden dan respons'},{key:'improvements',label:'Rekomendasi perbaikan'}],
 grc_assessment:[{key:'standard',label:'Standar / regulasi acuan'},{key:'domains',label:'Domain / unit assessment'}],
 grc_gap:[{key:'gaps',label:'Gap dan referensi kontrol'},{key:'priority',label:'Prioritas / tingkat risiko'}],
 grc_remediation:[{key:'actions',label:'Remediation action plan'},{key:'owner',label:'Pemilik action plan'},{key:'target',label:'Target penyelesaian dan status'}],
 tech_license:[{key:'sku',label:'SKU / entitlement / jumlah lisensi'},{key:'validity',label:'Masa berlaku lisensi'}],
 tech_implementation:[{key:'configuration',label:'Konfigurasi dan versi solusi'},{key:'test_results',label:'Hasil UAT / acceptance test'}],
 tech_support:[{key:'support_period',label:'Periode support / warranty'},{key:'support_sla',label:'SLA support dan kontak eskalasi'}]
};
export const prerequisites:Record<string,string[]>={vapt_test:['vapt_scope'],vapt_report:['vapt_test'],vapt_retest:['vapt_report'],soc_report:['soc_logs','soc_sla'],grc_gap:['grc_assessment'],grc_remediation:['grc_gap'],tech_implementation:['tech_license'],tech_support:['tech_implementation']};
