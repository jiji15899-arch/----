-- CloudPress 초기 데이터베이스 스키마
-- Supabase PostgreSQL

-- ============================
-- 확장 기능
-- ============================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================
-- profiles 테이블
-- ============================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  cf_api_key_encrypted TEXT,
  cf_email TEXT,
  gh_token_encrypted TEXT,
  plan_id TEXT DEFAULT 'starter',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "사용자 본인 프로필 조회" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "사용자 본인 프로필 수정" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "관리자 전체 프로필 조회" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- 새 사용자 가입 시 자동으로 프로필 생성
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (user_id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================
-- plans 테이블
-- ============================
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_usd NUMERIC(10,2) NOT NULL,
  max_sites INTEGER,
  max_domains INTEGER,
  storage_gb INTEGER NOT NULL,
  vps_spec TEXT CHECK (vps_spec IN ('basic', 'standard', 'high')),
  features JSONB DEFAULT '[]'
);

INSERT INTO plans (id, name, price_usd, max_sites, max_domains, storage_gb, vps_spec, features) VALUES
('starter', '스타터', 9.00, 1, 1, 5, 'basic', '["1개 사이트", "1개 도메인", "5GB 저장용량", "기본 VPS 사양", "Cloudflare CDN", "무료 SSL"]'),
('pro', '프로', 29.00, 5, 5, 20, 'standard', '["5개 사이트", "5개 도메인", "20GB 저장용량", "표준 VPS 사양", "우선 지원", "PHP→Astro 자동 변환"]'),
('business', '비즈니스', 79.00, NULL, NULL, 100, 'high', '["무제한 사이트", "무제한 도메인", "100GB 저장용량", "고성능 VPS 사양", "전용 지원", "고급 분석"]')
ON CONFLICT (id) DO NOTHING;

-- ============================
-- sites 테이블
-- ============================
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  product_type TEXT NOT NULL,
  hosting_type TEXT NOT NULL CHECK (hosting_type IN ('cloudflare', 'vps')),
  subdomain TEXT UNIQUE NOT NULL,
  github_repo_url TEXT,
  cf_pages_url TEXT,
  ec2_instance_id TEXT,
  ec2_public_ip TEXT,
  ec2_region TEXT,
  wp_admin_url TEXT,
  vps_provider TEXT CHECK (vps_provider IN ('aws', 'vultr', 'digitalocean')),
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('active', 'building', 'error', 'idle')),
  plan TEXT NOT NULL DEFAULT 'starter',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_deployed_at TIMESTAMPTZ
);

ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "사용자 본인 사이트 조회" ON sites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "사용자 본인 사이트 생성" ON sites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "사용자 본인 사이트 수정" ON sites
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "사용자 본인 사이트 삭제" ON sites
  FOR DELETE USING (auth.uid() = user_id);

-- ============================
-- domains 테이블
-- ============================
CREATE TABLE IF NOT EXISTS domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  domain TEXT UNIQUE NOT NULL,
  cf_zone_id TEXT,
  nameserver_1 TEXT,
  nameserver_2 TEXT,
  ns_status TEXT NOT NULL DEFAULT 'pending' CHECK (ns_status IN ('pending', 'active', 'failed')),
  ssl_status TEXT NOT NULL DEFAULT 'inactive' CHECK (ssl_status IN ('active', 'issuing', 'inactive')),
  connected_site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

ALTER TABLE domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "사용자 본인 도메인 조회" ON domains
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "사용자 본인 도메인 생성" ON domains
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "사용자 본인 도메인 수정" ON domains
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "사용자 본인 도메인 삭제" ON domains
  FOR DELETE USING (auth.uid() = user_id);

-- ============================
-- deployments 테이블
-- ============================
CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed')),
  log TEXT,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "사용자 본인 배포 조회" ON deployments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sites s WHERE s.id = site_id AND s.user_id = auth.uid())
  );

CREATE POLICY "사용자 본인 배포 생성" ON deployments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM sites s WHERE s.id = site_id AND s.user_id = auth.uid())
  );

