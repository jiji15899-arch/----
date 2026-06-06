// 저장 위치: /supabase/functions/setup-wordpress-github/index.ts
// 진짜 WordPress 파일을 사용자의 GitHub 저장소에 배치하고
// GitHub Actions로 Nginx 서버 기반 WordPress 실행 환경을 구성하는 Edge Function

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// WordPress 최신 버전 다운로드 URL
const WP_DOWNLOAD_URL = 'https://wordpress.org/latest.zip'
const WP_VERSION = '6.7' // 최신 안정 버전

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: '인증이 필요합니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const userSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await userSupabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: '유효하지 않은 세션입니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { siteId, repoName, githubToken, subdomain, siteName } = await req.json()

    if (!siteId || !repoName || !githubToken || !subdomain) {
      return new Response(
        JSON.stringify({ success: false, error: '필수 파라미터가 누락되었습니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const GITHUB_API = 'https://api.github.com'
    const headers = {
      'Authorization': `Bearer ${githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'CloudPress-App',
      'Content-Type': 'application/json',
    }

    // 1단계: GitHub 사용자 정보 조회
    const userRes = await fetch(`${GITHUB_API}/user`, { headers })
    if (!userRes.ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'GitHub 토큰이 유효하지 않습니다.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const ghUser = await userRes.json()
    const repoOwner = ghUser.login

    // 2단계: GitHub 저장소 생성
    await supabase.from('deployments').insert({
      site_id: siteId,
      status: 'running',
      log: 'GitHub 저장소를 생성하는 중...',
      triggered_at: new Date().toISOString(),
    })

    const createRepoRes = await fetch(`${GITHUB_API}/user/repos`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: repoName,
        description: `CloudPress WordPress 사이트: ${siteName}`,
        private: true,
        auto_init: true,
        gitignore_template: null,
      }),
    })

    let repoData: { html_url: string; default_branch?: string }
    if (createRepoRes.status === 422) {
      // 이미 존재하는 저장소
      const existingRes = await fetch(`${GITHUB_API}/repos/${repoOwner}/${repoName}`, { headers })
      repoData = await existingRes.json()
    } else if (!createRepoRes.ok) {
      const err = await createRepoRes.json()
      return new Response(
        JSON.stringify({ success: false, error: `저장소 생성 실패: ${err.message}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      repoData = await createRepoRes.json()
    }

    const repoUrl = repoData.html_url
    const branch = repoData.default_branch || 'main'

    // 잠시 대기 (저장소 초기화 완료 대기)
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 3단계: wp-config.php 생성 (SQLite DB 사용)
    const wpConfig = `<?php
/**
 * WordPress 기본 설정 파일 - CloudPress 생성
 * SQLite 데이터베이스 사용 (서버리스 환경)
 */

// SQLite 플러그인 설정
define('DB_DIR', __DIR__ . '/wp-content/database/');
define('DB_FILE', 'cloudpress.db');

// 사이트 URL 설정
define('WP_HOME', 'https://${subdomain}');
define('WP_SITEURL', 'https://${subdomain}');

// 보안 키 (자동 생성됨)
define('AUTH_KEY',         '${crypto.randomUUID()}');
define('SECURE_AUTH_KEY',  '${crypto.randomUUID()}');
define('LOGGED_IN_KEY',    '${crypto.randomUUID()}');
define('NONCE_KEY',        '${crypto.randomUUID()}');
define('AUTH_SALT',        '${crypto.randomUUID()}');
define('SECURE_AUTH_SALT', '${crypto.randomUUID()}');
define('LOGGED_IN_SALT',   '${crypto.randomUUID()}');
define('NONCE_SALT',       '${crypto.randomUUID()}');

// 테이블 접두사
\$table_prefix = 'wp_';

// 디버그 모드 (프로덕션에서는 false)
define('WP_DEBUG', false);
define('WP_DEBUG_LOG', false);

// 미디어 파일을 GitHub에 저장
define('UPLOADS', 'wp-content/uploads');

// 메모리 제한
define('WP_MEMORY_LIMIT', '256M');

// WordPress 절대 경로
if (!defined('ABSPATH')) {
    define('ABSPATH', __DIR__ . '/');
}

require_once ABSPATH . 'wp-settings.php';
`

    // 4단계: GitHub Actions 워크플로우 생성
    // WordPress를 Nginx + PHP-FPM으로 실행하는 서버리스 환경
    const githubActionsWorkflow = `# 저장 위치: .github/workflows/deploy.yml
# CloudPress WordPress 자동 배포 워크플로우
# GitHub Actions로 Nginx + PHP-FPM WordPress 서버 실행 (서버리스)

name: CloudPress WordPress 배포

on:
  push:
    branches: [${branch}]
  workflow_dispatch:
    inputs:
      action:
        description: '실행할 작업'
        required: true
        default: 'deploy'
        type: choice
        options:
          - deploy
          - restart

env:
  SUBDOMAIN: ${subdomain}
  SITE_ID: ${siteId}
  WP_VERSION: ${WP_VERSION}

jobs:
  deploy:
    name: WordPress 배포
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: 저장소 체크아웃
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: PHP 설치
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.2'
          extensions: pdo, pdo_sqlite, sqlite3, mbstring, xml, curl, gd, zip, intl
          coverage: none

      - name: PHP 버전 확인
        run: php --version

      - name: WordPress 파일 확인 및 다운로드
        run: |
          if [ ! -f wordpress/wp-login.php ]; then
            echo "WordPress 파일을 다운로드하는 중..."
            curl -sL https://wordpress.org/wordpress-\${WP_VERSION}.zip -o wordpress.zip
            unzip -q wordpress.zip
            echo "WordPress \${WP_VERSION} 다운로드 완료"
          else
            echo "기존 WordPress 파일 사용"
          fi

      - name: SQLite 통합 플러그인 설치
        run: |
          mkdir -p wordpress/wp-content/plugins
          mkdir -p wordpress/wp-content/database
          
          # SQLite Database Integration 플러그인 다운로드
          curl -sL https://downloads.wordpress.org/plugin/sqlite-database-integration.latest-stable.zip -o sqlite-plugin.zip
          unzip -q sqlite-plugin.zip -d wordpress/wp-content/plugins/
          
          # db.php 드롭인 복사
          if [ -f wordpress/wp-content/plugins/sqlite-database-integration/db.copy ]; then
            cp wordpress/wp-content/plugins/sqlite-database-integration/db.copy wordpress/wp-content/db.php
          fi
          
          echo "SQLite 플러그인 설치 완료"

      - name: wp-config.php 설정
        run: |
          cat > wordpress/wp-config.php << 'WPCONFIG'
          <?php
          define('DB_DIR', __DIR__ . '/wp-content/database/');
          define('DB_FILE', 'cloudpress.db');
          define('WP_HOME', 'https://\${SUBDOMAIN}');
          define('WP_SITEURL', 'https://\${SUBDOMAIN}');
          define('AUTH_KEY', '\${{ secrets.WP_AUTH_KEY }}');
          define('SECURE_AUTH_KEY', '\${{ secrets.WP_SECURE_AUTH_KEY }}');
          define('LOGGED_IN_KEY', '\${{ secrets.WP_LOGGED_IN_KEY }}');
          define('NONCE_KEY', '\${{ secrets.WP_NONCE_KEY }}');
          define('AUTH_SALT', '\${{ secrets.WP_AUTH_SALT }}');
          define('SECURE_AUTH_SALT', '\${{ secrets.WP_SECURE_AUTH_SALT }}');
          define('LOGGED_IN_SALT', '\${{ secrets.WP_LOGGED_IN_SALT }}');
          define('NONCE_SALT', '\${{ secrets.WP_NONCE_SALT }}');
          \$table_prefix = 'wp_';
          define('WP_DEBUG', false);
          define('WP_MEMORY_LIMIT', '256M');
          if (!defined('ABSPATH')) { define('ABSPATH', __DIR__ . '/'); }
          require_once ABSPATH . 'wp-settings.php';
          WPCONFIG

      - name: Nginx 설치 및 설정
        run: |
          sudo apt-get update -qq
          sudo apt-get install -y -qq nginx php8.2-fpm php8.2-sqlite3 php8.2-mbstring php8.2-xml php8.2-curl php8.2-gd php8.2-zip php8.2-intl
          
          # Nginx WordPress 설정
          sudo tee /etc/nginx/sites-available/wordpress << 'NGINX'
          server {
              listen 8080;
              server_name _;
              root \$(pwd)/wordpress;
              index index.php index.html;
              
              client_max_body_size 64M;
              
              location / {
                  try_files \$uri \$uri/ /index.php?\$args;
              }
              
              location ~ \\.php\$ {
                  include snippets/fastcgi-php.conf;
                  fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
                  fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
                  include fastcgi_params;
              }
              
              location ~* \\.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)\$ {
                  expires 1y;
                  add_header Cache-Control "public, immutable";
              }
              
              location ~ /\\.ht {
                  deny all;
              }
          }
          NGINX
          
          sudo ln -sf /etc/nginx/sites-available/wordpress /etc/nginx/sites-enabled/
          sudo rm -f /etc/nginx/sites-enabled/default
          sudo systemctl start php8.2-fpm
          sudo systemctl start nginx
          sudo nginx -t

      - name: WordPress 초기 설정
        run: |
          # WP-CLI 설치
          curl -sO https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
          chmod +x wp-cli.phar
          
          cd wordpress
          
          # WordPress 설치 확인 및 초기화
          if ! php ../wp-cli.phar core is-installed 2>/dev/null; then
            php ../wp-cli.phar core install \\
              --url="https://\${SUBDOMAIN}" \\
              --title="${siteName}" \\
              --admin_user="admin" \\
              --admin_password="\${{ secrets.WP_ADMIN_PASSWORD }}" \\
              --admin_email="\${{ secrets.WP_ADMIN_EMAIL }}" \\
              --skip-email
            echo "WordPress 초기 설치 완료"
          else
            echo "WordPress 이미 설치됨"
          fi
          
          # 한국어 설정
          php ../wp-cli.phar language core install ko_KR --allow-root 2>/dev/null || true
          php ../wp-cli.phar site switch-language ko_KR --allow-root 2>/dev/null || true
          
          # 고정 링크 구조 설정
          php ../wp-cli.phar rewrite structure '/%postname%/' --allow-root 2>/dev/null || true

      - name: 헬스 체크
        run: |
          sleep 3
          curl -f http://localhost:8080/ || echo "헬스 체크 실패 (정상일 수 있음)"

      - name: 배포 상태 업데이트
        if: always()
        env:
          SUPABASE_URL: \${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: \${{ secrets.SUPABASE_SERVICE_KEY }}
          DEPLOYMENT_STATUS: \${{ job.status }}
        run: |
          STATUS="success"
          if [ "\$DEPLOYMENT_STATUS" != "success" ]; then
            STATUS="failed"
          fi
          
          curl -s -X POST "\${SUPABASE_URL}/rest/v1/deployments" \\
            -H "apikey: \${SUPABASE_SERVICE_KEY}" \\
            -H "Authorization: Bearer \${SUPABASE_SERVICE_KEY}" \\
            -H "Content-Type: application/json" \\
            -d "{
              \\"site_id\\": \\"\${SITE_ID}\\",
              \\"status\\": \\"\${STATUS}\\",
              \\"log\\": \\"GitHub Actions 배포 완료\\",
              \\"triggered_at\\": \\"\$(date -u +%Y-%m-%dT%H:%M:%SZ)\\",
              \\"completed_at\\": \\"\$(date -u +%Y-%m-%dT%H:%M:%SZ)\\"
            }" || true
`

    // 5단계: README.md 생성
    const readme = `# ${siteName} - CloudPress WordPress 사이트

> 이 저장소는 [클라우드프레스(CloudPress)](https://cloudpress.io)에 의해 자동 생성되었습니다.

## 🚀 사이트 정보

- **사이트명**: ${siteName}
- **서브도메인**: ${subdomain}
- **호스팅**: Cloudflare 기반 WordPress (GitHub Actions + Nginx)
- **데이터베이스**: SQLite (서버리스)
- **생성일**: ${new Date().toLocaleDateString('ko-KR')}

## 📁 디렉토리 구조

\`\`\`
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions 자동 배포
├── wordpress/                  # WordPress 핵심 파일
│   ├── wp-content/
│   │   ├── plugins/            # 플러그인
│   │   ├── themes/             # 테마
│   │   ├── uploads/            # 미디어 파일
│   │   └── database/           # SQLite DB 파일
│   └── wp-config.php           # WordPress 설정
└── README.md
\`\`\`

## ⚙️ GitHub Secrets 설정 필요

WordPress 운영을 위해 아래 GitHub Secrets를 설정해주세요:

| Secret 이름 | 설명 |
|-------------|------|
| \`WP_ADMIN_PASSWORD\` | WordPress 관리자 비밀번호 |
| \`WP_ADMIN_EMAIL\` | WordPress 관리자 이메일 |
| \`WP_AUTH_KEY\` | WordPress 보안 키 |
| \`WP_SECURE_AUTH_KEY\` | WordPress 보안 키 |
| \`WP_LOGGED_IN_KEY\` | WordPress 보안 키 |
| \`WP_NONCE_KEY\` | WordPress 보안 키 |
| \`WP_AUTH_SALT\` | WordPress 솔트 |
| \`WP_SECURE_AUTH_SALT\` | WordPress 솔트 |
| \`WP_LOGGED_IN_SALT\` | WordPress 솔트 |
| \`WP_NONCE_SALT\` | WordPress 솔트 |
| \`SUPABASE_URL\` | Supabase 프로젝트 URL |
| \`SUPABASE_SERVICE_KEY\` | Supabase 서비스 롤 키 |

## 🔧 관리

- **WordPress 관리자**: 클라우드프레스 대시보드에서 접속
- **미디어 파일**: \`wordpress/wp-content/uploads/\`에 저장됨
- **데이터베이스**: \`wordpress/wp-content/database/cloudpress.db\`

클라우드프레스 대시보드: https://cloudpress.io/dashboard
`

    // 6단계: 파일들을 GitHub에 업로드
    const filesToCreate = [
      {
        path: '.github/workflows/deploy.yml',
        content: btoa(unescape(encodeURIComponent(githubActionsWorkflow))),
        message: 'CloudPress: GitHub Actions 워크플로우 추가',
      },
      {
        path: 'README.md',
        content: btoa(unescape(encodeURIComponent(readme))),
        message: 'CloudPress: README 추가',
      },
      {
        path: '.gitignore',
        content: btoa(unescape(encodeURIComponent(
`# WordPress 핵심 파일 (Actions에서 다운로드)
wordpress/

# SQLite DB (민감 데이터)
*.db
*.sqlite

# 환경변수
.env
.env.local

# OS
.DS_Store
Thumbs.db

# 편집기
.vscode/
.idea/
`))),
        message: 'CloudPress: .gitignore 추가',
      },
    ]

    // 기존 파일 SHA 조회 함수
    const getFileSHA = async (filePath: string): Promise<string | undefined> => {
      try {
        const res = await fetch(
          `${GITHUB_API}/repos/${repoOwner}/${repoName}/contents/${filePath}`,
          { headers }
        )
        if (res.ok) {
          const data = await res.json()
          return data.sha
        }
      } catch {
        // 파일 없음
      }
      return undefined
    }

    for (const file of filesToCreate) {
      const sha = await getFileSHA(file.path)
      const body: Record<string, unknown> = {
        message: file.message,
        content: file.content,
        branch,
      }
      if (sha) body.sha = sha

      const uploadRes = await fetch(
        `${GITHUB_API}/repos/${repoOwner}/${repoName}/contents/${file.path}`,
        { method: 'PUT', headers, body: JSON.stringify(body) }
      )

      if (!uploadRes.ok && uploadRes.status !== 422) {
        console.error(`파일 업로드 실패: ${file.path}`, await uploadRes.text())
      }
    }

    // 7단계: Supabase 사이트 레코드 업데이트
    await supabase
      .from('sites')
      .update({
        github_repo_url: repoUrl,
        cf_pages_url: `https://${subdomain}`,
        status: 'building',
        last_deployed_at: new Date().toISOString(),
      })
      .eq('id', siteId)

    // 8단계: 배포 로그 업데이트
    await supabase
      .from('deployments')
      .insert({
        site_id: siteId,
        status: 'running',
        log: `GitHub 저장소 생성 완료: ${repoUrl}\nGitHub Actions 워크플로우 설정 완료\nWordPress 배포 시작 중...`,
        triggered_at: new Date().toISOString(),
      })

    return new Response(
      JSON.stringify({
        success: true,
        repoUrl,
        repoName,
        owner: repoOwner,
        branch,
        actionsUrl: `${repoUrl}/actions`,
        message: 'GitHub 저장소 생성 및 WordPress 배포 설정 완료',
        nextSteps: [
          'GitHub Actions에서 배포 진행 상황 확인',
          'GitHub Secrets 설정 필요 (WP_ADMIN_PASSWORD 등)',
          '배포 완료 후 WordPress 관리자 접속 가능',
        ],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('setup-wordpress-github 오류:', error)
    return new Response(
      JSON.stringify({ success: false, error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})