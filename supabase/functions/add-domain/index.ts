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

    const { domain, siteId } = await req.json()

    // 사용자의 Cloudflare API 키 조회
    const { data: profile } = await supabase
      .from('profiles')
      .select('cf_api_key_encrypted, cf_email')
      .eq('user_id', user.id)
      .single()

    if (!profile?.cf_api_key_encrypted || !profile?.cf_email) {
      throw new Error('Cloudflare API 키를 먼저 설정해주세요.')
    }

    // Cloudflare Zone 생성
    const zoneRes = await fetch('https://api.cloudflare.com/client/v4/zones', {
      method: 'POST',
      headers: {
        'X-Auth-Key': profile.cf_api_key_encrypted,
        'X-Auth-Email': profile.cf_email,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: domain,
        account: { id: '' },
        jump_start: true,
      }),
    })

    const zoneData = await zoneRes.json()

    if (!zoneData.success) {
      throw new Error(zoneData.errors?.[0]?.message || 'Cloudflare Zone 생성에 실패했습니다.')
    }

    const zone = zoneData.result
    const nameservers = zone.name_servers

    // 도메인 정보 저장
    const { data: domainRecord, error: dbError } = await supabase
      .from('domains')
      .insert({
        user_id: user.id,
        domain,
        cf_zone_id: zone.id,
        nameserver_1: nameservers[0],
        nameserver_2: nameservers[1],
        ns_status: 'pending',
        ssl_status: 'inactive',
        connected_site_id: siteId || null,
      })
      .select()
      .single()

    if (dbError) throw dbError

    return new Response(
      JSON.stringify({
        success: true,
        domainId: domainRecord.id,
        zoneId: zone.id,
        nameserver1: nameservers[0],
        nameserver2: nameservers[1],
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