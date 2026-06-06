// 저장 위치: /supabase/functions/paypal-webhook/index.ts
// PayPal 웹훅 처리 Edge Function

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// PayPal API 토큰 획득
async function getPayPalAccessToken(clientId: string, clientSecret: string, mode: 'sandbox' | 'live'): Promise<string> {
  const baseUrl = mode === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'
  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const data = await res.json()
  return data.access_token
}

// PayPal 웹훅 서명 검증
async function verifyWebhookSignature(
  payload: string,
  headers: Record<string, string>,
  webhookId: string,
  accessToken: string,
  mode: 'sandbox' | 'live'
): Promise<boolean> {
  const baseUrl = mode === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'
  const res = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: webhookId,
      webhook_event: JSON.parse(payload),
    }),
  })
  const data = await res.json()
  return data.verification_status === 'SUCCESS'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 관리자 설정에서 PayPal 정보 조회
    const { data: settings } = await supabase
      .from('admin_settings')
      .select('key, value')
      .in('key', ['PAYPAL_CLIENT_ID', 'PAYPAL_SECRET', 'PAYPAL_MODE', 'PAYPAL_WEBHOOK_ID'])

    const settingsMap: Record<string, string> = {}
    settings?.forEach(s => { settingsMap[s.key] = s.value })

    const clientId = settingsMap['PAYPAL_CLIENT_ID']
    const clientSecret = settingsMap['PAYPAL_SECRET']
    const mode = (settingsMap['PAYPAL_MODE'] || 'sandbox') as 'sandbox' | 'live'
    const webhookId = settingsMap['PAYPAL_WEBHOOK_ID']

    if (!clientId || !clientSecret) {
      throw new Error('PayPal 설정이 누락되었습니다')
    }

    const payload = await req.text()
    const event = JSON.parse(payload)

    // 웹훅 서명 검증 (webhookId가 있을 때만)
    if (webhookId) {
      const accessToken = await getPayPalAccessToken(clientId, clientSecret, mode)
      const headers: Record<string, string> = {}
      req.headers.forEach((value, key) => { headers[key] = value })

      const isValid = await verifyWebhookSignature(payload, headers, webhookId, accessToken, mode)
      if (!isValid) {
        return new Response(
          JSON.stringify({ error: '웹훅 서명 검증 실패' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 이벤트 유형별 처리
    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        // 결제 완료 처리
        const orderId = event.resource?.supplementary_data?.related_ids?.order_id || event.resource?.id
        const amount = parseFloat(event.resource?.amount?.value || '0')

        // 인보이스 상태 업데이트
        const { data: invoice } = await supabase
          .from('invoices')
          .update({ status: 'paid' })
          .eq('paypal_order_id', orderId)
          .select('user_id, plan_id')
          .single()

        if (invoice) {
          // 플랜 업데이트
          await supabase
            .from('profiles')
            .update({ plan_id: invoice.plan_id })
            .eq('user_id', invoice.user_id)
        }

        console.log(`결제 완료: orderId=${orderId}, amount=${amount}`)
        break
      }

      case 'PAYMENT.CAPTURE.DENIED': {
        // 결제 거부 처리
        const orderId = event.resource?.supplementary_data?.related_ids?.order_id || event.resource?.id
        await supabase
          .from('invoices')
          .update({ status: 'failed' })
          .eq('paypal_order_id', orderId)
        break
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED': {
        // 구독 취소 처리
        const subscriptionId = event.resource?.id
        const { data: invoice } = await supabase
          .from('invoices')
          .select('user_id')
          .eq('paypal_order_id', subscriptionId)
          .single()

        if (invoice) {
          await supabase
            .from('profiles')
            .update({ plan_id: null })
            .eq('user_id', invoice.user_id)
        }
        break
      }

      default:
        console.log(`처리되지 않은 PayPal 이벤트: ${event.event_type}`)
    }

    return new Response(
      JSON.stringify({ success: true, eventType: event.event_type }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('PayPal 웹훅 처리 오류:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : '웹훅 처리 중 오류 발생' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})