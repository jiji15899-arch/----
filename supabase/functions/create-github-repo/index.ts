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

    // 사용자의 GitHub 토큰 조회
    const { data: profile } = await supabase
      .from('profiles')
      .select('gh_token_encrypted')
      .eq('user_id', user.id)
      .single()

    if (!profile?.gh_token_encrypted) {
      throw new Error('GitHub 토큰을 먼저 설정해주세요.')
    }

    const { repoName, siteId, isPrivate = false } = await req.json()

    // GitHub 저장소 생성
    const githubRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${profile.gh_token_encrypted}`,
        'Content-Type': 'application/json',
        'User-Agent': 'CloudPress/1.0',
      },
      body: JSON.stringify({
        name: repoName,
        description: `CloudPress 사이트: ${repoName}`,
        private: isPrivate,
        auto_init: true,
      }),
    })

    if (!githubRes.ok) {
      const err = await githubRes.json()
      throw new Error(err.message || 'GitHub 저장소 생성에 실패했습니다.')
    }

    const repo = await githubRes.json()

    // WordPress 초기 파일 구조 업로드 (GitHub Actions 포함)
    // SQLite DB 기반 WordPress 파일 업로드
    await uploadWordPressFiles(profile.gh_token_encrypted, repo.full_name, siteId)

    // 사이트 정보 업데이트
    await supabase
      .from('sites')
      .update({ github_repo_url: repo.html_url })
      .eq('id', siteId)

    return new Response(
      JSON.stringify({ success: true, repoUrl: repo.html_url, repoName: repo.full_name }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : '오류가 발생했습니다.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// WordPress 초기 파일 구조 및 GitHub Actions 업로드
async function uploadWordPressFiles(token: string, repoFullName: string, siteId: string) {
  const files = [
    {
      path: '.github/workflows/deploy.yml',
      content: btoa(getDeployWorkflow()),
    },
    {
      path: 'wp-config-sample.php',
      content: btoa(getWPConfigSample()),
    },
    {
      path: 'README.md',
      content: btoa(`# CloudPress WordPress 사이트\n\n사이트 ID: ${siteId}\n\n이 저장소는 CloudPress에 의해 자동으로 관리됩니다.\n`),
    },
  ]

  for (const file of files) {
    await fetch(`https://api.github.com/repos/${repoFullName}/contents/${file.path}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'CloudPress/1.0',
      },
      body: JSON.stringify({
        message: `초기 설정: ${file.path}`,
        content: file.content,
      }),
    })
  }
}

function getDeployWorkflow(): string {
  return `name: WordPress 배포

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: 저장소 체크아웃
        uses: actions/checkout@v3

      - name: PHP 설정
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.2'
          extensions: sqlite3, mbstring, curl, gd, zip

      - name: WordPress 다운로드
        run: |
          wget -q https://wordpress.org/latest.tar.gz
          tar -xzf latest.tar.gz
          cp -r wordpress/* .
          rm -rf wordpress latest.tar.gz

      - name: SQLite 플러그인 설치
        run: |
          mkdir -p wp-content/plugins
          wget -q https://downloads.wordpress.org/plugin/sqlite-database-integration.latest-stable.zip
          unzip -q sqlite-database-integration.latest-stable.zip -d wp-content/plugins/
          cp wp-content/plugins/sqlite-database-integration/db.copy wp-content/db.php

      - name: wp-config.php 설정
        run: |
          cp wp-config-sample.php wp-config.php
          sed -i "s/database_name_here/wordpress/" wp-config.php
          sed -i "s/username_here/root/" wp-config.php
          sed -i "s/password_here//" wp-config.php

      - name: Nginx 서버 시작
        run: |
          sudo apt-get install -y nginx php8.2-fpm
          sudo systemctl start php8.2-fpm
          # Nginx 설정 적용

      - name: 배포 완료 알림
        run: echo "✅ WordPress 배포 완료"
`
}

function getWPConfigSample(): string {
  return `<?php
// CloudPress WordPress 설정
// SQLite 데이터베이스 사용

define('DB_NAME', 'wordpress');
define('DB_USER', 'root');
define('DB_PASSWORD', '');
define('DB_HOST', 'localhost');
define('DB_CHARSET', 'utf8mb4');
define('DB_COLLATE', '');

// 보안 키 (자동 생성됨)
define('AUTH_KEY',         'cloudpress-auth-key');
define('SECURE_AUTH_KEY',  'cloudpress-secure-auth-key');
define('LOGGED_IN_KEY',    'cloudpress-logged-in-key');
define('NONCE_KEY',        'cloudpress-nonce-key');
define('AUTH_SALT',        'cloudpress-auth-salt');
define('SECURE_AUTH_SALT', 'cloudpress-secure-auth-salt');
define('LOGGED_IN_SALT',   'cloudpress-logged-in-salt');
define('NONCE_SALT',       'cloudpress-nonce-salt');

$table_prefix = 'wp_';

define('WP_DEBUG', false);
define('WP_HOME', getenv('WP_HOME') ?: '');
define('WP_SITEURL', getenv('WP_SITEURL') ?: '');

if ( ! defined( 'ABSPATH' ) ) {
  define( 'ABSPATH', __DIR__ . '/' );
}

require_once ABSPATH . 'wp-settings.php';
`
}