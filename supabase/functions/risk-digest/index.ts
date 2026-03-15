// @ts-nocheck
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  )

  const { data: highRiskSessions, error } = await supabase
    .from('mse_sessions')
    .select('*, patients(*)')
    .eq('status', 'complete')
    .gt('overall_severity', 70)
    .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  if (!highRiskSessions || highRiskSessions.length === 0) {
    return new Response(JSON.stringify({ message: 'No high risk sessions found in last 24h.' }))
  }

  // Compose digest
  const digest = highRiskSessions.map((s: any) => ({
    patient: s.patients?.full_name,
    severity: s.overall_severity,
    suicide_risk: s.risk_assessment?.suicide_risk,
    immediate_action: s.risk_assessment?.requires_immediate_action,
    summary: s.clinical_summary,
    link: `${Deno.env.get('APP_URL')}/report/${s.id}`
  }))

  // Here you would integrate with Resend or another mailer
  // For now, we return the digest JSON as proof of logic
  console.log('NIGHTLY RISK DIGEST GENERATED:', digest)

  return new Response(JSON.stringify({
    count: highRiskSessions.length,
    digest
  }), { headers: { 'Content-Type': 'application/json' } })
})
