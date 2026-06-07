// 저장 위치: /src/pages/SitesPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, RefreshCw, ExternalLink, Settings, Cloud, Server,
  Filter, Globe2
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getMySites } from '@/lib/db'
import { Site } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { getSiteStatusLabel, getHostingTypeLabel, getVPSProviderLabel, timeAgo } from '@/lib/utils'
import { useToastStore } from '@/store/toastStore'
import { cn } from '@/lib/utils'

type FilterType = 'all' | 'cloudflare' | 'vps'

export function SitesPage() {
  const { profile } = useAuthStore()
  const { success, error } = useToastStore()
  const navigate = useNavigate()

  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')

  useEffect(() => {
    loadSites()
  }, [profile])

  const loadSites = async () => {
    if (!profile?.user_id) return
    setLoading(true)
    try {
      const data = await getMySites(profile.user_id)
      setSites(data)
    } catch {
      error('로드 실패', '사이트 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleRedeploy = async (site: Site) => {
    success('재배포 시작', `${site.name} 사이트 재배포를 시작했습니다.`)
  }

  const filteredSites = sites.filter((s) => {
    const matchSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.subdomain.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || s.hosting_type === filter
    return matchSearch && matchFilter
  })

  return (
    <div className="page-container animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">내 사이트</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            총 {sites.length}개 사이트 운영 중
          </p>
        </div>
        <button onClick={() => navigate('/create')} className="btn-primary">
          <Plus className="w-4 h-4" />
          새 사이트 만들기
        </button>
      </div>

      {/* 검색 + 필터 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="사이트 이름 또는 도메인 검색..."
            className="input-field pl-10"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'cloudflare', 'vps'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-2 rounded-lg text-sm font-medium transition-all border',
                filter === f
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary'
              )}
            >
              {f === 'all' ? '전체' : f === 'cloudflare' ? 'Cloudflare' : 'VPS'}
            </button>
          ))}
        </div>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : filteredSites.length === 0 ? (
        <div className="card p-16 text-center">
          <Globe2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
            {sites.length === 0 ? '아직 사이트가 없습니다' : '검색 결과가 없습니다'}
          </h3>
          <p className="text-slate-500 text-sm mb-6">
            {sites.length === 0
              ? '첫 번째 사이트를 만들어보세요!'
              : '다른 검색어나 필터를 사용해보세요'}
          </p>
          {sites.length === 0 && (
            <button onClick={() => navigate('/create')} className="btn-primary mx-auto">
              <Plus className="w-4 h-4" />
              새 사이트 만들기
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredSites.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              onManage={() => navigate(`/sites/${site.id}`)}
              onRedeploy={() => handleRedeploy(site)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SiteCard({
  site,
  onManage,
  onRedeploy,
}: {
  site: Site
  onManage: () => void
  onRedeploy: () => void
}) {
  const siteUrl =
    site.hosting_type === 'cloudflare'
      ? site.cf_pages_url || `https://${site.subdomain}.cloudpress.io`
      : site.ec2_public_ip
      ? `http://${site.ec2_public_ip}`
      : ''

  return (
    <div className="card p-5 hover:shadow-card-hover transition-all duration-200 group">
      {/* 상단 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
              site.hosting_type === 'cloudflare'
                ? 'bg-blue-50 dark:bg-blue-900/20'
                : 'bg-orange-50 dark:bg-orange-900/20'
            )}
          >
            {site.hosting_type === 'cloudflare' ? (
              <Cloud className="w-5 h-5 text-primary" />
            ) : (
              <Server className="w-5 h-5 text-orange-500" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
              {site.name}
            </h3>
            <p className="text-xs text-slate-400 truncate">{site.subdomain}.cloudpress.io</p>
          </div>
        </div>
        <Badge variant={site.status as 'active' | 'building' | 'error' | 'idle'}>
          {getSiteStatusLabel(site.status)}
        </Badge>
      </div>

      {/* 배지 행 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Badge variant={site.hosting_type as 'cloudflare' | 'vps'}>
          {getHostingTypeLabel(site.hosting_type)}
          {site.vps_provider ? ` (${getVPSProviderLabel(site.vps_provider)})` : ''}
        </Badge>
        <span className="text-xs text-slate-400">
          {site.last_deployed_at ? `${timeAgo(site.last_deployed_at)} 배포` : '미배포'}
        </span>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-2">
        <button onClick={onManage} className="flex-1 btn-outline text-xs py-1.5">
          <Settings className="w-3.5 h-3.5" />
          사이트 관리
        </button>
        <button
          onClick={onRedeploy}
          title="재배포"
          className="btn-secondary text-xs py-1.5 px-3"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        {siteUrl && (
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="사이트 열기"
            className="btn-secondary text-xs py-1.5 px-3"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}
