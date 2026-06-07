import { actions, createAuditLog } from '@/lib/db'

// Cloudflare API 검증
export async function validateCloudflare(apiKey: string, email: string) {
  return actions.validateCloudflare(apiKey, email)
}

// GitHub 저장소 생성
export async function createGitHubRepo(params: {
  token: string
  repoName: string
  siteId: string
}) {
  return actions.createGitHubRepo(params)
}

// Cloudflare Pages 배포 트리거
export async function triggerCFDeploy(params: {
  siteId: string
  repoUrl: string
}) {
  return actions.triggerCFDeploy(params)
}

// WordPress PHP → Astro 변환
export async function convertWordPress(params: {
  siteId: string
  inputType: 'zip' | 'url'
  data: string
}) {
  return actions.convertWordPress(params)
}

// 도메인 추가
export async function addDomain(params: {
  domain: string
  siteId?: string
}) {
  return actions.addDomain(params)
}

// 도메인 상태 확인
export async function checkDomainStatus(params: { domainId: string }) {
  return actions.checkDomainStatus(params.domainId)
}

// 도메인-사이트 연결
export async function connectDomainToSite(params: {
  domainId: string
  siteId: string
}) {
  return actions.connectDomainToSite(params.domainId, params.siteId)
}

// VPS 프로비저닝
export async function provisionVPS(params: {
  siteId: string
  provider: 'aws' | 'vultr' | 'digitalocean'
  spec: 'basic' | 'standard' | 'high'
  siteName: string
  subdomain: string
}) {
  return actions.provisionVPS(params)
}

// VPS 관리
export async function manageVPS(params: {
  siteId: string
  action: 'restart' | 'stop' | 'status' | 'backup'
}) {
  return actions.manageVPS(params.siteId, params.action)
}

// AWS 자격증명 검증
export async function validateAWS(params: {
  accessKeyId: string
  secretAccessKey: string
  region: string
}) {
  return actions.validateAWS(params.accessKeyId, params.secretAccessKey, params.region)
}

// VPS 제공업체 API 검증
export async function validateVPSProvider(params: {
  provider: 'vultr' | 'digitalocean'
  apiKey: string
}) {
  return actions.validateVPSProvider(params.provider, params.apiKey)
}

// 관리자 감사 로그 기록
export async function logAuditAction(adminId: string, params: {
  action: string
  targetType?: string
  targetId?: string
}) {
  await createAuditLog(
    adminId,
    params.action,
    params.targetType ?? '',
    params.targetId ?? '',
  )
}
