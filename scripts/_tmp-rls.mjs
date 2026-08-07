import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))

// Exactly what the browser uses: anon key + a real superadmin session.
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const { data: auth, error: authErr } = await sb.auth.signInWithPassword({ email:'arpit@arpitai.com', password: process.env.PW })
if (authErr) { console.error('sign-in failed:', authErr.message); process.exit(1) }

const me = auth.user.id
const { data: prof } = await sb.from('profiles').select('tenant_id, role').eq('id', me).single()
console.log('signed in as', prof.role, '| tenant', prof.tenant_id, '\n')

let fails = 0
const check = (n, ok, d='') => { if(!ok) fails++; console.log(`  [${ok?'PASS':'FAIL'}] ${n}${d?'  — '+d:''}`) }

console.log('=== LEADS (read / insert / update / delete) ===')
const { error: readErr } = await sb.from('leads').select('id').limit(1)
check('read leads', !readErr, readErr?.message)

const testEmail = `qa-${Date.now()}@example.invalid`
const { data: ins, error: insErr } = await sb.from('leads').insert({
  tenant_id: prof.tenant_id, email: testEmail, first_name:'QA', tags:['qa','test'], source:'qa'
}).select('id').single()
check('insert lead', !insErr && !!ins, insErr?.message)

if (ins) {
  const { error: dupErr } = await sb.from('leads').insert({ tenant_id: prof.tenant_id, email: testEmail.toUpperCase() })
  check('duplicate blocked by DB', !!dupErr && dupErr.code==='23505', dupErr?.code ?? 'NO ERROR — duplicate allowed!')

  const { error: updErr } = await sb.from('leads').update({ first_name:'QA2' }).eq('id', ins.id)
  check('update lead', !updErr, updErr?.message)

  const { error: delErr } = await sb.from('leads').delete().eq('id', ins.id)
  check('delete lead', !delErr, delErr?.message)
}

console.log('\n=== AUDIT LOGS ===')
const { data: audit, error: auditErr } = await sb.from('audit_logs').select('id, action, actor_role, created_at').order('created_at',{ascending:false}).limit(5)
check('read audit_logs', !auditErr, auditErr?.message)
check('audit entries exist', (audit??[]).length > 0, `${(audit??[]).length} rows`)
;(audit??[]).slice(0,3).forEach(a => console.log(`        ${a.action} by ${a.actor_role}`))

console.log('\n=== ANALYTICS SOURCES ===')
for (const [t, cols] of [['profiles','role, status, credits, created_at'],['leads','created_at'],['api_usage_logs','provider, succeeded, created_at']]) {
  const { data, error } = await sb.from(t).select(cols).limit(5)
  check(`read ${t}`, !error, error?.message ?? `${data?.length ?? 0} rows`)
}

console.log('\n=== EMAIL TEMPLATES (read + update) ===')
const { data: tpl, error: tplErr } = await sb.from('email_templates').select('id, key, subject').limit(1).maybeSingle()
check('read templates', !tplErr, tplErr?.message)
if (tpl) {
  const original = tpl.subject
  const { error: tuErr } = await sb.from('email_templates').update({ subject: original + ' ' }).eq('id', tpl.id)
  check('update template', !tuErr, tuErr?.message)
  await sb.from('email_templates').update({ subject: original }).eq('id', tpl.id)
}

console.log('\n=== SMTP + PROVIDERS + TENANTS ===')
for (const t of ['smtp_accounts','api_credentials','tenants','custom_domains','email_broadcasts','autoresponder_connections']) {
  const { error } = await sb.from(t).select('id').limit(1)
  check(`read ${t}`, !error, error?.message)
}

console.log(`\n=== ${fails===0?'ALL RLS CHECKS PASSED':fails+' FAILED'} ===`)
