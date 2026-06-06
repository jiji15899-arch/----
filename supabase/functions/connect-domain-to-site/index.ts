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

    const { domainId, siteId } = await req.json()

    // 도메인과 사이트 정보 조회
    const [{ data: domain }, { data: site }] = await Promise.all([
      supabase.from('domains').select('*').eq('id', domainId).single(),
      supabase.from('sites').select('*').eq('id', siteId).single(),
    ])

    if (!domain || !site) throw new Error('도메인 또는 사이트를 찾을 수 없습니다.')

    const { data: profile } = await supabase
      .from('profiles')
      .select('cf_api_key_encrypted, cf_email')
      .eq('user_id', user.id)
      .single()

    if (!profile?.cf_api_key_encrypted) throw new Error('Cloudflare API 키를 먼저 설정해주세요.')

    const cfHeaders = {
      'X-Auth-Key': profile.cf_api_key_encrypted,
      'X-Auth-Email': profile.cf_email,
      'Content-Type': 'application/json',
    }

    if (site.hosting_type === 'cloudflare') {
      // Cloudflare Pages 커스텀 도메인 CNAME 레코드 추가
      await fetch(`https://api.cloudflare.com/client/v4/zones/${domain.cf_zone_id}/dns_records`, {
        method: 'POST',
        headers: cfHeaders,
        body: JSON.stringify({
          type: 'CNAME',
          name: domain.domain,
          content: `${site.subdomain}.pages.dev`,
          proxied: true,
        }),
      })
    } else if (site.hosting_type === 'vps' && site.ec2_public_ip) {
      // VPS A 레코드 추가
      await fetch(`https://api.cloudflare.com/client/v4/zones/${domain.cf_zone_id}/dns_records`, {
        method: 'POST',
        headers: cfHeaders,
        body: JSON.stringify({
          type: 'A',
          name: domain.domain,
          content: site.ec2_public_ip,
          proxied: true,
        }),
      })
    }

    // 도메인-사이트 연결 업데이트
    await supabase
      .from('domains')
      .update({ connected_site_id: siteId })
      .eq('id', domainId)

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : '오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})