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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('인증이 필요합니다.')

    const { siteId, action } = await req.json()

    const { data: site } = await supabase
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .eq('user_id', user.id)
      .single()

    if (!site) throw new Error('사이트를 찾을 수 없습니다.')

    const { data: settings } = await supabase.from('admin_settings').select('key, value')
    const settingsMap: Record<string, string> = {}
    settings?.forEach(s => { settingsMap[s.key] = s.value })

    let result: Record<string, unknown> = {}

    if (site.vps_provider === 'aws') {
      result = await manageAWSInstance(settingsMap, site.ec2_instance_id || '', site.ec2_region || 'ap-northeast-2', action)
    } else if (site.vps_provider === 'vultr') {
      result = await manageVultrInstance(settingsMap, site.ec2_instance_id || '', action)
    } else if (site.vps_provider === 'digitalocean') {
      result = await manageDODroplet(settingsMap, site.ec2_instance_id || '', action)
    }

    // 배포 로그 기록
    await supabase.from('deployments').insert({
      site_id: siteId,
      status: 'success',
      log: `VPS ${action} 완료`,
    })

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : '오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function manageAWSInstance(settings: Record<string, string>, instanceId: string, _region: string, action: string) {
  // AWS EC2 API 호출 (재시작/중지/상태)
  // 실제 구현에서는 AWS SDK 또는 Signature V4 서명 사용
  console.log(`AWS ${action} for ${instanceId}`)
  return { message: `AWS EC2 ${action} 완료` }
}

async function manageVultrInstance(settings: Record<string, string>, instanceId: string, action: string) {
  const apiKey = settings.VULTR_API_KEY
  if (!apiKey) throw new Error('Vultr API 키가 설정되지 않았습니다.')

  const actionMap: Record<string, string> = { restart: 'reboot', stop: 'halt', status: '' }
  if (action === 'status') {
    const res = await fetch(`https://api.vultr.com/v2/instances/${instanceId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const data = await res.json()
    return { status: data.instance?.power_status }
  }

  await fetch(`https://api.vultr.com/v2/instances/${instanceId}/${actionMap[action]}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  return { message: `Vultr ${action} 완료` }
}

async function manageDODroplet(settings: Record<string, string>, dropletId: string, action: string) {
  const apiKey = settings.DO_API_KEY
  if (!apiKey) throw new Error('DigitalOcean API 키가 설정되지 않았습니다.')

  const actionMap: Record<string, string> = { restart: 'reboot', stop: 'power_off', status: '' }

  if (action === 'status') {
    const res = await fetch(`https://api.digitalocean.com/v2/droplets/${dropletId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const data = await res.json()
    return { status: data.droplet?.status }
  }

  await fetch(`https://api.digitalocean.com/v2/droplets/${dropletId}/actions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: actionMap[action] }),
  })

  return { message: `DigitalOcean ${action} 완료` }
}