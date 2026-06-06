import { supabase } from './supabase'

// Supabase Edge Function 호출 헬퍼
export async function callEdgeFunction<T = unknown>(
  functionName: string,
  body?: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
  })
  if (error) throw error
  return data as T
}

// Cloudflare API 검증
export async function validateCloudflare(apiKey: string, email: string) {
  return callEdgeFunction('validate-cloudflare', { apiKey, email })
}

// GitHub 저장소 생성
export async function createGitHubRepo(params: {
  token: string
  repoName: string
  siteId: string
}) {
  return callEdgeFunction('create-github-repo', params)
}

// Cloudflare Pages 배포 트리거
export async function triggerCFDeploy(params: {
  siteId: string
  repoUrl: string
}) {
  return callEdgeFunction('trigger-cf-deploy', params)
}

// WordPress PHP → Astro 변환
export async function convertWordPress(params: {
  siteId: string
  inputType: 'zip' | 'url'
  data: string
}) {
  return callEdgeFunction('convert-wordpress', params)
}

// 도메인 추가
export async function addDomain(params: {
  domain: string
  siteId?: string
}) {
  return callEdgeFunction('add-domain', params)
}

// 도메인 상태 확인
export async function checkDomainStatus(params: { domainId: string }) {
  return callEdgeFunction('check-domain-status', params)
}

// 도메인-사이트 연결
export async function connectDomainToSite(params: {
  domainId: string
  siteId: string
}) {
  return callEdgeFunction('connect-domain-to-site', params)
}

// VPS 프로비저닝 (AWS/Vultr/DigitalOcean)
export async function provisionVPS(params: {
  siteId: string
  provider: 'aws' | 'vultr' | 'digitalocean'
  spec: 'basic' | 'standard' | 'high'
  siteName: string
  subdomain: string
}) {
  return callEdgeFunction('provision-vps', params)
}

// VPS 관리 (재시작/중지/상태)
export async function manageVPS(params: {
  siteId: string
  action: 'restart' | 'stop' | 'status' | 'backup'
}) {
  return callEdgeFunction('manage-vps', params)
}

// AWS 자격증명 검증
export async function validateAWS(params: {
  accessKeyId: string
  secretAccessKey: string
  region: string
}) {
  return callEdgeFunction('validate-aws', params)
}

// VPS 제공업체 API 검증 (Vultr/DigitalOcean)
export async function validateVPSProvider(params: {
  provider: 'vultr' | 'digitalocean'
  apiKey: string
}) {
  return callEdgeFunction('validate-vps-provider', params)
}

// 관리자 감사 로그 기록
export async function logAuditAction(params: {
  action: string
  targetType?: string
  targetId?: string
}) {
  const { error } = await supabase.from('audit_logs').insert({
    admin_id: (await supabase.auth.getUser()).data.user?.id,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId,
  })
  if (error) console.error('감사 로그 기록 실패:', error)
}