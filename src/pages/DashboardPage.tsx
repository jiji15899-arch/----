// 저장 위치: /src/pages/DashboardPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Globe2, Globe, Rocket, CreditCard, Plus, RefreshCw,
  Settings, ExternalLink, TrendingUp, Zap, Server, Cloud
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getMySites, getMyDomains } from '@/lib/db'
import type { Site } from '@/types'
import { PLANS } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate, timeAgo, getSiteStatusLabel, getHostingTypeLabel } from '@/lib/utils'
import { useToastStore } from '@/store/toastStore'

export function DashboardPage() {
  const { profile } = useAuthStore()
  const { error, success } = useToastStore()
  const navigate = useNavigate()
  const [sites, setSites] = useState<Site[]>([])
  const [domainCount, setDomainCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [profile])

  const loadData = async () => {
    if (!profile?.user_id) return
    try {
      const [sitesData, domainsData] = await Promise.all([
        getMySites(profile.user_id),
        getMyDomains(profile.user_id),
      ])
      setSites(sitesData)
      setDomainCount(domainsData.length)
    } catch (err) {
      error('데이터 로드 실패', '잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const currentPlan = PLANS.find((p) => p.id === profile?.plan_id) || PLANS[0]
  const activeSites = sites.filter((s) => s.status === 'active').length
  const thisMonthDeployments = sites.filter((s) => {
    if (!s.last_deployed_at) return false
    const d = new Date(s.last_deployed_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const stats = [
    {
      label: '운영 중인 사이트',
      value: activeSites,
      total: sites.length,
      icon: <Globe2 className="w-5 h-5 text-primary" />,
      color: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      label: '연결된 도메인',
      value: domainCount,
      icon: <Globe className="w-5 h-5 text-emerald-500" />,
      color: 'bg-emerald-50 dark:bg-emerald-900/20',
    },
    {
      label: '이번 달 배포',
      value: thisMonthDeployments,
      icon: <Rocket className="w-5 h-5 text-amber-500" />,
      color: 'bg-amber-50 dark:bg-amber-900/20',
    },
    {
      label: '현재 플랜',
      value: currentPlan.name,
      icon: <CreditCard className="w-5 h-5 text-purple-500" />,
      color: 'bg-purple-50 dark:bg-purple-900/20',
      isString: true,
    },
  ]

  return (
    <div className="page-container animate-fade-in">
      {/* 인사말 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          안녕하세요, {profile?.name || '사용자'}님 👋
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          클라우드프레스 대시보드에 오신 것을 환영합니다
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="stat-card">
            <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center mb-3`}>
              {stat.icon}
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {loading ? (
                <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              ) : (
                stat.value
              )}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{stat.label}</div>
            {stat.total !== undefined && (
              <div className="text-[11px] text-slate-400 mt-0.5">전체 {stat.total}개</div>
            )}
          </div>
        ))}
      </div>

      {/* 빠른 액션 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <button
          onClick={() => navigate('/create')}
          className="flex items-center gap-3 p-4 bg-primary text-white rounded-xl hover:bg-primary-600 transition-colors text-sm font-medium"
        >
          <Plus className="w-5 h-5" />
          새 사이트 만들기
        </button>
        <button
          onClick={() => navigate('/domains')}
          className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          <Globe className="w-5 h-5 text-emerald-500" />
          도메인 추가
        </button>
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          <Settings className="w-5 h-5 text-slate-500" />
          API 키 설정
        </button>
        <button
          onClick={() => navigate('/billing')}
          className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          <TrendingUp className="w-5 h-5 text-purple-500" />
          플랜 업그레이드
        </button>
      </div>

      {/* 내 사이트 목록 */}
      <div className="section-header">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">내 사이트</h2>
        <button
          onClick={() => navigate('/sites')}
          className="text-sm text-primary hover:underline font-medium"
        >
          전체 보기 →
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : sites.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
            아직 사이트가 없습니다
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
            지금 바로 첫 번째 사이트를 만들어보세요!
          </p>
          <button onClick={() => navigate('/create')} className="btn-primary mx-auto">
            <Plus className="w-4 h-4" />
            새 사이트 만들기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sites.slice(0, 6).map((site) => (
            <SiteCard key={site.id} site={site} onRefresh={loadData} />
          ))}
        </div>
      )}

      {sites.length > 0 && (
        <div className="mt-6 text-center">
          <button onClick={() => navigate('/create')} className="btn-primary">
            <Plus className="w-4 h-4" />
            새 사이트 만들기
          </button>
        </div>
      )}
    </div>
  )
}

function SiteCard({ site, onRefresh }: { site: Site; onRefresh: () => void }) {
  const navigate = useNavigate()
  const { success } = useToastStore()

  const handleRedeploy = async () => {
    success('재배포 시작', `${site.name} 사이트 재배포를 시작했습니다.`)
  }

  const siteUrl = site.hosting_type === 'cloudflare'
    ? (site.cf_pages_url || `https://${site.subdomain}.cloudpress.io`)
    : (site.ec2_public_ip ? `http://${site.ec2_public_ip}` : '')

  return (
    <div className="card p-5 hover:shadow-card-hover transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            site.hosting_type === 'cloudflare'
              ? 'bg-blue-50 dark:bg-blue-900/20'
              : 'bg-orange-50 dark:bg-orange-900/20'
          }`}>
            {site.hosting_type === 'cloudflare'
              ? <Cloud className="w-5 h-5 text-primary" />
              : <Server className="w-5 h-5 text-orange-500" />
            }
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{site.name}</h3>
            <p className="text-xs text-slate-400">{site.subdomain}.cloudpress.io</p>
          </div>
        </div>
        <Badge variant={site.status as 'active' | 'building' | 'error' | 'idle'}>
          {getSiteStatusLabel(site.status)}
        </Badge>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Badge variant={site.hosting_type as 'cloudflare' | 'vps'}>
          {getHostingTypeLabel(site.hosting_type)}
        </Badge>
        <span className="text-xs text-slate-400">
          {site.last_deployed_at ? `${timeAgo(site.last_deployed_at)} 배포` : '미배포'}
        </span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => navigate(`/sites/${site.id}`)}
          className="flex-1 btn-outline text-xs py-1.5"
        >
          <Settings className="w-3.5 h-3.5" />
          사이트 관리
        </button>
        <button onClick={handleRedeploy} className="btn-secondary text-xs py-1.5 px-3">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        {siteUrl && (
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs py-1.5 px-3"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}