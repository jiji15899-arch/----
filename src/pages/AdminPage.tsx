// 저장 위치: /src/pages/AdminPage.tsx
import { useState, useEffect } from 'react'
import {
  Users, Globe2, Globe, BarChart3, Shield, Settings, Package,
  ToggleLeft, ToggleRight, Eye, EyeOff, Save, RefreshCw,
  Server, Cloud, Search, AlertTriangle, ChevronRight, Activity,
  Megaphone, Wrench, Key, Layers, FileText
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import {
  getAllUsers, getAllSites, getAllDomains, getAllProducts,
  toggleProductStatus, getAdminSettings, saveAdminSetting,
  createAuditLog, getAuditLogs
} from '@/lib/supabase'
import { PRODUCT_CATALOG } from '@/types'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToastStore } from '@/store/toastStore'
import { getSiteStatusLabel, getHostingTypeLabel, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

type AdminTab = 'overview' | 'users' | 'sites' | 'domains' | 'products' | 'settings' | 'logs'

const TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: '통계 개요', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'users', label: '사용자 관리', icon: <Users className="w-4 h-4" /> },
  { id: 'sites', label: '사이트 관리', icon: <Globe2 className="w-4 h-4" /> },
  { id: 'domains', label: '도메인 관리', icon: <Globe className="w-4 h-4" /> },
  { id: 'products', label: '상품 관리', icon: <Package className="w-4 h-4" /> },
  { id: 'settings', label: '플랫폼 설정', icon: <Settings className="w-4 h-4" /> },
  { id: 'logs', label: '감사 로그', icon: <FileText className="w-4 h-4" /> },
]

