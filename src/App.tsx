// 저장 위치: /src/App.tsx
// 서브도메인 기반 앱 분기 라우터
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { detectZone, resolvePathZone, zoneOrigin, isProd, localPrefix } from '@/lib/domainRouter'
import type { AppZone } from '@/lib/domainRouter'

// 레이아웃
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'

// 콘솔 페이지
import { AuthPage }       from '@/pages/AuthPage'
import { DashboardPage }  from '@/pages/DashboardPage'
import { SitesPage }      from '@/pages/SitesPage'
import { SiteDetailPage } from '@/pages/SiteDetailPage'
import { CreateSitePage } from '@/pages/CreateSitePage'
import { DomainsPage }    from '@/pages/DomainsPage'
import { ProfilePage }    from '@/pages/ProfilePage'
import { BillingPage }    from '@/pages/BillingPage'
import { AdminPage }      from '@/pages/AdminPage'

// 마법사
import { WordPressCFWizard }  from '@/pages/wizard/WordPressCFWizard'
import { WordPressVPSWizard } from '@/pages/wizard/WordPressVPSWizard'
import { GenericSiteWizard }  from '@/pages/wizard/GenericSiteWizard'

// 랜딩 페이지
import { LandingLayout }   from '@/pages/landing/LandingLayout'
import { IndexPage }       from '@/pages/landing/IndexPage'
import { FeaturesPage }    from '@/pages/landing/FeaturesPage'
import { AboutPage }       from '@/pages/landing/AboutPage'
import { FaqPage }         from '@/pages/landing/FaqPage'
import { ProductsPage }    from '@/pages/landing/ProductsPage'
import { PricingPage }     from '@/pages/landing/PricingPage'

import { LoadingPage } from '@/components/ui/Spinner'

// ────────────────────────────────────────
// 보호 라우트
// ────────────────────────────────────────
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()
  if (loading) return <LoadingPage />
  if (!user)   return <Navigate to={buildSSOUrl('/login')} replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuthStore()
  if (loading) return <LoadingPage />
  if (profile?.role !== 'admin') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

// ────────────────────────────────────────
// 존 간 URL 빌더 헬퍼
// ────────────────────────────────────────
function buildURL(zone: AppZone, path: string): string {
  return `${zoneOrigin(zone)}${isProd() ? '' : localPrefix(zone)}${path}`
}
function buildSSOUrl(path: string)     { return buildURL('sso', path) }
function buildConsoleUrl(path: string) { return buildURL('console', path) }

// ────────────────────────────────────────
// 크로스-존 리다이렉트 가드
// path → 올바른 존 아니면 redirect
// ────────────────────────────────────────
function CrossZoneGuard() {
  const location = useLocation()
  const currentZone = detectZone()
  const targetZone  = resolvePathZone(location.pathname)

  if (targetZone && targetZone !== currentZone) {
    const url = buildURL(targetZone, location.pathname + location.search)
    window.location.replace(url)
    return <LoadingPage />
  }
  return null
}

// ────────────────────────────────────────
// 랜딩 존 앱  (cloud-press.co.kr)
// ────────────────────────────────────────
function LandingApp() {
  return (
    <Routes>
      <Route element={<LandingLayout />}>
        <Route index         element={<IndexPage />} />
        <Route path="features" element={<FeaturesPage />} />
        <Route path="about"    element={<AboutPage />} />
        <Route path="faq"      element={<FaqPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="pricing"  element={<PricingPage />} />
      </Route>
      {/* 잘못된 경로는 홈으로 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

// ────────────────────────────────────────
// SSO 존 앱  (sso.cloud-press.co.kr)
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
// 콘솔 존 앱  (console.cloud-press.co.kr)
// ────────────────────────────────────────
function ConsoleApp() {
  const { initialize, loading } = useAuthStore()
  useEffect(() => { initialize() }, [initialize])
  if (loading) return <LoadingPage />

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
        <Route path="/dashboard"              element={<DashboardPage />} />
        <Route path="/sites"                  element={<SitesPage />} />
        <Route path="/sites/:siteId"          element={<SiteDetailPage />} />
        <Route path="/create"                 element={<CreateSitePage />} />
        <Route path="/create/wordpress_cf"    element={<WordPressCFWizard />} />
        <Route path="/create/wordpress_vps"   element={<WordPressVPSWizard />} />
        <Route path="/create/:productId"      element={<GenericSiteWizard />} />
        <Route path="/domains"                element={<DomainsPage />} />
        <Route path="/profile"                element={<ProfilePage />} />
        <Route path="/billing"                element={<BillingPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

// ────────────────────────────────────────
// 어드민 존 앱  (adm-console.cloud-press.co.kr)
// ────────────────────────────────────────
function AdminApp() {
  const { initialize, loading } = useAuthStore()
  useEffect(() => { initialize() }, [initialize])
  if (loading) return <LoadingPage />

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route
        path="/admin"
        element={
          <PrivateRoute>
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}

// ────────────────────────────────────────
// 루트 — 존 감지 후 분기
// ────────────────────────────────────────
export default function App() {
  const zone = detectZone()

  return (
    <BrowserRouter>
      {/* 크로스-존 리다이렉트 감시 (모든 존 공통) */}
      <CrossZoneGuard />

      {zone === 'landing' && <LandingApp />}
      {zone === 'console' && <ConsoleApp />}
      {zone === 'admin'   && <AdminApp />}
      {zone === 'sso'     && <SSOApp />}
    </BrowserRouter>
  )
}
