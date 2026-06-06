// 저장 위치: /src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

// 데이터베이스 헬퍼 함수들

// 프로필 조회
export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error) throw error
  return data
}

// 프로필 업데이트
export async function updateProfile(userId: string, updates: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

// 내 사이트 목록
export async function getMySites(userId: string) {
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// 내 도메인 목록
export async function getMyDomains(userId: string) {
  const { data, error } = await supabase
    .from('domains')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// 상품 목록 (활성화된 것만)
export async function getActiveProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

// 모든 상품 (관리자용)
export async function getAllProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

// 상품 활성화/비활성화 토글 (관리자)
export async function toggleProductStatus(productId: string, isActive: boolean) {
  const { data, error } = await supabase
    .from('products')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .select()
    .single()
  if (error) throw error
  return data
}

// 사이트 생성
export async function createSite(siteData: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('sites')
    .insert(siteData)
    .select()
    .single()
  if (error) throw error
  return data
}

// 도메인 추가
export async function addDomain(domainData: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('domains')
    .insert(domainData)
    .select()
    .single()
  if (error) throw error
  return data
}

// 배포 기록 생성
export async function createDeployment(deploymentData: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('deployments')
    .insert(deploymentData)
    .select()
    .single()
  if (error) throw error
  return data
}

// 관리자 설정 조회
export async function getAdminSettings() {
  const { data, error } = await supabase
    .from('admin_settings')
    .select('*')
  if (error) throw error
  const settings: Record<string, string> = {}
  data?.forEach((item: { key: string; value: string }) => {
    settings[item.key] = item.value
  })
  return settings
}

// 관리자 설정 저장
export async function saveAdminSetting(key: string, value: string) {
  const { error } = await supabase
    .from('admin_settings')
    .upsert({ key, value }, { onConflict: 'key' })
  if (error) throw error
}

// 감사 로그 기록
export async function createAuditLog(adminId: string, action: string, targetType: string, targetId: string) {
  const { error } = await supabase
    .from('audit_logs')
    .insert({ admin_id: adminId, action, target_type: targetType, target_id: targetId })
  if (error) console.error('감사 로그 오류:', error)
}

// 전체 사용자 목록 (관리자)
export async function getAllUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// 전체 사이트 목록 (관리자)
export async function getAllSites() {
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// 전체 도메인 목록 (관리자)
export async function getAllDomains() {
  const { data, error } = await supabase
    .from('domains')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// 청구서 목록
export async function getInvoices(userId: string) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// 감사 로그 전체 (관리자)
export async function getAuditLogs() {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data || []
}