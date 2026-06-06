// 저장 위치: /supabase/functions/trigger-cf-deploy/index.ts
// Cloudflare Pages 배포 트리거 Edge Function

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeployRequest {
  siteId: string
  userId: string
  cfApiKey: string
  cfEmail: string
  cfAccountId: string
  githubRepo: string
  projectName: string
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

    const body: DeployRequest = await req.json()
    const { siteId, userId, cfApiKey, cfEmail, cfAccountId, githubRepo, projectName } = body

    // 배포 레코드 생성
    const { data: deployment, error: deployError } = await supabase
      .from('deployments')
      .insert({
        site_id: siteId,
        status: 'pending',
        log: 'Cloudflare Pages 배포를 시작하는 중...',
        triggered_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (deployError) throw deployError

    // Cloudflare Pages 프로젝트 확인 또는 생성
    const cfBaseUrl = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/pages`
    const cfHeaders = {
      'X-Auth-Email': cfEmail,
      'X-Auth-Key': cfApiKey,
      'Content-Type': 'application/json',
    }

    // 프로젝트 존재 여부 확인
    const projectRes = await fetch(`${cfBaseUrl}/projects/${projectName}`, {
      headers: cfHeaders,
    })

    let cfPagesUrl = ''

    if (!projectRes.ok) {
      // 프로젝트 생성
      const createRes = await fetch(`${cfBaseUrl}/projects`, {
        method: 'POST',
        headers: cfHeaders,
        body: JSON.stringify({
          name: projectName,
          production_branch: 'main',
          build_config: {
            build_command: 'npm run build',
            destination_dir: 'dist',
            root_dir: '/',
          },
        }),
      })

      if (!createRes.ok) {
        const errData = await createRes.json()
        throw new Error(`Cloudflare Pages 프로젝트 생성 실패: ${JSON.stringify(errData.errors)}`)
      }

      const createData = await createRes.json()
      cfPagesUrl = `https://${createData.result.subdomain}`
    } else {
      const projectData = await projectRes.json()
      cfPagesUrl = `https://${projectData.result.subdomain}`
    }

    // GitHub Actions 트리거 (새 배포 시작)
    const [owner, repo] = githubRepo.split('/')
    const authHeader = req.headers.get('authorization') || ''
    const ghToken = authHeader.replace('Bearer ', '')

    if (ghToken && owner && repo) {
      await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/deploy.yml/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `token ${ghToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ref: 'main' }),
        }
      )
    }

    // 사이트 업데이트
    await supabase
      .from('sites')
      .update({
        cf_pages_url: cfPagesUrl,
        status: 'building',
        last_deployed_at: new Date().toISOString(),
      })
      .eq('id', siteId)

    // 배포 레코드 업데이트
    await supabase
      .from('deployments')
      .update({
        status: 'running',
        log: `Cloudflare Pages 배포 시작됨. URL: ${cfPagesUrl}`,
      })
      .eq('id', deployment.id)

    return new Response(
      JSON.stringify({
        success: true,
        deploymentId: deployment.id,
        cfPagesUrl,
        message: 'Cloudflare Pages 배포가 시작되었습니다',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : '배포 중 오류가 발생했습니다' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})