// src/lib/db/index.ts
// D1 database query helpers

import type { User, Site, Domain, Deployment, Plan, Product, AdminSetting, AuditLog, Session } from '../../types/index.ts';
import { generateId } from '../utils/crypto.ts';

// ── Users ──────────────────────────────────────────────────────────────

export async function getUserById(db: D1Database, id: string): Promise<User | null> {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<User>();
}

export async function getUserByEmail(db: D1Database, email: string): Promise<User | null> {
  return db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<User>();
}

export async function createUser(db: D1Database, data: {
  email: string;
  password_hash?: string;
  name: string;
  avatar_url?: string;
  role?: string;
}): Promise<User> {
  const id = generateId();
  await db.prepare(
    `INSERT INTO users (id, email, password_hash, name, avatar_url, role) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, data.email, data.password_hash || null, data.name, data.avatar_url || null, data.role || 'user').run();
  return (await getUserById(db, id))!;
}

export async function updateUser(db: D1Database, id: string, data: Partial<Pick<User, 'name' | 'avatar_url' | 'cf_api_key_enc' | 'cf_email' | 'gh_token_enc' | 'plan_id' | 'is_suspended'>>): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) { sets.push(`${key} = ?`); values.push(val); }
  }
  if (!sets.length) return;
  sets.push('updated_at = datetime(\'now\')');
  values.push(id);
  await db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
}

export async function listUsers(db: D1Database, opts: { limit?: number; offset?: number; search?: string } = {}): Promise<{ users: User[]; total: number }> {
  const where = opts.search ? `WHERE email LIKE ? OR name LIKE ?` : '';
  const binds: unknown[] = opts.search ? [`%${opts.search}%`, `%${opts.search}%`] : [];
  const total = await db.prepare(`SELECT COUNT(*) as c FROM users ${where}`).bind(...binds).first<{ c: number }>();
  const users = await db.prepare(`SELECT * FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .bind(...binds, opts.limit ?? 50, opts.offset ?? 0).all<User>();
  return { users: users.results, total: total?.c ?? 0 };
}

export async function deleteUser(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
}

// ── Sessions ────────────────────────────────────────────────────────────

export async function createSession(db: D1Database, userId: string, expiresAt: Date): Promise<Session> {
  const id = generateId();
  await db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(id, userId, expiresAt.toISOString()).run();
  return { id, user_id: userId, expires_at: expiresAt.toISOString(), created_at: new Date().toISOString() };
}

export async function getSession(db: D1Database, id: string): Promise<Session | null> {
  return db.prepare('SELECT * FROM sessions WHERE id = ? AND expires_at > datetime(\'now\')')
    .bind(id).first<Session>();
}

export async function deleteSession(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
}

export async function cleanExpiredSessions(db: D1Database): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE expires_at <= datetime(\'now\')').run();
}

// ── Sites ───────────────────────────────────────────────────────────────

export async function getSiteById(db: D1Database, id: string): Promise<Site | null> {
  return db.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first<Site>();
}

export async function getSiteBySubdomain(db: D1Database, subdomain: string): Promise<Site | null> {
  return db.prepare('SELECT * FROM sites WHERE subdomain = ?').bind(subdomain).first<Site>();
}

export async function getSitesByUser(db: D1Database, userId: string): Promise<Site[]> {
  const r = await db.prepare('SELECT * FROM sites WHERE user_id = ? ORDER BY created_at DESC').bind(userId).all<Site>();
  return r.results;
}

