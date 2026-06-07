// 저장 위치: /src/App.tsx
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { detectZone, resolvePathZone, zoneOrigin, isProd, localPrefix } from '@/lib/domainRouter'
import type { AppZone } from '@/lib/domainRouter'

import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { AuthPage }       from '@/pages/AuthPage'
import { DashboardPage }  from '@/pages/DashboardPage'
import { SitesPage }      from '@/pages/SitesPage'
import { SiteDetailPage } from '@/pages/SiteDetailPage'
import { CreateSitePage } from '@/pages/CreateSitePage'
import { DomainsPage }    from '@/pages/DomainsPage'
import { ProfilePage }    from '@/pages/ProfilePage'
import { BillingPage }    from '@/pages/BillingPage'
import { AdminPage }      from '@/pages/AdminPage'
import { WordPressCFWizard }  from '@/pages/wizard/WordPressCFWizard'
import { WordPressVPSWizard } from '@/pages/wizard/WordPressVPSWizard'
import { GenericSiteWizard }  from '@/pages/wizard/GenericSiteWizard'
import { LandingLayout }   from '@/pages/landing/LandingLayout'
import { IndexPage }       from '@/pages/landing/IndexPage'
import { FeaturesPage }    from '@/pages/landing/FeaturesPage'
import { AboutPage }       from '@/pages/landing/AboutPage'
import { FaqPage }         from '@/pages/landing/FAQPage'
import { ProductsPage }    from '@/pages/landing/ProductsPage'
import { LoadingPage } from '@/components/ui/Spinner'

// ────────────────────────────────────────
// 존 간 URL 빌더
// ────────────────────────────────────────
function buildURL(zone: AppZone, path: string): string {
  return `${zoneOrigin(zone)}${isProd() ? '' : localPrefix(zone)}${path}`
}
function buildSSOUrl(path: string) { return buildURL('sso', path) }

// cross-origin redirect
function redirectTo(url: string): null {
  window.location.replace(url)
  return null
}

// ────────────────────────────────────────
// sso → console 토큰 수신 처리
// console 도메인 진입 시 URL 파라미터에 cp_token/cp_user 있으면 localStorage에 저장
// ────────────────────────────────────────
function useConsumeAuthParams() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('cp_token')
    const userStr = params.get('cp_user')
    if (token && userStr) {
      try {
        const user = JSON.parse(decodeURIComponent(userStr))
        localStorage.setItem('cp_token', token)
        localStorage.setItem('cp_user', JSON.stringify(user))
      } catch { /* 무시 */ }
      // URL에서 파라미터 제거
      const clean = window.location.pathname
      window.history.replaceState({}, '', clean)
    }
  }, [])
}

// ────────────────────────────────────────
// 보호 라우트
// ────────────────────────────────────────
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, initialized } = useAuthStore()
  if (loading || !initialized) return <LoadingPage />
  if (!user) return redirectTo(buildSSOUrl('/login'))
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, initialized } = useAuthStore()
  if (loading || !initialized) return <LoadingPage />
  if (!user) return redirectTo(buildSSOUrl('/login'))
  if (profile?.role !== 'admin') {
    window.location.replace(buildURL('console', '/dashboard'))
    return null
  }
  return <>{children}</>
}

// ────────────────────────────────────────
// 크로스-존 가드
// ────────────────────────────────────────
function CrossZoneGuard() {
  const location = useLocation()
  const currentZone = detectZone()
  const targetZone  = resolvePathZone(location.pathname)
  if (targetZone && targetZone !== currentZone) {
    window.location.replace(buildURL(targetZone, location.pathname + location.search))
    return <LoadingPage />
  }
  return null
}

// ────────────────────────────────────────
// 랜딩
// ────────────────────────────────────────
function LandingApp() {
  return (
    <Routes>
      <Route element={<LandingLayout />}>
        <Route index          element={<IndexPage />} />
        <Route path="features" element={<FeaturesPage />} />
        <Route path="about"    element={<AboutPage />} />
        <Route path="faq"      element={<FaqPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="pricing"  element={<ProductsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

// ────────────────────────────────────────
// SSO
// ────────────────────────────────────────
function SSOApp() {
  return (
    <Routes>
      <Route path="/login"  element={<AuthPage />} />
      <Route path="/signup" element={<AuthPage />} />
      <Route path="/"       element={<Navigate to="/login" replace />} />
      <Route path="*"       element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

// ────────────────────────────────────────
// 콘솔
// ────────────────────────────────────────
function ConsoleApp() {
  // 1) sso에서 넘어온 토큰 파라미터를 localStorage에 저장 (initialize 전에 실행)
  useConsumeAuthParams()

  const { initialize, loading, initialized } = useAuthStore()
  useEffect(() => {
    if (!initialized) initialize()
  }, [initialize, initialized])

  if (loading || !initialized) return <LoadingPage />

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
        <Route path="/dashboard"           element={<DashboardPage />} />
        <Route path="/sites"               element={<SitesPage />} />
        <Route path="/sites/:siteId"       element={<SiteDetailPage />} />
        <Route path="/create"              element={<CreateSitePage />} />
        <Route path="/create/wordpress_cf" element={<WordPressCFWizard />} />
        <Route path="/create/wordpress_vps" element={<WordPressVPSWizard />} />
        <Route path="/create/:productId"   element={<GenericSiteWizard />} />
        <Route path="/domains"             element={<DomainsPage />} />
        <Route path="/profile"             element={<ProfilePage />} />
        <Route path="/billing"             element={<BillingPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

// ────────────────────────────────────────
// 어드민
// ────────────────────────────────────────
function AdminApp() {
  useConsumeAuthParams()

  const { initialize, loading, initialized } = useAuthStore()
  useEffect(() => {
    if (!initialized) initialize()
  }, [initialize, initialized])

  if (loading || !initialized) return <LoadingPage />

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}

// ────────────────────────────────────────
// 루트
// ────────────────────────────────────────
export default function App() {
  const zone = detectZone()
  return (
    <BrowserRouter>
      <CrossZoneGuard />
      {zone === 'landing' && <LandingApp />}
      {zone === 'console' && <ConsoleApp />}
      {zone === 'admin'   && <AdminApp />}
      {zone === 'sso'     && <SSOApp />}
    </BrowserRouter>
  )
}
