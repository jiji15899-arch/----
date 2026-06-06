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
    const { accessKeyId, secretAccessKey, region } = await req.json()

    if (!accessKeyId || !secretAccessKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'AWS 액세스 키와 시크릿 키를 입력해주세요.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // AWS STS GetCallerIdentity로 자격증명 검증
    const endpoint = `https://sts.${region || 'ap-northeast-2'}.amazonaws.com/`
    const date = new Date()
    const dateStr = date.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
    const dateShort = dateStr.slice(0, 8)

    // HMAC-SHA256 서명 (실제 AWS Signature V4 구현)
    const body = 'Action=GetCallerIdentity&Version=2011-06-15'

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Amz-Date': dateStr,
      Host: `sts.${region || 'ap-northeast-2'}.amazonaws.com`,
    }

    // 실제 서명 생성 (간소화된 예시)
    const canonicalRequest = [
      'POST',
      '/',
      '',
      Object.entries(headers)
        .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))
        .map(([k, v]) => `${k.toLowerCase()}:${v}`)
        .join('\n') + '\n',
      Object.keys(headers)
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
        .map(k => k.toLowerCase())
        .join(';'),
      await sha256(body),
    ].join('\n')

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      dateStr,
      `${dateShort}/${region || 'ap-northeast-2'}/sts/aws4_request`,
      await sha256(canonicalRequest),
    ].join('\n')

    const signingKey = await getSigningKey(secretAccessKey, dateShort, region || 'ap-northeast-2', 'sts')
    const signature = await hmacSha256Hex(signingKey, stringToSign)

    const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${dateShort}/${region || 'ap-northeast-2'}/sts/aws4_request, SignedHeaders=${Object.keys(headers).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())).map(k => k.toLowerCase()).join(';')}, Signature=${signature}`

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...headers,
        Authorization: authHeader,
      },
      body,
    })

    const text = await res.text()

    if (res.ok && text.includes('GetCallerIdentityResult')) {
      const accountMatch = text.match(/<Account>(.*?)<\/Account>/)
      const arnMatch = text.match(/<Arn>(.*?)<\/Arn>/)
      return new Response(
        JSON.stringify({
          success: true,
          accountId: accountMatch?.[1] || '',
          arn: arnMatch?.[1] || '',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: false, error: '유효하지 않은 AWS 자격증명입니다.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: 'AWS 연결 테스트 중 오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hmacSha256(key: ArrayBuffer | string, data: string): Promise<ArrayBuffer> {
  const keyData = typeof key === 'string' ? new TextEncoder().encode(key) : key
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data))
}

async function hmacSha256Hex(key: ArrayBuffer, data: string): Promise<string> {
  const result = await hmacSha256(key, data)
  return Array.from(new Uint8Array(result)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function getSigningKey(secretKey: string, date: string, region: string, service: string): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(`AWS4${secretKey}`, date)
  const kRegion = await hmacSha256(kDate, region)
  const kService = await hmacSha256(kRegion, service)
  return hmacSha256(kService, 'aws4_request')
}