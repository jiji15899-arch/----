// 저장 위치: /src/components/dashboard/Sidebar.tsx
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Cloud, LayoutDashboard, Globe2, PlusCircle, Globe, UserCircle,
  CreditCard, Shield, LogOut, ChevronLeft, Menu, X, Moon, Sun
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useToastStore } from '@/store/toastStore'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'

interface NavItem {
  label: string
  icon: React.ReactNode
  to: string
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: '대시보드', icon: <LayoutDashboard className="w-5 h-5" />, to: '/dashboard' },
  { label: '내 사이트', icon: <Globe2 className="w-5 h-5" />, to: '/sites' },
  { label: '사이트 만들기', icon: <PlusCircle className="w-5 h-5" />, to: '/create' },
  { label: '도메인 관리', icon: <Globe className="w-5 h-5" />, to: '/domains' },
  { label: '내 정보 관리', icon: <UserCircle className="w-5 h-5" />, to: '/profile' },
  { label: '결제 / 플랜', icon: <CreditCard className="w-5 h-5" />, to: '/billing' },
  { label: '관리자 패널', icon: <Shield className="w-5 h-5" />, to: '/admin', adminOnly: true },
]

interface SidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { profile, signOut } = useAuthStore()
  const { success } = useToastStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
  })

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [darkMode])

  const handleSignOut = async () => {
    await signOut()
    success('로그아웃', '로그아웃되었습니다.')
    navigate('/login')
  }

  const isActive = (to: string) => {
    if (to === '/dashboard') return location.pathname === '/dashboard'
    return location.pathname.startsWith(to)
  }

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || profile?.role === 'admin'
  )

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* 로고 */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-200 dark:border-slate-700">
        <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
          <Cloud className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-tight">클라우드프레스</div>
          <div className="text-[10px] text-slate-400 font-mono">CloudPress</div>
        </div>
        <button
          onClick={onMobileClose}
          className="ml-auto lg:hidden text-slate-400 hover:text-slate-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={onMobileClose}
            className={cn('sidebar-nav-item', isActive(item.to) && 'active')}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.adminOnly && (
              <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold bg-primary/10 text-primary rounded">
                관리자
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* 하단 영역 */}
      <div className="border-t border-slate-200 dark:border-slate-700 px-3 py-3 space-y-1">
        {/* 다크모드 토글 */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="sidebar-nav-item w-full"
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          <span>{darkMode ? '라이트 모드' : '다크 모드'}</span>
        </button>

        {/* 로그아웃 */}
        <button
          onClick={handleSignOut}
          className="sidebar-nav-item w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          <LogOut className="w-5 h-5" />
          <span>로그아웃</span>
        </button>
      </div>

      {/* 유저 프로필 */}
      <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <span className="text-primary text-sm font-semibold">
              {profile?.name?.[0] || '?'}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
            {profile?.name || '사용자'}
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            {profile?.role === 'admin' ? '관리자' : '일반 사용자'}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* 데스크탑 사이드바 */}
      <aside className="hidden lg:flex flex-col w-[260px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-screen sticky top-0 shadow-sidebar flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* 모바일 오버레이 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onMobileClose}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[260px] bg-white dark:bg-slate-900 shadow-2xl animate-slide-in">
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  )
}

// 모바일 헤더
export function MobileHeader({ onMenuOpen }: { onMenuOpen: () => void }) {
  return (
    <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
      <button
        onClick={onMenuOpen}
        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
      </button>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
          <Cloud className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-sm text-slate-800 dark:text-slate-100">클라우드프레스</span>
      </div>
    </div>
  )
}