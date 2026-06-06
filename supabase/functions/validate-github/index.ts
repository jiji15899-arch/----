// 저장 위치: /supabase/functions/validate-github/index.ts
// GitHub Personal Access Token 검증 Supabase Edge Function

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 인증 확인
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: '인증이 필요합니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: '유효하지 않은 세션입니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { token } = await req.json()

    if (!token || typeof token !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'GitHub 토큰이 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GitHub API로 토큰 검증
    const ghRes = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'CloudPress-App',
      },
    })

    if (!ghRes.ok) {
      const errData = await ghRes.json()
      return new Response(
        JSON.stringify({
          success: false,
          error: ghRes.status === 401
            ? '유효하지 않은 GitHub 토큰입니다. 토큰을 확인해주세요.'
            : `GitHub API 오류: ${errData.message || '알 수 없는 오류'}`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const ghUser = await ghRes.json()

    // repo, workflow 권한 확인
    const scopesHeader = ghRes.headers.get('x-oauth-scopes') || ''
    const scopes = scopesHeader.split(',').map((s: string) => s.trim())
    const hasRepoScope = scopes.includes('repo') || scopes.includes('public_repo')
    const hasWorkflowScope = scopes.includes('workflow')

    // 토큰을 프로필에 저장
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ gh_token_encrypted: token })
      .eq('user_id', user.id)

    if (updateError) {
      console.error('프로필 업데이트 실패:', updateError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        username: ghUser.login,
        name: ghUser.name,
        avatar_url: ghUser.avatar_url,
        public_repos: ghUser.public_repos,
        scopes,
        hasRepoScope,
        hasWorkflowScope,
        message: `GitHub 계정 @${ghUser.login} 연결 완료`,
        warning: !hasRepoScope
          ? 'repo 권한이 없습니다. GitHub 저장소 생성을 위해 repo 권한이 필요합니다.'
          : !hasWorkflowScope
          ? 'workflow 권한이 없습니다. GitHub Actions 사용을 위해 workflow 권한을 추가해주세요.'
          : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('validate-github 오류:', error)
    return new Response(
      JSON.stringify({ success: false, error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})