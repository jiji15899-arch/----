/**
 * src/lib/domainRouter.ts
 * 서브도메인 감지 및 리다이렉트 유틸리티
 *
 * 규칙:
 *   랜딩   → cloud-press.co.kr  (www. 포함)
 *   콘솔   → console.cloud-press.co.kr
 *   어드민 → adm-console.cloud-press.co.kr
 *   SSO    → sso.cloud-press.co.kr
 *
 * 로컬 개발(localhost)에서는 path prefix로 시뮬레이션:
 *   /console/** → 콘솔 앱
 *   /adm/**     → 어드민 앱
 *   /sso/**     → SSO 앱
 *   그 외        → 랜딩 앱
 */

export type AppZone = 'landing' | 'console' | 'admin' | 'sso'

const BASE_DOMAIN = 'cloud-press.co.kr'

/** 현재 호스트명에서 앱 영역을 판단한다 */
export function detectZone(): AppZone {
  const host = window.location.hostname

  // 프로덕션 서브도메인 판별
  if (host === `adm-console.${BASE_DOMAIN}`) return 'admin'
  if (host === `console.${BASE_DOMAIN}`)     return 'console'
  if (host === `sso.${BASE_DOMAIN}`)         return 'sso'
  if (host === BASE_DOMAIN || host === `www.${BASE_DOMAIN}`) return 'landing'

  // 로컬 / 미리보기 환경: path prefix로 구분
  const path = window.location.pathname
  if (path.startsWith('/adm'))     return 'admin'
  if (path.startsWith('/console')) return 'console'
  if (path.startsWith('/sso'))     return 'sso'

  return 'landing'
}

/** 프로덕션 환경인지 여부 */
export function isProd(): boolean {
  return window.location.hostname.endsWith(BASE_DOMAIN)
}

/**
 * 대상 영역의 origin을 반환한다.
 * 로컬에서는 같은 origin + path prefix를 사용.
 */
export function zoneOrigin(zone: AppZone): string {
  if (isProd()) {
    const subMap: Record<AppZone, string> = {
      landing: `https://${BASE_DOMAIN}`,
      console: `https://console.${BASE_DOMAIN}`,
      admin:   `https://adm-console.${BASE_DOMAIN}`,
      sso:     `https://sso.${BASE_DOMAIN}`,
    }
    return subMap[zone]
  }
  // 로컬: 같은 host, path prefix 로 구분
  return window.location.origin
}

/** 로컬 환경에서 path prefix를 앞에 붙여준다 */
export function localPrefix(zone: AppZone): string {
  const prefixMap: Record<AppZone, string> = {
    landing: '',
    console: '/console',
    admin:   '/adm',
    sso:     '/sso',
  }
  return isProd() ? '' : prefixMap[zone]
}

/**
 * 현재 페이지가 잘못된 영역에 있으면 올바른 도메인으로 이동시킨다.
 *
 * 예) console.cloud-press.co.kr 에서 /login 접근
 *     → sso.cloud-press.co.kr/login 으로 이동
 *
 * 예) cloud-press.co.kr 에서 /dashboard 접근
 *     → console.cloud-press.co.kr/dashboard 로 이동
 */
export function enforceZone(expectedZone: AppZone): boolean {
  const currentZone = detectZone()
  if (currentZone === expectedZone) return false // 이미 맞는 도메인

  const path    = window.location.pathname
  const search  = window.location.search
  const origin  = zoneOrigin(expectedZone)
  const prefix  = localPrefix(expectedZone)

  window.location.replace(`${origin}${prefix}${path}${search}`)
  return true
}

/**
 * 잘못된 경로로 접근 시 올바른 존으로 리다이렉트하는 규칙 테이블.
 * App.tsx 에서 라우트 렌더 직전에 평가한다.
 *
 * path 패턴(prefix match) → 이동해야 할 zone
 */
export const PATH_ZONE_RULES: Array<{ prefix: string; zone: AppZone }> = [
  // 대시보드/콘솔 경로 → console 존
  { prefix: '/dashboard', zone: 'console' },
  { prefix: '/sites',     zone: 'console' },
  { prefix: '/create',    zone: 'console' },
  { prefix: '/domains',   zone: 'console' },
  { prefix: '/profile',   zone: 'console' },
  { prefix: '/billing',   zone: 'console' },

  // 어드민 경로 → admin 존
  { prefix: '/admin',     zone: 'admin' },

  // 로그인/회원가입 → sso 존
  { prefix: '/login',     zone: 'sso' },
  { prefix: '/signup',    zone: 'sso' },
  { prefix: '/reset',     zone: 'sso' },

  // 랜딩 경로 → landing 존
  { prefix: '/features',  zone: 'landing' },
  { prefix: '/about',     zone: 'landing' },
  { prefix: '/faq',       zone: 'landing' },
  { prefix: '/products',  zone: 'landing' },
  { prefix: '/pricing',   zone: 'landing' },
]

/**
 * 현재 pathname 이 어느 zone 에 속하는지 규칙 테이블로 판별.
 * 매칭되지 않으면 null 반환.
 */
export function resolvePathZone(pathname: string): AppZone | null {
  for (const rule of PATH_ZONE_RULES) {
    if (pathname === rule.prefix || pathname.startsWith(rule.prefix + '/')) {
      return rule.zone
    }
  }
  return null
}
