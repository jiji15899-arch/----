// 저장 위치: /src/lib/db.ts
// Cloudflare D1 + Workers API 클라이언트
// Supabase를 완전히 대체 - 모든 DB 호출은 /api/* Workers를 통해

const API_BASE = import.meta.env.VITE_API_URL || '/api'

// ─────────────────────────────────────────
// HTTP 헬퍼
// ─────────────────────────────────────────

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('cp_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...(options.headers as Record<string, string> || {}),
    },
  })

  const data = await res.json() as Record<string, unknown>

  if (!res.ok) {
    throw new Error((data.error as string) || `요청 실패 (${res.status})`)
  }

  return data as T
}

const get = <T>(path: string) => request<T>(path)
const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) })
const put = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PUT', body: JSON.stringify(body) })
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' })
const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body) })

// ─────────────────────────────────────────
// 인증 API
// ─────────────────────────────────────────

export const auth = {
  signUp: (email: string, password: string, name: string) =>
    post<{ token: string; user: { id: string; email: string } }>(
      '/auth/signup', { email, password, name }
    ),

  signIn: (email: string, password: string) =>
    post<{ token: string; user: { id: string; email: string } }>(
      '/auth/signin', { email, password }
    ),

  signOut: () => {
    localStorage.removeItem('cp_token')
    localStorage.removeItem('cp_user')
  },

  resetPassword: (email: string) =>
    post<{ ok: boolean }>('/auth/reset-password', { email }),

  me: () => get<{ id: string; email: string }>('/auth/me'),
}

// ─────────────────────────────────────────
// 프로필 API
// ─────────────────────────────────────────

export async function getProfile(userId: string) {
  return get<Profile>(`/profiles/${userId}`)
}

export async function updateProfile(userId: string, updates: Record<string, unknown>) {
  return put<Profile>(`/profiles/${userId}`, updates)
}

// ─────────────────────────────────────────
// 사이트 API
// ─────────────────────────────────────────

export async function getMySites(userId: string) {
  return get<Site[]>(`/sites?user_id=${userId}`)
}

export async function getSiteById(siteId: string) {
  return get<Site>(`/sites/${siteId}`)
}

export async function createSite(siteData: Record<string, unknown>) {
  return post<Site>('/sites', siteData)
}

export async function updateSite(siteId: string, updates: Record<string, unknown>) {
  return patch<Site>(`/sites/${siteId}`, updates)
}

export async function deleteSite(siteId: string) {
  return del<{ ok: boolean }>(`/sites/${siteId}`)
}

export async function getAllSites() {
  return get<Site[]>('/admin/sites')
}

// ─────────────────────────────────────────
// 도메인 API
// ─────────────────────────────────────────

export async function getMyDomains(userId: string) {
  return get<Domain[]>(`/domains?user_id=${userId}`)
}

export async function addDomain(domainData: Record<string, unknown>) {
  return post<Domain>('/domains', domainData)
}

export async function deleteDomain(domainId: string) {
  return del<{ ok: boolean }>(`/domains/${domainId}`)
}

export async function getAllDomains() {
  return get<Domain[]>('/admin/domains')
}

// ─────────────────────────────────────────
// 상품 API
// ─────────────────────────────────────────

export async function getActiveProducts() {
  return get<Product[]>('/products?active=true')
}

export async function getAllProducts() {
  return get<Product[]>('/products')
}

export async function toggleProductStatus(productId: string, isActive: boolean) {
  return patch<Product>(`/admin/products/${productId}`, { is_active: isActive })
}

// ─────────────────────────────────────────
// 배포 API
// ─────────────────────────────────────────

export async function createDeployment(deploymentData: Record<string, unknown>) {
  return post<Deployment>('/deployments', deploymentData)
}

export async function getDeployments(siteId: string) {
  return get<Deployment[]>(`/deployments?site_id=${siteId}`)
}

// ─────────────────────────────────────────
// 관리자 설정 API
// ─────────────────────────────────────────

