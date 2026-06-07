// 저장 위치: /src/pages/SiteDetailPage.tsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ExternalLink, RefreshCw, Cpu, MemoryStick, HardDrive,
  Copy, Eye, EyeOff, ChevronDown, ChevronUp, Server, Cloud,
  Globe, Shield, RotateCcw, Upload, Trash2, AlertTriangle, CheckCircle2
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getMySites } from '@/lib/db'
import { Site } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToastStore } from '@/store/toastStore'
import { getSiteStatusLabel, getHostingTypeLabel, getVPSProviderLabel, copyToClipboard, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function SiteDetailPage() {
  const { siteId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const { success, error, info } = useToastStore()

  const [site, setSite] = useState<Site | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSSH, setShowSSH] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showRestartConfirm, setShowRestartConfirm] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [autoUpdate, setAutoUpdate] = useState(false)

  // 가상 서버 통계 (실제 환경에서는 VPS API 호출)
  const [serverStats] = useState({
    cpu: Math.floor(Math.random() * 40) + 10,
    ram: Math.floor(Math.random() * 60) + 20,
    disk: Math.floor(Math.random() * 50) + 15,
  })

  useEffect(() => {
    loadSite()
  }, [siteId, profile])

  const loadSite = async () => {
    if (!profile?.user_id) return
    try {
      const sites = await getMySites(profile.user_id)
      const found = sites.find((s: Site) => s.id === siteId)
      if (!found) {
        error('사이트 없음', '해당 사이트를 찾을 수 없습니다.')
        navigate('/sites')
        return
      }
      setSite(found)
    } catch {
      error('로드 실패', '사이트 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleRedeploy = () => {
    success('재배포 시작', `${site?.name} 사이트 재배포를 시작했습니다.`)
  }

  const handleRestart = async () => {
    setShowRestartConfirm(false)
    setRestarting(true)
    await new Promise((r) => setTimeout(r, 2000))
    setRestarting(false)
    success('서버 재시작 완료', '서버가 정상적으로 재시작되었습니다.')
  }

  const handleCopy = async (text: string, label: string) => {
    await copyToClipboard(text)
    success('복사 완료', `${label}이(가) 클립보드에 복사되었습니다.`)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!site) return null

  const siteUrl =
    site.hosting_type === 'cloudflare'
      ? site.cf_pages_url || `https://${site.subdomain}.cloudpress.io`
      : site.ec2_public_ip
      ? `http://${site.ec2_public_ip}`
      : ''

  return (
    <div className="page-container animate-fade-in">
      {/* 상단 헤더 */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/sites')}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{site.name}</h1>
            <Badge variant={site.status as 'active' | 'building' | 'error' | 'idle'}>
              {getSiteStatusLabel(site.status)}
            </Badge>
            <Badge variant={site.hosting_type as 'cloudflare' | 'vps'}>
              {getHostingTypeLabel(site.hosting_type)}
            </Badge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {site.subdomain}.cloudpress.io
            {site.last_deployed_at && ` · 마지막 배포: ${formatDate(site.last_deployed_at)}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRedeploy} className="btn-secondary text-sm">
            <RefreshCw className="w-4 h-4" />
            재배포
          </button>
          {siteUrl && (
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              사이트 열기
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 사이트 정보 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 기본 정보 카드 */}
          <div className="card p-6">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
              사이트 정보
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow label="사이트 이름" value={site.name} />
              <InfoRow label="서브도메인" value={`${site.subdomain}.cloudpress.io`} />
              <InfoRow
                label="호스팅 유형"
                value={
                  site.hosting_type === 'vps' && site.vps_provider
                    ? `VPS (${getVPSProviderLabel(site.vps_provider)})`
                    : getHostingTypeLabel(site.hosting_type)
                }
              />
              <InfoRow label="플랜" value={site.plan} />
              {site.github_repo_url && (
                <div className="sm:col-span-2">
                  <InfoRow
                    label="GitHub 저장소"
                    value={site.github_repo_url}
                    link={site.github_repo_url}
                    copyable
                    onCopy={() => handleCopy(site.github_repo_url!, 'GitHub URL')}
                  />
                </div>
              )}
              {site.cf_pages_url && (
                <div className="sm:col-span-2">
                  <InfoRow
                    label="Cloudflare Pages URL"
                    value={site.cf_pages_url}
                    link={site.cf_pages_url}
                    copyable
                    onCopy={() => handleCopy(site.cf_pages_url!, 'Cloudflare URL')}
                  />
                </div>
              )}
              {site.ec2_public_ip && (
                <>
                  <InfoRow
                    label="서버 IP"
                    value={site.ec2_public_ip}
                    copyable
                    onCopy={() => handleCopy(site.ec2_public_ip!, '서버 IP')}
                  />
                  <InfoRow label="서버 리전" value={site.ec2_region || '-'} />
                </>
              )}
              {site.wp_admin_url && (
                <div className="sm:col-span-2">
                  <InfoRow
                    label="WordPress 관리자"
                    value={site.wp_admin_url}
                    link={site.wp_admin_url}
                  />
                </div>
              )}
            </div>
          </div>

          {/* VPS 전용: 서버 관리 패널 */}
          {site.hosting_type === 'vps' && (
            <div className="card p-6">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-5">
                🖥️ 서버 관리
              </h2>

              {/* 서버 리소스 모니터 */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <ResourceMeter label="CPU 사용률" value={serverStats.cpu} icon={<Cpu className="w-4 h-4" />} color="blue" />
                <ResourceMeter label="RAM 사용률" value={serverStats.ram} icon={<MemoryStick className="w-4 h-4" />} color="purple" />
                <ResourceMeter label="디스크 사용률" value={serverStats.disk} icon={<HardDrive className="w-4 h-4" />} color="orange" />
              </div>

              {/* 빠른 액션 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                {site.wp_admin_url && (
                  <a
                    href={site.wp_admin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-sm font-medium transition-colors"
                  >
                    <Globe className="w-4 h-4" />
                    WP 관리자
                  </a>
                )}
                <button
                  onClick={() => setShowRestartConfirm(true)}
                  disabled={restarting}
                  className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {restarting ? <Spinner size="sm" /> : <RotateCcw className="w-4 h-4" />}
                  서버 재시작
                </button>
                <button
                  onClick={() => success('백업 시작', '서버 백업을 시작했습니다. 완료 시 이메일로 알려드립니다.')}
                  className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-sm font-medium transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  백업 생성
                </button>
              </div>

              {/* WordPress 자동 업데이트 토글 */}
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    WordPress 자동 업데이트
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    핵심 파일 및 보안 패치 자동 적용
                  </p>
                </div>
                <button
                  onClick={() => {
                    setAutoUpdate(!autoUpdate)
                    info('설정 저장', `자동 업데이트를 ${!autoUpdate ? '활성화' : '비활성화'}했습니다.`)
                  }}
                  className={cn(
                    'relative w-12 h-6 rounded-full transition-colors duration-200',
                    autoUpdate ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
                      autoUpdate ? 'translate-x-7' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>

              {/* SSH 정보 (접기/펼치기) */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowSSH(!showSSH)}
                  className="w-full flex items-center justify-between p-4 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-slate-400" />
                    SSH 접속 정보 (고급 사용자)
                  </span>
                  {showSSH ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showSSH && (
                  <div className="px-4 pb-4 space-y-3 border-t border-slate-200 dark:border-slate-700 pt-3">
                    <SSHInfoRow
                      label="호스트"
                      value={site.ec2_public_ip || '-'}
                      onCopy={() => handleCopy(site.ec2_public_ip || '', 'SSH 호스트')}
                    />
                    <SSHInfoRow
                      label="포트"
                      value="22"
                      onCopy={() => handleCopy('22', 'SSH 포트')}
                    />
                    <SSHInfoRow
                      label="사용자"
                      value="ubuntu"
                      onCopy={() => handleCopy('ubuntu', 'SSH 사용자')}
                    />
                    <div className="mt-3 p-3 bg-slate-900 dark:bg-slate-950 rounded-lg font-mono text-xs text-emerald-400">
                      $ ssh ubuntu@{site.ec2_public_ip || 'server-ip'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 오른쪽: 빠른 액션 */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">빠른 액션</h3>
            <div className="space-y-2">
              {siteUrl && (
                <a
                  href={siteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm text-slate-700 dark:text-slate-300"
                >
                  <ExternalLink className="w-4 h-4 text-primary" />
                  사이트 방문
                </a>
              )}
              <button
                onClick={handleRedeploy}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm text-slate-700 dark:text-slate-300 text-left"
              >
                <RefreshCw className="w-4 h-4 text-amber-500" />
                재배포
              </button>
              <button
                onClick={() => navigate('/domains')}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm text-slate-700 dark:text-slate-300 text-left"
              >
                <Globe className="w-4 h-4 text-emerald-500" />
                도메인 연결
              </button>
              <button
                onClick={() => navigate('/billing')}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm text-slate-700 dark:text-slate-300 text-left"
              >
                <Shield className="w-4 h-4 text-purple-500" />
                플랜 업그레이드
              </button>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm text-red-500 text-left"
                >
                  <Trash2 className="w-4 h-4" />
                  사이트 삭제
                </button>
              </div>
            </div>
          </div>

          {/* 상태 정보 */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">상태</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">사이트 상태</span>
                <Badge variant={site.status as 'active' | 'building' | 'error' | 'idle'}>
                  {getSiteStatusLabel(site.status)}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">SSL 상태</span>
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  활성
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">호스팅</span>
                <Badge variant={site.hosting_type as 'cloudflare' | 'vps'}>
                  {getHostingTypeLabel(site.hosting_type)}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 확인 모달들 */}
      <ConfirmDialog
        open={showRestartConfirm}
        title="서버 재시작"
        message="서버를 재시작하면 잠시 동안 사이트가 접속되지 않을 수 있습니다. 계속하시겠습니까?"
        confirmLabel="재시작"
        variant="warning"
        onConfirm={handleRestart}
        onCancel={() => setShowRestartConfirm(false)}
      />
      <ConfirmDialog
        open={showDeleteConfirm}
        title="사이트 삭제"
        message={`"${site.name}" 사이트를 삭제하면 모든 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        variant="danger"
        onConfirm={() => {
          setShowDeleteConfirm(false)
          navigate('/sites')
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}

function InfoRow({
  label,
  value,
  link,
  copyable,
  onCopy,
}: {
  label: string
  value: string
  link?: string
  copyable?: boolean
  onCopy?: () => void
}) {
  return (
    <div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline truncate"
          >
            {value}
          </a>
        ) : (
          <span className="text-sm text-slate-800 dark:text-slate-200 truncate">{value}</span>
        )}
        {copyable && onCopy && (
          <button onClick={onCopy} className="flex-shrink-0 text-slate-400 hover:text-slate-600">
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

function ResourceMeter({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: number
  icon: React.ReactNode
  color: 'blue' | 'purple' | 'orange'
}) {
  const colorMap = {
    blue: { bar: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    purple: { bar: 'bg-purple-500', text: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    orange: { bar: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  }
  const c = colorMap[color]

  return (
    <div className={`p-3 rounded-xl ${c.bg}`}>
      <div className={`flex items-center gap-1.5 mb-2 ${c.text}`}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">{value}%</div>
      <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${c.bar} rounded-full transition-all`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

function SSHInfoRow({
  label,
  value,
  onCopy,
}: {
  label: string
  value: string
  onCopy: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono text-slate-700 dark:text-slate-300">
          {value}
        </code>
        <button onClick={onCopy} className="text-slate-400 hover:text-slate-600">
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
