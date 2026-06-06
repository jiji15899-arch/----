import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')!
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('인증이 필요합니다.')

    const { domainId } = await req.json()

    const { data: domain } = await supabase
      .from('domains')
      .select('*, profiles!inner(cf_api_key_encrypted, cf_email)')
      .eq('id', domainId)
      .single()

    if (!domain) throw new Error('도메인을 찾을 수 없습니다.')

    const profile = domain.profiles as { cf_api_key_encrypted: string; cf_email: string }

    // Cloudflare Zone 상태 확인
    const zoneRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${domain.cf_zone_id}`, {
      headers: {
        'X-Auth-Key': profile.cf_api_key_encrypted,
        'X-Auth-Email': profile.cf_email,
      },
    })

    const zoneData = await zoneRes.json()

    if (!zoneData.success) {
      throw new Error('Zone 상태 확인에 실패했습니다.')
    }

    const zone = zoneData.result
    const isActive = zone.status === 'active'
    const sslActive = zone.meta?.ssl_universal_enabled

    // 상태 업데이트
    const updates: Record<string, string> = {}
    if (isActive && domain.ns_status !== 'active') {
      updates.ns_status = 'active'
      updates.verified_at = new Date().toISOString()
    }
    if (sslActive && domain.ssl_status !== 'active') {
      updates.ssl_status = 'active'
    } else if (isActive && !sslActive) {
      updates.ssl_status = 'issuing'
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from('domains').update(updates).eq('id', domainId)
    }

    return new Response(
      JSON.stringify({
        success: true,
        nsStatus: isActive ? 'active' : domain.ns_status,
        sslStatus: sslActive ? 'active' : isActive ? 'issuing' : domain.ssl_status,
        zoneStatus: zone.status,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : '오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})