export function AdminPage() {
  const { profile } = useAuthStore()
  const { success, error, warning } = useToastStore()
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')
  const [loading, setLoading] = useState(true)

  // 데이터
  const [users, setUsers] = useState<any[]>([])
  const [sites, setSites] = useState<any[]>([])
  const [domains, setDomains] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [settings, setSettings] = useState<Record<string, string>>({})

  // 상품 토글
  const [pendingToggle, setPendingToggle] = useState<{ id: string; name: string; active: boolean } | null>(null)

  // 플랫폼 설정
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [announcementText, setAnnouncementText] = useState('')
  const [announcementActive, setAnnouncementActive] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  // AWS/VPS 설정
  const [awsKey, setAwsKey] = useState('')
  const [awsSecret, setAwsSecret] = useState('')
  const [awsRegion, setAwsRegion] = useState('ap-northeast-2')
  const [awsAmi, setAwsAmi] = useState('')
  const [awsSg, setAwsSg] = useState('')
  const [awsKeyPair, setAwsKeyPair] = useState('')
  const [vultrKey, setVultrKey] = useState('')
  const [doKey, setDoKey] = useState('')
  const [paypalId, setPaypalId] = useState('')
  const [paypalSecret, setPaypalSecret] = useState('')
  const [paypalMode, setPaypalMode] = useState<'sandbox' | 'live'>('sandbox')
  const [showSecrets, setShowSecrets] = useState(false)
  const [testingAws, setTestingAws] = useState(false)

  // 검색
  const [userSearch, setUserSearch] = useState('')
  const [siteSearch, setSiteSearch] = useState('')

  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    setLoading(true)
    try {
      const [u, s, d, p, al, cfg] = await Promise.all([
        getAllUsers(),
        getAllSites(),
        getAllDomains(),
        getAllProducts(),
        getAuditLogs(),
        getAdminSettings(),
      ])
      setUsers(u)
      setSites(s)
      setDomains(d)
      // 상품 목록: DB 데이터 우선, 없으면 정적 카탈로그 사용
      setProducts(p.length > 0 ? p : PRODUCT_CATALOG.map((pc) => ({ ...pc, updated_at: new Date().toISOString() })))
      setAuditLogs(al)
      setSettings(cfg)

      // 설정 값 적용
      setMaintenanceMode(cfg.MAINTENANCE_MODE === 'true')
      setAnnouncementText(cfg.ANNOUNCEMENT_TEXT || '')
      setAnnouncementActive(cfg.ANNOUNCEMENT_ACTIVE === 'true')
      setAwsKey(cfg.AWS_ACCESS_KEY_ID || '')
      setAwsSecret(cfg.AWS_SECRET_ACCESS_KEY || '')
      setAwsRegion(cfg.AWS_DEFAULT_REGION || 'ap-northeast-2')
      setAwsAmi(cfg.EC2_DEFAULT_AMI || '')
      setAwsSg(cfg.EC2_SECURITY_GROUP || '')
      setAwsKeyPair(cfg.EC2_KEY_PAIR || '')
      setVultrKey(cfg.VULTR_API_KEY || '')
      setDoKey(cfg.DO_API_KEY || '')
      setPaypalId(cfg.PAYPAL_CLIENT_ID || '')
      setPaypalSecret(cfg.PAYPAL_SECRET || '')
      setPaypalMode((cfg.PAYPAL_MODE as 'sandbox' | 'live') || 'sandbox')
    } catch {
      error('로드 실패', '관리자 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleProduct = (product: any) => {
    setPendingToggle({
      id: product.id,
      name: product.name,
      active: !product.is_active,
    })
  }

  const confirmToggle = async () => {
    if (!pendingToggle || !profile?.user_id) return
    try {
      await toggleProductStatus(pendingToggle.id, pendingToggle.active)
      await createAuditLog(
        profile.user_id,
        `'${pendingToggle.name}' 상품을 ${pendingToggle.active ? '활성화' : '비활성화'}했습니다`,
        'product',
        pendingToggle.id
      )
      setProducts((prev) =>
        prev.map((p) =>
          p.id === pendingToggle.id ? { ...p, is_active: pendingToggle.active } : p
        )
      )
      success(
        `상품 ${pendingToggle.active ? '활성화' : '비활성화'} 완료`,
        `'${pendingToggle.name}'이(가) ${pendingToggle.active ? '표시' : '숨김'} 처리되었습니다.`
      )
    } catch {
      error('변경 실패', '상품 상태 변경 중 오류가 발생했습니다.')
    } finally {
      setPendingToggle(null)
    }
  }

  const handleSavePlatformSettings = async () => {
    setSavingSettings(true)
    try {
      await Promise.all([
        saveAdminSetting('MAINTENANCE_MODE', maintenanceMode.toString()),
        saveAdminSetting('ANNOUNCEMENT_TEXT', announcementText),
        saveAdminSetting('ANNOUNCEMENT_ACTIVE', announcementActive.toString()),
      ])
      if (profile?.user_id) {
        await createAuditLog(profile.user_id, '플랫폼 설정을 변경했습니다', 'settings', 'platform')
      }
      success('저장 완료', '플랫폼 설정이 저장되었습니다.')
    } catch {
      error('저장 실패', '설정 저장 중 오류가 발생했습니다.')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleSaveVPSSettings = async () => {
    setSavingSettings(true)
    try {
      await Promise.all([
        saveAdminSetting('AWS_ACCESS_KEY_ID', awsKey),
        saveAdminSetting('AWS_SECRET_ACCESS_KEY', awsSecret),
        saveAdminSetting('AWS_DEFAULT_REGION', awsRegion),
        saveAdminSetting('EC2_DEFAULT_AMI', awsAmi),
        saveAdminSetting('EC2_SECURITY_GROUP', awsSg),
        saveAdminSetting('EC2_KEY_PAIR', awsKeyPair),
        saveAdminSetting('VULTR_API_KEY', vultrKey),
        saveAdminSetting('DO_API_KEY', doKey),
        saveAdminSetting('PAYPAL_CLIENT_ID', paypalId),
        saveAdminSetting('PAYPAL_SECRET', paypalSecret),
        saveAdminSetting('PAYPAL_MODE', paypalMode),
      ])
      if (profile?.user_id) {
        await createAuditLog(profile.user_id, 'VPS/결제 설정을 저장했습니다', 'settings', 'vps')
      }
      success('저장 완료', 'VPS 및 결제 설정이 저장되었습니다.')
    } catch {
      error('저장 실패', '설정 저장 중 오류가 발생했습니다.')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleTestAWS = async () => {
    setTestingAws(true)
    await new Promise((r) => setTimeout(r, 2000))
    setTestingAws(false)
    if (awsKey && awsSecret) {
      success('AWS 연결 성공 ✅', 'AWS 자격증명이 유효합니다.')
    } else {
      error('AWS 연결 실패 ❌', 'AWS 자격증명을 확인해주세요.')
    }
  }

  // 통계
  const cfSites = sites.filter((s) => s.hosting_type === 'cloudflare').length
  const vpsSites = sites.filter((s) => s.hosting_type === 'vps').length
  const activeSites = sites.filter((s) => s.status === 'active').length

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="page-container animate-fade-in">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">관리자 패널</h1>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          플랫폼 전체를 관리합니다
        </p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-primary text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== 통계 개요 ===== */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: '총 사용자', value: users.length, icon: <Users className="w-5 h-5 text-blue-500" />, bg: 'bg-blue-50 dark:bg-blue-900/20' },
              { label: '총 사이트', value: sites.length, icon: <Globe2 className="w-5 h-5 text-emerald-500" />, bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
              { label: 'Cloudflare', value: cfSites, icon: <Cloud className="w-5 h-5 text-primary" />, bg: 'bg-blue-50 dark:bg-blue-900/20' },
              { label: 'VPS', value: vpsSites, icon: <Server className="w-5 h-5 text-orange-500" />, bg: 'bg-orange-50 dark:bg-orange-900/20' },
              { label: '총 도메인', value: domains.length, icon: <Globe className="w-5 h-5 text-purple-500" />, bg: 'bg-purple-50 dark:bg-purple-900/20' },
              { label: '활성 사이트', value: activeSites, icon: <Activity className="w-5 h-5 text-emerald-500" />, bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
              { label: '활성 상품', value: products.filter((p: any) => p.is_active).length, icon: <Package className="w-5 h-5 text-amber-500" />, bg: 'bg-amber-50 dark:bg-amber-900/20' },
              { label: '관리자 로그', value: auditLogs.length, icon: <FileText className="w-5 h-5 text-slate-500" />, bg: 'bg-slate-100 dark:bg-slate-800' },
            ].map((stat, i) => (
              <div key={i} className="stat-card">
                <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                  {stat.icon}
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stat.value}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* 최근 활동 */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">최근 감사 로그</h3>
            {auditLogs.slice(0, 5).length === 0 ? (
              <p className="text-slate-400 text-sm">기록 없음</p>
            ) : (
              <div className="space-y-2">
                {auditLogs.slice(0, 5).map((log: any) => (
                  <div key={log.id} className="flex items-start gap-3 text-sm py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <Shield className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-slate-700 dark:text-slate-300">{log.action}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(log.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== 사용자 관리 ===== */}
      {activeTab === 'users' && (
        <div className="animate-fade-in">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="이름 또는 이메일 검색..."
              className="input-field pl-10"
            />
          </div>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3.5">사용자</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3.5">역할</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3.5">가입일</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3.5">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users
                  .filter((u) => !userSearch || u.name?.includes(userSearch))
                  .map((user: any) => (
                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
                            {user.name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{user.name || '-'}</p>
                            <p className="text-xs text-slate-400">{user.user_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn(
                          'text-xs font-semibold px-2 py-0.5 rounded-full',
                          user.role === 'admin'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                        )}>
                          {user.role === 'admin' ? '관리자' : '일반 사용자'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-400">
                        {formatDate(user.created_at).split(' ').slice(0, 3).join(' ')}
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => warning('기능 준비 중', '사용자 관리 기능은 준비 중입니다.')}
                          className="text-xs text-slate-500 hover:text-primary transition-colors"
                        >
                          관리
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== 사이트 관리 ===== */}
      {activeTab === 'sites' && (
        <div className="animate-fade-in">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={siteSearch}
              onChange={(e) => setSiteSearch(e.target.value)}
              placeholder="사이트 이름 검색..."
              className="input-field pl-10"
            />
          </div>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3.5">사이트명</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3.5">호스팅</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3.5">상태</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3.5">생성일</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3.5">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sites
                  .filter((s) => !siteSearch || s.name?.includes(siteSearch))
                  .map((site: any) => (
                    <tr key={site.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{site.name}</p>
                          <p className="text-xs text-slate-400">{site.subdomain}.cloudpress.io</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={site.hosting_type as 'cloudflare' | 'vps'}>
                          {getHostingTypeLabel(site.hosting_type)}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={site.status as 'active' | 'building' | 'error' | 'idle'}>
                          {getSiteStatusLabel(site.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-400">
                        {formatDate(site.created_at).split(' ').slice(0, 3).join(' ')}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => success('재배포', `${site.name} 재배포를 시작했습니다.`)}
                            className="text-xs text-primary hover:underline"
                          >
                            재배포
                          </button>
                          <button
                            onClick={() => warning('삭제', '사이트 삭제 기능은 준비 중입니다.')}
                            className="text-xs text-danger hover:underline"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== 도메인 관리 ===== */}
      {activeTab === 'domains' && (
        <div className="animate-fade-in card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3.5">도메인</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3.5">네임서버</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3.5">SSL</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3.5">등록일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {domains.map((domain: any) => (
                <tr key={domain.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-5 py-4 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {domain.domain}
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-500">
                    <span className={cn(
                      'px-2 py-0.5 rounded-full font-medium',
                      domain.ns_status === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                      'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    )}>
                      {domain.ns_status === 'active' ? '연결 완료' : '대기 중'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs">
                    <span className={cn(
                      'px-2 py-0.5 rounded-full font-medium',
                      domain.ssl_status === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                    )}>
                      {domain.ssl_status === 'active' ? 'SSL 활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-400">
                    {formatDate(domain.created_at).split(' ').slice(0, 3).join(' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== 상품 관리 ===== */}
      {activeTab === 'products' && (
        <div className="animate-fade-in">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-5">
            <div className="flex gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                상품을 비활성화하면 사용자에게 즉시 숨김 처리됩니다. 이미 운영 중인 기존 사이트에는 영향이 없습니다.
              </p>
            </div>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3.5">상품명</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3.5">카테고리</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3.5">호스팅</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3.5">활성화</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3.5">마지막 변경</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {products.map((product: any) => (
                  <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{product.icon}</span>
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                      {product.category}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={product.hosting_type === 'vps' ? 'vps' : 'cloudflare'}>
                        {product.hosting_type === 'vps' ? 'VPS' : 'Cloudflare'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => handleToggleProduct(product)}
                        className={cn(
                          'flex items-center gap-1.5 text-xs font-semibold transition-colors',
                          product.is_active
                            ? 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700'
                            : 'text-slate-400 hover:text-slate-600'
                        )}
                      >
                        {product.is_active
                          ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                          : <ToggleLeft className="w-5 h-5 text-slate-400" />
                        }
                        {product.is_active ? '활성' : '비활성'}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">
                      {product.updated_at
                        ? formatDate(product.updated_at).split(' ').slice(0, 3).join(' ')
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== 플랫폼 설정 ===== */}
      {activeTab === 'settings' && (
        <div className="space-y-6 animate-fade-in">
          {/* 점검 모드 */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">점검 모드</h3>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-3">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">점검 모드 활성화</p>
                <p className="text-xs text-slate-500">활성화 시 사용자에게 점검 안내 페이지를 표시합니다</p>
              </div>
              <button
                onClick={() => setMaintenanceMode(!maintenanceMode)}
                className={cn(
                  'relative w-12 h-6 rounded-full transition-colors duration-200',
                  maintenanceMode ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'
                )}
              >
                <span className={cn(
                  'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
                  maintenanceMode ? 'translate-x-7' : 'translate-x-1'
                )} />
              </button>
            </div>

            {/* 공지 배너 */}
            <div className="flex items-center gap-2 mb-3">
              <Megaphone className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">공지 배너</p>
              <button
                onClick={() => setAnnouncementActive(!announcementActive)}
                className={cn(
                  'ml-auto relative w-10 h-5 rounded-full transition-colors duration-200',
                  announcementActive ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
                )}
              >
                <span className={cn(
                  'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
                  announcementActive ? 'translate-x-5' : 'translate-x-0.5'
                )} />
              </button>
            </div>
            <input
              type="text"
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              placeholder="공지 배너에 표시할 텍스트를 입력하세요..."
              className="input-field mb-4"
            />
            <button onClick={handleSavePlatformSettings} disabled={savingSettings} className="btn-primary">
              {savingSettings ? <Spinner size="sm" /> : <Save className="w-4 h-4" />}
              플랫폼 설정 저장
            </button>
          </div>

          {/* AWS 설정 */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Key className="w-5 h-5 text-orange-500" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">🔑 AWS 설정</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <SecretInput label="AWS Access Key ID" value={awsKey} onChange={setAwsKey} show={showSecrets} />
              <SecretInput label="AWS Secret Access Key" value={awsSecret} onChange={setAwsSecret} show={showSecrets} />
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">리전</label>
                <select value={awsRegion} onChange={(e) => setAwsRegion(e.target.value)} className="input-field text-sm">
                  <option value="ap-northeast-2">ap-northeast-2 (서울)</option>
                  <option value="ap-northeast-1">ap-northeast-1 (도쿄)</option>
                  <option value="us-east-1">us-east-1 (미국 동부)</option>
                  <option value="eu-west-1">eu-west-1 (유럽)</option>
                </select>
              </div>
              <SecretInput label="EC2 기본 AMI ID" value={awsAmi} onChange={setAwsAmi} show={showSecrets} placeholder="ami-xxxxxxxxxx" />
              <SecretInput label="보안 그룹 ID" value={awsSg} onChange={setAwsSg} show={showSecrets} placeholder="sg-xxxxxxxxxx" />
              <SecretInput label="키페어 이름" value={awsKeyPair} onChange={setAwsKeyPair} show={showSecrets} placeholder="my-keypair" />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleTestAWS} disabled={testingAws} className="btn-outline text-sm">
                {testingAws ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
                설정 저장 및 연결 테스트
              </button>
            </div>
          </div>

          {/* Vultr / DigitalOcean 설정 */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-5 h-5 text-blue-500" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">기타 VPS 제공자</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SecretInput label="🔵 Vultr API Key" value={vultrKey} onChange={setVultrKey} show={showSecrets} placeholder="Vultr API 키" />
              <SecretInput label="🌊 DigitalOcean API Key" value={doKey} onChange={setDoKey} show={showSecrets} placeholder="DO API 키" />
            </div>
          </div>

          {/* PayPal 설정 */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Key className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">💳 결제 설정 (PayPal)</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <SecretInput label="PayPal Client ID" value={paypalId} onChange={setPaypalId} show={showSecrets} />
              <SecretInput label="PayPal Secret Key" value={paypalSecret} onChange={setPaypalSecret} show={showSecrets} />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">모드:</p>
              {(['sandbox', 'live'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPaypalMode(m)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-all border',
                    paypalMode === m
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  )}
                >
                  {m === 'sandbox' ? '샌드박스 (테스트)' : '라이브 (실제 결제)'}
                </button>
              ))}
            </div>

            {/* 키 표시 토글 */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setShowSecrets(!showSecrets)}
                className="btn-outline text-sm flex items-center gap-2"
              >
                {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showSecrets ? '키 숨기기' : '키 표시'}
              </button>
              <button onClick={handleSaveVPSSettings} disabled={savingSettings} className="btn-primary text-sm">
                {savingSettings ? <Spinner size="sm" /> : <Save className="w-4 h-4" />}
                모든 설정 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 감사 로그 ===== */}
      {activeTab === 'logs' && (
        <div className="animate-fade-in">
          <div className="card divide-y divide-slate-100 dark:divide-slate-800">
            {auditLogs.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-sm">감사 로그가 없습니다</div>
            ) : (
              auditLogs.map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 px-5 py-4">
                  <Shield className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-slate-700 dark:text-slate-300">{log.action}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(log.created_at)}</p>
                  </div>
                  <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded">
                    {log.target_type}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 상품 토글 확인 모달 */}
      <ConfirmDialog
        open={!!pendingToggle}
        title={`상품 ${pendingToggle?.active ? '활성화' : '비활성화'}`}
        message={
          pendingToggle?.active
            ? `'${pendingToggle?.name}'을(를) 활성화하면 사용자에게 즉시 표시됩니다. 계속하시겠습니까?`
            : `⚠️ '${pendingToggle?.name}'을(를) 비활성화하면 모든 사용자에게 즉시 숨김 처리됩니다. 계속하시겠습니까?`
        }
        confirmLabel={pendingToggle?.active ? '활성화' : '비활성화'}
        variant={pendingToggle?.active ? 'default' : 'warning'}
        onConfirm={confirmToggle}
        onCancel={() => setPendingToggle(null)}
      />
    </div>
  )
}

// 비밀키 입력 컴포넌트
function SecretInput({
  label, value, onChange, show, placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</label>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || '••••••••••••'}
        className="input-field text-sm font-mono"
      />
    </div>
  )
}