export async function createSite(db: D1Database, data: Partial<Site> & { user_id: string; name: string; subdomain: string }): Promise<Site> {
  const id = generateId();
  await db.prepare(
    `INSERT INTO sites (id, user_id, name, subdomain, product_type, wp_url, wp_username, wp_app_password_enc, wp_site_title, gh_repo_name, gh_repo_url, gh_repo_full_name, cf_worker_name, cf_worker_url, webhook_secret, status, wp_detection_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, data.user_id, data.name, data.subdomain,
    data.product_type || 'wordpress_headless',
    data.wp_url || null, data.wp_username || null, data.wp_app_password_enc || null, data.wp_site_title || null,
    data.gh_repo_name || null, data.gh_repo_url || null, data.gh_repo_full_name || null,
    data.cf_worker_name || null, data.cf_worker_url || null,
    data.webhook_secret || null,
    data.status || 'pending',
    data.wp_detection_status || 'waiting'
  ).run();
  return (await getSiteById(db, id))!;
}

export async function updateSite(db: D1Database, id: string, data: Partial<Omit<Site, 'id' | 'user_id'>>): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) { sets.push(`${key} = ?`); values.push(val); }
  }
  if (!sets.length) return;
  values.push(id);
  await db.prepare(`UPDATE sites SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
}

export async function deleteSite(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM sites WHERE id = ?').bind(id).run();
}

export async function listAllSites(db: D1Database, opts: { limit?: number; offset?: number } = {}): Promise<{ sites: Site[]; total: number }> {
  const total = await db.prepare('SELECT COUNT(*) as c FROM sites').first<{ c: number }>();
  const sites = await db.prepare('SELECT * FROM sites ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .bind(opts.limit ?? 50, opts.offset ?? 0).all<Site>();
  return { sites: sites.results, total: total?.c ?? 0 };
}

// ── Domains ─────────────────────────────────────────────────────────────

export async function getDomainById(db: D1Database, id: string): Promise<Domain | null> {
  return db.prepare('SELECT * FROM domains WHERE id = ?').bind(id).first<Domain>();
}

export async function getDomainsByUser(db: D1Database, userId: string): Promise<Domain[]> {
  const r = await db.prepare('SELECT * FROM domains WHERE user_id = ? ORDER BY created_at DESC').bind(userId).all<Domain>();
  return r.results;
}

export async function createDomain(db: D1Database, data: Partial<Domain> & { user_id: string; domain: string }): Promise<Domain> {
  const id = generateId();
  await db.prepare(
    `INSERT INTO domains (id, user_id, domain, cf_zone_id, nameserver_1, nameserver_2, ns_status, ssl_status, connected_site_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, data.user_id, data.domain,
    data.cf_zone_id || null, data.nameserver_1 || null, data.nameserver_2 || null,
    data.ns_status || 'pending', data.ssl_status || 'pending',
    data.connected_site_id || null
  ).run();
  return (await getDomainById(db, id))!;
}

export async function updateDomain(db: D1Database, id: string, data: Partial<Omit<Domain, 'id' | 'user_id'>>): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) { sets.push(`${key} = ?`); values.push(val); }
  }
  if (!sets.length) return;
  values.push(id);
  await db.prepare(`UPDATE domains SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
}

export async function deleteDomain(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM domains WHERE id = ?').bind(id).run();
}

export async function listAllDomains(db: D1Database): Promise<Domain[]> {
  const r = await db.prepare('SELECT * FROM domains ORDER BY created_at DESC').all<Domain>();
  return r.results;
}

// ── Deployments ─────────────────────────────────────────────────────────

export async function createDeployment(db: D1Database, data: { site_id: string; user_id: string; trigger_type?: string; log?: string }): Promise<Deployment> {
  const id = generateId();
  await db.prepare(
    `INSERT INTO deployments (id, site_id, user_id, status, trigger_type, log) VALUES (?, ?, ?, 'pending', ?, ?)`
  ).bind(id, data.site_id, data.user_id, data.trigger_type || 'manual', data.log || null).run();
  return (await db.prepare('SELECT * FROM deployments WHERE id = ?').bind(id).first<Deployment>())!;
}

export async function updateDeployment(db: D1Database, id: string, data: { status: string; log?: string; completed_at?: string }): Promise<void> {
  await db.prepare('UPDATE deployments SET status = ?, log = ?, completed_at = ? WHERE id = ?')
    .bind(data.status, data.log || null, data.completed_at || null, id).run();
}

export async function getDeploymentsBySite(db: D1Database, siteId: string, limit = 20): Promise<Deployment[]> {
  const r = await db.prepare('SELECT * FROM deployments WHERE site_id = ? ORDER BY triggered_at DESC LIMIT ?')
    .bind(siteId, limit).all<Deployment>();
  return r.results;
}

// ── Plans ────────────────────────────────────────────────────────────────

export async function getAllPlans(db: D1Database): Promise<Plan[]> {
  const r = await db.prepare('SELECT * FROM plans WHERE is_active = 1 ORDER BY price_usd ASC').all<Plan>();
  return r.results.map(p => ({ ...p, features: typeof p.features === 'string' ? JSON.parse(p.features) : p.features }));
}

export async function getPlanById(db: D1Database, id: string): Promise<Plan | null> {
  const p = await db.prepare('SELECT * FROM plans WHERE id = ?').bind(id).first<Plan>();
  if (!p) return null;
  return { ...p, features: typeof p.features === 'string' ? JSON.parse(p.features) : p.features };
}

// ── Products ─────────────────────────────────────────────────────────────

export async function getActiveProducts(db: D1Database): Promise<Product[]> {
  const r = await db.prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY sort_order ASC').all<Product>();
  return r.results.map(p => ({ ...p, tags: typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags }));
}

export async function getAllProducts(db: D1Database): Promise<Product[]> {
  const r = await db.prepare('SELECT * FROM products ORDER BY sort_order ASC').all<Product>();
  return r.results.map(p => ({ ...p, tags: typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags }));
}

export async function updateProductActive(db: D1Database, id: string, isActive: boolean): Promise<void> {
  await db.prepare('UPDATE products SET is_active = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .bind(isActive ? 1 : 0, id).run();
}

// ── Admin settings ────────────────────────────────────────────────────────

export async function getAdminSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare('SELECT value FROM admin_settings WHERE key = ?').bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

export async function setAdminSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db.prepare(
    `INSERT INTO admin_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).bind(key, value).run();
}

export async function getAllAdminSettings(db: D1Database): Promise<Record<string, string>> {
  const r = await db.prepare('SELECT key, value FROM admin_settings').all<{ key: string; value: string }>();
  return Object.fromEntries(r.results.map(s => [s.key, s.value]));
}

// ── Audit logs ────────────────────────────────────────────────────────────

export async function createAuditLog(db: D1Database, data: {
  admin_id: string;
  action: string;
  target_type?: string;
  target_id?: string;
  detail?: string;
}): Promise<void> {
  const id = generateId();
  await db.prepare(
    'INSERT INTO audit_logs (id, admin_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, data.admin_id, data.action, data.target_type || null, data.target_id || null, data.detail || null).run();
}

export async function getAuditLogs(db: D1Database, limit = 100, offset = 0): Promise<AuditLog[]> {
  const r = await db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .bind(limit, offset).all<AuditLog>();
  return r.results;
}

// ── Invoices ──────────────────────────────────────────────────────────────

export async function createInvoice(db: D1Database, data: {
  user_id: string;
  plan_id: string;
  amount: number;
  paypal_order_id?: string;
}): Promise<string> {
  const id = generateId();
  await db.prepare(
    'INSERT INTO invoices (id, user_id, plan_id, amount, paypal_order_id, status) VALUES (?, ?, ?, ?, ?, \'pending\')'
  ).bind(id, data.user_id, data.plan_id, data.amount, data.paypal_order_id || null).run();
  return id;
}

export async function updateInvoiceStatus(db: D1Database, id: string, status: string, paidAt?: string): Promise<void> {
  await db.prepare('UPDATE invoices SET status = ?, paid_at = ? WHERE id = ?')
    .bind(status, paidAt || null, id).run();
}

export async function getInvoicesByUser(db: D1Database, userId: string): Promise<unknown[]> {
  const r = await db.prepare('SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC').bind(userId).all();
  return r.results;
}