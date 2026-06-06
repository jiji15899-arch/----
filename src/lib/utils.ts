// 저장 위치: /src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 날짜 포맷
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffHour < 24) return `${diffHour}시간 전`
  if (diffDay < 30) return `${diffDay}일 전`
  return formatDateShort(dateStr)
}

// 상태 텍스트 변환
export function getSiteStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: '운영중',
    building: '빌드중',
    error: '오류',
    idle: '대기',
  }
  return labels[status] || status
}

// 호스팅 유형 텍스트
export function getHostingTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    cloudflare: 'Cloudflare',
    vps: 'VPS',
  }
  return labels[type] || type
}

// VPS 제공자 레이블
export function getVPSProviderLabel(provider: string): string {
  const labels: Record<string, string> = {
    aws: 'AWS EC2',
    vultr: 'Vultr',
    digitalocean: 'DigitalOcean',
  }
  return labels[provider] || provider
}

// 서브도메인 유효성 검사
export function isValidSubdomain(subdomain: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)
}

// 도메인 유효성 검사
export function isValidDomain(domain: string): boolean {
  return /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/.test(domain)
}

// API 키 마스킹
export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '••••••••'
  return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4)
}

// 파일 크기 포맷
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

// 클립보드 복사
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    return true
  }
}

// 랜덤 서브도메인 생성
export function generateSubdomain(siteName: string): string {
  const base = siteName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30)
  const suffix = Math.random().toString(36).substring(2, 6)
  return `${base}-${suffix}`
}

// 임시 비밀번호 생성
export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#'
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// 숫자 포맷
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n)
}

// 가격 포맷
export function formatPrice(usd: number): string {
  return `$${usd.toFixed(0)}`
}