export async function getAdminSettings() {
  const list = await get<{ key: string; value: string }[]>('/admin/settings')
  const settings: Record<string, string> = {}
  list.forEach(item => { settings[item.key] = item.value })
  return settings
}

export async function saveAdminSetting(key: string, value: string) {
  return post<{ ok: boolean }>('/admin/settings', { key, value })
}

// ─────────────────────────────────────────
// 사용자 관리 API (관리자)
// ─────────────────────────────────────────

export async function getAllUsers() {
  return get<Profile[]>('/admin/users')
}

export async function updateUserRole(userId: string, role: 'user' | 'admin') {
  return patch<Profile>(`/admin/users/${userId}`, { role })
}

export async function deleteUser(userId: string) {
  return del<{ ok: boolean }>(`/admin/users/${userId}`)
}

// ─────────────────────────────────────────
// 청구서 API
// ─────────────────────────────────────────

export async function getInvoices(userId: string) {
  return get<Invoice[]>(`/invoices?user_id=${userId}`)
}

// ─────────────────────────────────────────
// 감사 로그 API
// ─────────────────────────────────────────

export async function createAuditLog(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string
) {
  try {
    await post<{ ok: boolean }>('/admin/audit-logs', {
      admin_id: adminId,
      action,
      target_type: targetType,
      target_id: targetId,
    })
  } catch (e) {
    console.error('감사 로그 기록 실패:', e)
  }
}

export async function getAuditLogs() {
  return get<AuditLog[]>('/admin/audit-logs')
}

// ─────────────────────────────────────────
// Workers API 호출 (Edge Function 대체)
// ─────────────────────────────────────────

export async function callWorkerAction<T = unknown>(
  action: string,
  body: Record<string, unknown>
): Promise<T> {
  return post<T>(`/actions/${action}`, body)
}

// 개별 액션 헬퍼
export const actions = {
  validateCloudflare: (apiKey: string, email: string) =>
    callWorkerAction('validate-cloudflare', { apiKey, email }),

  validateGitHub: (token: string) =>
    callWorkerAction('validate-github', { token }),

  validateAWS: (accessKeyId: string, secretAccessKey: string, region: string) =>
    callWorkerAction('validate-aws', { accessKeyId, secretAccessKey, region }),

  validateVPSProvider: (provider: string, apiKey: string) =>
    callWorkerAction('validate-vps-provider', { provider, apiKey }),

  createGitHubRepo: (params: { repoName: string; siteId: string; token: string }) =>
    callWorkerAction('create-github-repo', params),

  setupWordPressGitHub: (params: {
    siteId: string
    repoName: string
    githubToken: string
    subdomain: string
    siteName: string
  }) => callWorkerAction('setup-wordpress-github', params),

  triggerCFDeploy: (params: { siteId: string; repoUrl: string }) =>
    callWorkerAction('trigger-cf-deploy', params),

  convertWordPress: (params: { siteId: string; inputType: 'zip' | 'url'; data: string }) =>
    callWorkerAction('convert-wordpress', params),

  addDomain: (params: { domain: string; siteId?: string }) =>
    callWorkerAction('add-domain', params),

  checkDomainStatus: (domainId: string) =>
    callWorkerAction('check-domain-status', { domainId }),

  connectDomainToSite: (domainId: string, siteId: string) =>
    callWorkerAction('connect-domain-to-site', { domainId, siteId }),

  provisionVPS: (params: {
    siteId: string
    provider: 'aws' | 'vultr' | 'digitalocean'
    spec: 'basic' | 'standard' | 'high'
    siteName: string
    subdomain: string
  }) => callWorkerAction('provision-vps', params),

  manageVPS: (siteId: string, action: 'restart' | 'stop' | 'status' | 'backup') =>
    callWorkerAction('manage-vps', { siteId, action }),
}

// ─────────────────────────────────────────
// 타입 (로컬 참조용)
// ─────────────────────────────────────────

import type { Profile, Site, Domain, Product, Deployment, Invoice, AuditLog } from '@/types'