-- ============================
-- conversion_jobs 테이블
-- ============================
CREATE TABLE IF NOT EXISTS conversion_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  input_type TEXT NOT NULL CHECK (input_type IN ('zip', 'url')),
  total_files INTEGER DEFAULT 0,
  converted INTEGER DEFAULT 0,
  stubs INTEGER DEFAULT 0,
  warnings INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE conversion_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "사용자 본인 변환 작업 조회" ON conversion_jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "사용자 본인 변환 작업 생성" ON conversion_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================
-- products 테이블
-- ============================
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  icon TEXT NOT NULL,
  tags JSONB DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  hosting_type TEXT NOT NULL CHECK (hosting_type IN ('cloudflare', 'vps', 'both')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "전체 사용자 활성 상품 조회" ON products
  FOR SELECT USING (is_active = TRUE OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- 상품 초기 데이터 삽입
INSERT INTO products (id, name, description, category, icon, tags, hosting_type) VALUES
('wordpress_cf', 'Cloudflare 기반 WordPress 호스팅', 'PHP→Astro+TS 자동 변환, GitHub+Cloudflare 서버리스 배포', '워드프레스 호스팅', '☁️', '["인기","추천","서버리스"]', 'cloudflare'),
('wordpress_vps', 'VPS 기반 WordPress 호스팅', '실제 PHP+MySQL WordPress 환경, SSH 접근 가능', '워드프레스 호스팅', '🖥️', '["강력한 성능","완전한 WordPress"]', 'vps'),
('blog', '블로그', 'Markdown/MDX 정적 블로그, SEO 최적화', '웹사이트 빌더', '📝', '["SEO","MDX"]', 'cloudflare'),
('portfolio', '포트폴리오 사이트', '개발자/디자이너용, GitHub 프로젝트 자동 연동', '웹사이트 빌더', '🎨', '["GitHub 연동"]', 'cloudflare'),
('landing', '랜딩페이지 빌더', '전환율 최적화, A/B 테스트 기능', '웹사이트 빌더', '🚀', '["A/B 테스트","전환 최적화"]', 'cloudflare'),
('linkinbio', '링크인바이오 페이지', 'SNS 프로필 링크 모음, 커스텀 도메인 연결', '웹사이트 빌더', '🔗', '["SNS","링크 모음"]', 'cloudflare'),
('company', '기업 홈페이지', '회사 소개, 팀 소개, 연락처 폼, 다국어 지원', '웹사이트 빌더', '🏢', '["다국어","기업용"]', 'cloudflare'),
('resume', '이력서/CV 사이트', '온라인 이력서, PDF 내보내기', '웹사이트 빌더', '📄', '["PDF 내보내기"]', 'cloudflare'),
('shop', '쇼핑몰', 'WooCommerce PHP 코드 자동 변환, PayPal/Stripe 결제 연동', '쇼핑몰 / 커머스', '🛍️', '["WooCommerce","결제 연동"]', 'cloudflare'),
('digital_goods', '디지털 상품 판매 사이트', 'PDF, 영상, 소프트웨어 판매, 자동 다운로드 링크', '쇼핑몰 / 커머스', '💾', '["디지털 판매","자동 배송"]', 'cloudflare'),
('booking', '예약/예매 사이트', '서비스 예약, 티켓 판매, 캘린더 연동', '쇼핑몰 / 커머스', '📅', '["예약","캘린더"]', 'cloudflare'),
('membership', '구독 멤버십 사이트', '유료 콘텐츠 잠금, 멤버십 등급 관리', '쇼핑몰 / 커머스', '👑', '["멤버십","구독"]', 'cloudflare'),
('newsletter', '뉴스레터 구독 페이지', '이메일 수집, Mailchimp/Resend 연동', '비즈니스 도구', '📧', '["Mailchimp","Resend"]', 'cloudflare'),
('form_builder', '설문/폼 빌더 사이트', '커스텀 폼 생성, 응답 수집 및 분석', '비즈니스 도구', '📋', '["설문","데이터 수집"]', 'cloudflare'),
('event', '이벤트 페이지', '행사 안내, 참가 신청, 카운트다운', '비즈니스 도구', '🎉', '["이벤트","카운트다운"]', 'cloudflare'),
('admin_dashboard', '대시보드/어드민 사이트', '내부 관리자 도구, 데이터 시각화', '비즈니스 도구', '📊', '["대시보드","데이터 시각화"]', 'cloudflare'),
('gallery', '사진 갤러리 / 포토그래퍼 사이트', '고해상도 이미지 최적화, Cloudflare Images 연동', '콘텐츠 & 미디어', '📸', '["갤러리","Cloudflare Images"]', 'cloudflare'),
('youtube', '유튜브/영상 채널 사이트', 'YouTube API 연동, 영상 임베드 자동화', '콘텐츠 & 미디어', '🎥', '["YouTube API","영상"]', 'cloudflare'),
('podcast', '팟캐스트 사이트', '에피소드 관리, RSS 피드 자동 생성', '콘텐츠 & 미디어', '🎙️', '["RSS","팟캐스트"]', 'cloudflare'),
('wiki', '문서/위키 사이트', 'Notion 스타일 문서 관리, 검색 기능 내장', '콘텐츠 & 미디어', '📚', '["위키","문서"]', 'cloudflare'),
('api_docs', 'API 문서 사이트', 'OpenAPI/Swagger 자동 문서화', '개발자 도구', '📖', '["OpenAPI","Swagger"]', 'cloudflare'),
('opensource', '오픈소스 프로젝트 페이지', 'GitHub README 자동 연동, 기여자 목록', '개발자 도구', '💻', '["오픈소스","GitHub"]', 'cloudflare'),
('status_page', '상태 페이지', '서비스 운영 현황 실시간 표시, 장애 공지', '개발자 도구', '🟢', '["상태 모니터링","장애 공지"]', 'cloudflare'),
('dev_blog', '개발 블로그 + 코드 하이라이팅', 'Shiki 문법 강조, GitHub Gist 연동', '개발자 도구', '✍️', '["Shiki","GitHub Gist"]', 'cloudflare')
ON CONFLICT (id) DO NOTHING;

-- ============================
-- admin_settings 테이블
-- ============================
CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "관리자만 설정 조회" ON admin_settings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "관리자만 설정 수정" ON admin_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- 초기 설정값
INSERT INTO admin_settings (key, value) VALUES
('AWS_ACCESS_KEY_ID', ''),
('AWS_SECRET_ACCESS_KEY', ''),
('AWS_DEFAULT_REGION', 'ap-northeast-2'),
('EC2_DEFAULT_AMI', ''),
('EC2_SECURITY_GROUP', ''),
('EC2_KEY_PAIR', ''),
('VULTR_API_KEY', ''),
('DO_API_KEY', ''),
('PAYPAL_CLIENT_ID', ''),
('PAYPAL_SECRET', ''),
('PAYPAL_MODE', 'sandbox'),
('MAINTENANCE_MODE', 'false'),
('ANNOUNCEMENT_BANNER', ''),
('ANNOUNCEMENT_ACTIVE', 'false')
ON CONFLICT (key) DO NOTHING;

-- ============================
-- invoices 테이블
-- ============================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_id TEXT REFERENCES plans(id) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  paypal_order_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "사용자 본인 청구서 조회" ON invoices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "사용자 본인 청구서 생성" ON invoices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================
-- audit_logs 테이블
-- ============================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "관리자만 감사 로그 조회" ON audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "관리자만 감사 로그 생성" ON audit_logs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- ============================
-- 인덱스
-- ============================
CREATE INDEX IF NOT EXISTS idx_sites_user_id ON sites(user_id);
CREATE INDEX IF NOT EXISTS idx_sites_subdomain ON sites(subdomain);
CREATE INDEX IF NOT EXISTS idx_domains_user_id ON domains(user_id);
CREATE INDEX IF NOT EXISTS idx_deployments_site_id ON deployments(site_id);
CREATE INDEX IF NOT EXISTS idx_conversion_jobs_user_id ON conversion_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);