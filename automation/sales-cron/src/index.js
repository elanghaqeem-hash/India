// Isolated Cloudflare Cron Worker. No HTTP route, no Access bypass and no outbound mail.
// Each INSERT OR IGNORE is idempotent across retries. In-app alerts persist in the SAME D1.
export default {
 async scheduled(_event,env,ctx){
  const db=env.INDIA_DB;
  if(!db)throw Error('INDIA_DB binding required');
  ctx.waitUntil(db.batch([
   db.prepare(`INSERT OR IGNORE INTO india_sales_activity_alerts(alert_key,tenant_id,task_id,recipient_email,alert_type,message)
    SELECT 'task:reminder:'||t.id||':'||t.revision,t.tenant_id,t.id,t.owner_email,'reminder','Pengingat: '||t.subject
    FROM india_sales_activity_tasks t WHERE t.status='planned'
    AND datetime(t.reminder_at)<=datetime('now') AND datetime(t.due_at)>datetime('now')`),
   db.prepare(`INSERT OR IGNORE INTO india_sales_activity_alerts(alert_key,tenant_id,task_id,recipient_email,alert_type,message)
    SELECT 'task:overdue:'||t.id||':'||t.revision,t.tenant_id,t.id,t.owner_email,'overdue','Follow-up terlambat: '||t.subject
    FROM india_sales_activity_tasks t WHERE t.status='planned' AND datetime(t.due_at)<=datetime('now')`),
   db.prepare(`INSERT OR IGNORE INTO india_sales_activity_alerts(alert_key,tenant_id,lead_id,recipient_email,alert_type,message)
    SELECT 'lead:sla:'||s.lead_id||':'||s.response_due_at,s.tenant_id,s.lead_id,s.owner_email,'lead_sla','SLA respons awal Lead terlewati: '||l.account_name
    FROM india_sales_lead_sla s JOIN india_marketing_leads l ON l.id=s.lead_id AND l.tenant_id=s.tenant_id
    WHERE s.first_response_at IS NULL AND l.status NOT IN ('converted','disqualified')
    AND datetime(s.response_due_at)<=datetime('now')`),
   db.prepare(`INSERT OR IGNORE INTO india_sales_activity_alerts(alert_key,tenant_id,task_id,recipient_email,alert_type,message)
    SELECT 'task:manager:'||t.id||':'||t.revision,t.tenant_id,t.id,m.manager_email,'manager_escalation','Eskalasi follow-up Sales '||t.owner_email||': '||t.subject
    FROM india_sales_activity_tasks t JOIN india_sales_team_managers m ON m.tenant_id=t.tenant_id AND m.sales_email=t.owner_email
    JOIN india_members x ON x.email=m.manager_email AND x.active=1 AND x.role='admin'
    LEFT JOIN india_sales_activity_policy p ON p.tenant_id=t.tenant_id
    WHERE t.status='planned' AND datetime(t.due_at,printf('+%d minutes',coalesce(p.escalation_minutes,60)))<=datetime('now')`),
   db.prepare(`INSERT OR IGNORE INTO india_sales_activity_alerts(alert_key,tenant_id,lead_id,recipient_email,alert_type,message)
    SELECT 'lead:manager:'||s.lead_id||':'||s.response_due_at,s.tenant_id,s.lead_id,m.manager_email,'manager_escalation','Eskalasi SLA Lead Sales '||s.owner_email||': '||l.account_name
    FROM india_sales_lead_sla s JOIN india_marketing_leads l ON l.id=s.lead_id AND l.tenant_id=s.tenant_id
    JOIN india_sales_team_managers m ON m.tenant_id=s.tenant_id AND m.sales_email=s.owner_email
    JOIN india_members x ON x.email=m.manager_email AND x.active=1 AND x.role='admin'
    LEFT JOIN india_sales_activity_policy p ON p.tenant_id=s.tenant_id
    WHERE s.first_response_at IS NULL AND l.status NOT IN ('converted','disqualified')
    AND datetime(s.response_due_at,printf('+%d minutes',coalesce(p.escalation_minutes,60)))<=datetime('now')`),
   db.prepare(`INSERT OR IGNORE INTO india_sales_activity_alerts(alert_key,tenant_id,task_id,recipient_email,alert_type,message)
    SELECT 'task:manager-missing:'||t.id||':'||t.revision||':'||a.email,t.tenant_id,t.id,a.email,'unassigned_manager','Sales Manager belum dipetakan; overdue: '||t.owner_email||' / '||t.subject
    FROM india_sales_activity_tasks t JOIN india_members a ON a.role='admin' AND a.active=1
    LEFT JOIN india_sales_activity_policy p ON p.tenant_id=t.tenant_id
    WHERE t.status='planned' AND datetime(t.due_at,printf('+%d minutes',coalesce(p.escalation_minutes,60)))<=datetime('now')
    AND NOT EXISTS(SELECT 1 FROM india_sales_team_managers m JOIN india_members x ON x.email=m.manager_email AND x.active=1 AND x.role='admin' WHERE m.tenant_id=t.tenant_id AND m.sales_email=t.owner_email)`),
   db.prepare(`INSERT OR IGNORE INTO india_sales_activity_alerts(alert_key,tenant_id,lead_id,recipient_email,alert_type,message)
    SELECT 'lead:manager-missing:'||s.lead_id||':'||s.response_due_at||':'||a.email,s.tenant_id,s.lead_id,a.email,'unassigned_manager','Sales Manager belum dipetakan; SLA Lead: '||s.owner_email||' / '||l.account_name
    FROM india_sales_lead_sla s JOIN india_marketing_leads l ON l.id=s.lead_id AND l.tenant_id=s.tenant_id
    JOIN india_members a ON a.role='admin' AND a.active=1
    LEFT JOIN india_sales_activity_policy p ON p.tenant_id=s.tenant_id
    WHERE s.first_response_at IS NULL AND l.status NOT IN ('converted','disqualified')
    AND datetime(s.response_due_at,printf('+%d minutes',coalesce(p.escalation_minutes,60)))<=datetime('now')
    AND NOT EXISTS(SELECT 1 FROM india_sales_team_managers m JOIN india_members x ON x.email=m.manager_email AND x.active=1 AND x.role='admin' WHERE m.tenant_id=s.tenant_id AND m.sales_email=s.owner_email)`)
  ]));
 }
};
