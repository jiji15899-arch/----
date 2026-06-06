// 저장 위치: /src/components/dashboard/DashboardLayout.tsx
import { useState, useEffect } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { Sidebar, MobileHeader } from './Sidebar'
import { useAuthStore } from '@/store/authStore'
import { LoadingPage } from '@/components/ui/Spinner'
import { ToastContainer } from '@/components/ui/Toast'

export function DashboardLayout() {
  const { user, loading } = useAuthStore()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    document.title = '클라우드프레스(CloudPress)'
  }, [])

  if (loading) return <LoadingPage />
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileHeader onMenuOpen={() => setMobileOpen(true)} />

        {/* 메인 콘텐츠 */}
        <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  )
}