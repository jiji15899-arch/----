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

    const { siteId, provider, spec, siteName, subdomain } = await req.json()

    // 관리자 설정에서 API 키 조회
    const { data: settings } = await supabase
      .from('admin_settings')
      .select('key, value')

    const settingsMap: Record<string, string> = {}
    settings?.forEach(s => { settingsMap[s.key] = s.value })

    let result

    switch (provider) {
      case 'aws':
        result = await provisionAWS(settingsMap, spec, siteName, subdomain)
        break
      case 'vultr':
        result = await provisionVultr(settingsMap, spec, siteName)
        break
      case 'digitalocean':
        result = await provisionDigitalOcean(settingsMap, spec, siteName)
        break
      default:
        throw new Error('지원하지 않는 VPS 제공업체입니다.')
    }

    // 사이트 정보 업데이트
    await supabase.from('sites').update({
      ec2_instance_id: result.instanceId,
      ec2_public_ip: result.publicIp,
      ec2_region: result.region,
      wp_admin_url: `http://${result.publicIp}/wp-admin`,
      vps_provider: provider,
      status: 'building',
    }).eq('id', siteId)

    // 배포 로그 생성
    await supabase.from('deployments').insert({
      site_id: siteId,
      status: 'running',
      log: `VPS 인스턴스 생성 완료: ${result.instanceId}`,
    })

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : '프로비저닝 오류' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// AWS EC2 인스턴스 생성
async function provisionAWS(settings: Record<string, string>, spec: string, siteName: string, _subdomain: string) {
  const instanceTypes = { basic: 't3.micro', standard: 't3.small', high: 't3.large' }
  const instanceType = instanceTypes[spec as keyof typeof instanceTypes] || 't3.micro'

  const region = settings.AWS_DEFAULT_REGION || 'ap-northeast-2'

  // AWS EC2 RunInstances API 호출
  // 실제 구현에서는 AWS SDK 또는 서명된 API 요청 사용
  // 여기서는 구조를 보여주는 예시

  const userData = btoa(`#!/bin/bash
apt-get update -y
apt-get install -y nginx php8.2-fpm php8.2-mysql php8.2-sqlite3 php8.2-curl php8.2-gd php8.2-mbstring php8.2-xml php8.2-zip sqlite3
systemctl enable nginx php8.2-fpm
systemctl start nginx php8.2-fpm

# WordPress 설치
cd /var/www/html
wget -q https://wordpress.org/latest.tar.gz
tar -xzf latest.tar.gz
cp -r wordpress/* .
rm -rf wordpress latest.tar.gz index.nginx-debian.html

# SQLite 플러그인
mkdir -p wp-content/plugins
wget -q https://downloads.wordpress.org/plugin/sqlite-database-integration.latest-stable.zip
unzip -q sqlite-database-integration.latest-stable.zip -d wp-content/plugins/
cp wp-content/plugins/sqlite-database-integration/db.copy wp-content/db.php

# 권한 설정
chown -R www-data:www-data /var/www/html
chmod -R 755 /var/www/html

# Nginx 설정
cat > /etc/nginx/sites-available/wordpress << 'EOF'
server {
    listen 80;
    server_name _;
    root /var/www/html;
    index index.php index.html;

    location / {
        try_files $uri $uri/ /index.php?$args;
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
    }
}
EOF

ln -sf /etc/nginx/sites-available/wordpress /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
systemctl reload nginx

echo "WordPress 설치 완료: ${siteName}"
`)

  // AWS API 서명 (실제 구현 필요)
  // 데모용 응답
  const mockInstanceId = `i-${crypto.randomUUID().replace(/-/g, '').slice(0, 17)}`
  const mockIp = `54.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`

  return {
    instanceId: mockInstanceId,
    publicIp: mockIp,
    region,
    instanceType,
    userData: userData.length > 0 ? '설정됨' : '없음',
  }
}

// Vultr 인스턴스 생성
async function provisionVultr(settings: Record<string, string>, spec: string, siteName: string) {
  const apiKey = settings.VULTR_API_KEY
  if (!apiKey) throw new Error('Vultr API 키가 설정되지 않았습니다.')

  const planMap = { basic: 'vc2-1c-1gb', standard: 'vc2-2c-2gb', high: 'vc2-4c-8gb' }
  const plan = planMap[spec as keyof typeof planMap] || 'vc2-1c-1gb'

  const res = await fetch('https://api.vultr.com/v2/instances', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      region: 'icn', // 서울
      plan,
      os_id: 387, // Ubuntu 22.04
      label: `cloudpress-${siteName}`,
      user_data: getWordPressUserData(siteName),
    }),
  })

  if (!res.ok) throw new Error('Vultr 인스턴스 생성에 실패했습니다.')
  const data = await res.json()

  return {
    instanceId: data.instance?.id,
    publicIp: data.instance?.main_ip || '배포중',
    region: 'icn-kor',
    instanceType: plan,
  }
}

// DigitalOcean Droplet 생성
async function provisionDigitalOcean(settings: Record<string, string>, spec: string, siteName: string) {
  const apiKey = settings.DO_API_KEY
  if (!apiKey) throw new Error('DigitalOcean API 키가 설정되지 않았습니다.')

  const sizeMap = { basic: 's-1vcpu-1gb', standard: 's-2vcpu-2gb', high: 's-4vcpu-8gb' }
  const size = sizeMap[spec as keyof typeof sizeMap] || 's-1vcpu-1gb'

  const res = await fetch('https://api.digitalocean.com/v2/droplets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `cloudpress-${siteName}`,
      region: 'sgp1',
      size,
      image: 'ubuntu-22-04-x64',
      user_data: getWordPressUserData(siteName),
    }),
  })

  if (!res.ok) throw new Error('DigitalOcean Droplet 생성에 실패했습니다.')
  const data = await res.json()

  return {
    instanceId: String(data.droplet?.id),
    publicIp: data.droplet?.networks?.v4?.[0]?.ip_address || '배포중',
    region: 'sgp1',
    instanceType: size,
  }
}

function getWordPressUserData(siteName: string): string {
  return `#!/bin/bash
apt-get update -y
apt-get install -y nginx php8.2-fpm php8.2-sqlite3 php8.2-curl php8.2-gd php8.2-mbstring php8.2-xml php8.2-zip sqlite3
systemctl enable nginx php8.2-fpm && systemctl start nginx php8.2-fpm
cd /var/www/html
wget -q https://wordpress.org/latest.tar.gz && tar -xzf latest.tar.gz && cp -r wordpress/* . && rm -rf wordpress latest.tar.gz
mkdir -p wp-content/plugins
wget -q https://downloads.wordpress.org/plugin/sqlite-database-integration.latest-stable.zip
unzip -q sqlite-database-integration.latest-stable.zip -d wp-content/plugins/
cp wp-content/plugins/sqlite-database-integration/db.copy wp-content/db.php
chown -R www-data:www-data /var/www/html
echo "설치완료: ${siteName}"`
}