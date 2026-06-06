// 저장 위치: /src/App.tsx
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

// 레이아웃
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'

// 페이지
import { AuthPage } from '@/pages/AuthPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { SitesPage } from '@/pages/SitesPage'
import { SiteDetailPage } from '@/pages/SiteDetailPage'
import { CreateSitePage } from '@/pages/CreateSitePage'
import { DomainsPage } from '@/pages/DomainsPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { BillingPage } from '@/pages/BillingPage'
import { AdminPage } from '@/pages/AdminPage'

// 마법사
import { WordPressCFWizard } from '@/pages/wizard/WordPressCFWizard'
import { WordPressVPSWizard } from '@/pages/wizard/WordPressVPSWizard'
import { GenericSiteWizard } from '@/pages/wizard/GenericSiteWizard'

// 로딩
import { LoadingPage } from '@/components/ui/Spinner'

// 관리자 전용 라우트
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuthStore()
  if (loading) return <LoadingPage />
  if (profile?.role !== 'admin') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  const { initialize, loading } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  if (loading) return <LoadingPage />

  return (
    <BrowserRouter>
      <Routes>
        {/* 공개 라우트 */}
        <Route path="/login" element={<AuthPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* 인증 필요 라우트 */}
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/sites" element={<SitesPage />} />
          <Route path="/sites/:siteId" element={<SiteDetailPage />} />
          <Route path="/create" element={<CreateSitePage />} />
          <Route path="/create/wordpress_cf" element={<WordPressCFWizard />} />
          <Route path="/create/wordpress_vps" element={<WordPressVPSWizard />} />
          <Route path="/create/:productId" element={<GenericSiteWizard />} />
          <Route path="/domains" element={<DomainsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}