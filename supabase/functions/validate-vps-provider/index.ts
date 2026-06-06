import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { provider, apiKey } = await req.json()

    if (!provider || !apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: '제공업체와 API 키를 입력해주세요.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let result: { success: boolean; account?: string; error?: string }

    if (provider === 'vultr') {
      const res = await fetch('https://api.vultr.com/v2/account', {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (res.ok) {
        const data = await res.json()
        result = { success: true, account: data.account?.email }
      } else {
        result = { success: false, error: '유효하지 않은 Vultr API 키입니다.' }
      }
    } else if (provider === 'digitalocean') {
      const res = await fetch('https://api.digitalocean.com/v2/account', {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (res.ok) {
        const data = await res.json()
        result = { success: true, account: data.account?.email }
      } else {
        result = { success: false, error: '유효하지 않은 DigitalOcean API 키입니다.' }
      }
    } else {
      result = { success: false, error: '지원하지 않는 VPS 제공업체입니다.' }
    }

    return new Response(
      JSON.stringify(result),
      { status: result.success ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: '검증 중 오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})