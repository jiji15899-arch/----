-- CloudPress D1 Schema
-- Run: wrangler d1 execute cloudpress-db --file=schema.sql

PRAGMA foreign_keys = ON;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
  cf_api_key_enc TEXT,
  cf_email TEXT,
  gh_token_enc TEXT,
  plan_id TEXT DEFAULT 'free',
  email_verified INTEGER DEFAULT 0,
  is_suspended INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sites
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  product_type TEXT NOT NULL DEFAULT 'wordpress_headless',
  -- WordPress CMS info
  wp_url TEXT,           -- byethost wordpress URL
  wp_username TEXT,
  wp_app_password_enc TEXT,
  wp_site_title TEXT,
  -- GitHub storage
  gh_repo_name TEXT,
  gh_repo_url TEXT,
  gh_repo_full_name TEXT,
  -- Cloudflare worker
  cf_worker_name TEXT,
  cf_worker_url TEXT,
  cf_zone_id TEXT,
  -- Custom domain
  custom_domain TEXT,
  custom_domain_status TEXT DEFAULT 'none' CHECK(custom_domain_status IN ('none','pending','active','error')),
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','building','error','suspended')),
  wp_detection_status TEXT DEFAULT 'waiting' CHECK(wp_detection_status IN ('waiting','detected','failed')),
  -- ISR/Cache settings
  isr_enabled INTEGER DEFAULT 1,
  cache_ttl INTEGER DEFAULT 60,
  -- Webhook secret for WP → CF communication
  webhook_secret TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_deployed_at TEXT
);

-- Domains
CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain TEXT UNIQUE NOT NULL,
  cf_zone_id TEXT,
  nameserver_1 TEXT,
  nameserver_2 TEXT,
  ns_status TEXT DEFAULT 'pending' CHECK(ns_status IN ('pending','active','error')),
  ssl_status TEXT DEFAULT 'pending' CHECK(ssl_status IN ('pending','active','error')),
  connected_site_id TEXT REFERENCES sites(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  verified_at TEXT
);

-- Deployments / build log
CREATE TABLE IF NOT EXISTS deployments (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','success','error')),
  trigger_type TEXT DEFAULT 'manual' CHECK(trigger_type IN ('manual','webhook','scheduled','isr')),
  log TEXT,
  triggered_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

-- Plans
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_usd REAL NOT NULL DEFAULT 0,
  max_sites INTEGER NOT NULL DEFAULT 1,
  max_domains INTEGER NOT NULL DEFAULT 1,
  storage_gb INTEGER NOT NULL DEFAULT 1,
  features TEXT NOT NULL DEFAULT '{}',
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Invoices / payments
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  paypal_order_id TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','paid','failed','refunded')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT
);

-- Admin settings (key-value)
CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Products (only 1 active: wordpress_headless)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  icon TEXT,
  tags TEXT DEFAULT '[]',
  is_active INTEGER DEFAULT 1,
  hosting_type TEXT DEFAULT 'cloudflare',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- WordPress content cache (KV mirror for D1 reads)
CREATE TABLE IF NOT EXISTS wp_content_cache (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL, -- 'post','page','category','tag','media','menu'
  wp_id INTEGER NOT NULL,
  slug TEXT,
  data TEXT NOT NULL, -- JSON
  cached_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(site_id, content_type, wp_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sites_user ON sites(user_id);
CREATE INDEX IF NOT EXISTS idx_sites_subdomain ON sites(subdomain);
CREATE INDEX IF NOT EXISTS idx_sites_status ON sites(status);
CREATE INDEX IF NOT EXISTS idx_domains_user ON domains(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_deployments_site ON deployments(site_id);
CREATE INDEX IF NOT EXISTS idx_wp_cache_site ON wp_content_cache(site_id, content_type);

-- Seed default plans
INSERT OR IGNORE INTO plans (id, name, price_usd, max_sites, max_domains, storage_gb, features) VALUES
  ('free', '무료', 0, 1, 1, 1, '{"support":"커뮤니티","bandwidth":"10GB/월"}'),
  ('starter', '스타터', 9, 3, 3, 5, '{"support":"이메일","bandwidth":"100GB/월","custom_domain":true}'),
  ('pro', '프로', 29, 10, 10, 20, '{"support":"우선순위 이메일","bandwidth":"무제한","custom_domain":true,"analytics":true}'),
  ('business', '비즈니스', 79, -1, -1, 100, '{"support":"전용 지원","bandwidth":"무제한","custom_domain":true,"analytics":true,"sla":"99.9%"}');

-- Seed default product
INSERT OR IGNORE INTO products (id, name, slug, description, category, icon, tags, is_active, hosting_type, sort_order) VALUES
  ('wordpress_headless', '클라우드플레어 워드프레스 호스팅', 'wordpress-headless', 
   '헤드리스 WordPress + Cloudflare Workers로 번개처럼 빠른 사이트. WordPress는 CMS로만 사용하고 모든 트래픽은 Cloudflare가 처리합니다.',
   '워드프레스 호스팅', '☁️', '["인기","추천","헤드리스","무제한 트래픽"]', 1, 'cloudflare', 1);

-- Seed admin settings defaults
INSERT OR IGNORE INTO admin_settings (key, value) VALUES
  ('PAYPAL_MODE', 'sandbox'),
  ('PAYPAL_CLIENT_ID', ''),
  ('PAYPAL_SECRET', ''),
  ('MAINTENANCE_MODE', 'false'),
  ('ANNOUNCEMENT_BANNER', ''),
  ('ANNOUNCEMENT_ACTIVE', 'false'),
  ('CF_WORKER_TEMPLATE_VERSION', '1.0.0');