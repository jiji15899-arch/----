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
    const { apiKey, email } = await req.json()

    if (!apiKey || !email) {
      return new Response(
        JSON.stringify({ success: false, error: 'API 키와 이메일을 입력해주세요.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Cloudflare API 검증
    const res = await fetch('https://api.cloudflare.com/client/v4/user', {
      headers: {
        'X-Auth-Key': apiKey,
        'X-Auth-Email': email,
        'Content-Type': 'application/json',
      },
    })

    const data = await res.json()

    if (!data.success) {
      return new Response(
        JSON.stringify({ success: false, error: '유효하지 않은 Cloudflare API 키입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, email: data.result?.email }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: '검증 중 오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})