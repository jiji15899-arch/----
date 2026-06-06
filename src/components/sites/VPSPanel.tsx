import { useState } from 'react'
import { Site } from '@/types'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { CopyButton } from '@/components/ui/CopyButton'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Toggle } from '@/components/ui/Toggle'
import { useToastStore } from '@/store/toastStore'
import { manageVPS } from '@/lib/api'
import {
  Server, RefreshCw, Database, Key, ArrowUpCircle,
  ExternalLink, Eye, EyeOff, Cpu, HardDrive, MemoryStick
} from 'lucide-react'

interface VPSPanelProps {
  site: Site
}

interface ServerStats {
  cpu: number
  ram: number
  disk: number
}

export function VPSPanel({ site }: VPSPanelProps) {
  const { addToast } = useToastStore()
  const [showSSH, setShowSSH] = useState(false)
  const [autoUpdate, setAutoUpdate] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [stats] = useState<ServerStats>({ cpu: 23, ram: 45, disk: 38 }) // 데모 데이터

  const handleAction = async (action: 'restart' | 'backup') => {
    try {
      setLoading(action)
      await manageVPS({ siteId: site.id, action })
      const labels = { restart: '서버가 재시작되었습니다.', backup: '백업이 생성되었습니다.' }
      addToast({ type: 'success', message: labels[action] })
    } catch {
      addToast({ type: 'error', message: '작업 중 오류가 발생했습니다.' })
    } finally {
      setLoading(null)
    }
  }

  const sshInfo = site.ec2_public_ip
    ? `ssh -i "${site.ec2_instance_id?.slice(0,8)}.pem" ubuntu@${site.ec2_public_ip}`
    : null

  const providerLabel =
    site.vps_provider === 'aws' ? 'AWS EC2' :
    site.vps_provider === 'vultr' ? 'Vultr VPS' :
    site.vps_provider === 'digitalocean' ? 'DigitalOcean Droplet' : 'VPS'

  return (
    <div className="space-y-4">
      {/* 서버 상태 */}
      <Card>
        <CardHeader>
          <CardTitle>서버 리소스 현황</CardTitle>
          <span className="text-xs text-gray-400">{providerLabel}</span>
        </CardHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Cpu className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <ProgressBar value={stats.cpu} label="CPU 사용률" showPercent color={stats.cpu > 80 ? 'danger' : 'primary'} className="flex-1" />
          </div>
          <div className="flex items-center gap-3">
            <MemoryStick className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <ProgressBar value={stats.ram} label="메모리 사용률" showPercent color={stats.ram > 80 ? 'danger' : 'success'} className="flex-1" />
          </div>
          <div className="flex items-center gap-3">
            <HardDrive className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <ProgressBar value={stats.disk} label="디스크 사용률" showPercent color={stats.disk > 80 ? 'warning' : 'primary'} className="flex-1" />
          </div>
        </div>
      </Card>

      {/* WordPress 바로가기 */}
      {site.wp_admin_url && (
        <Card>
          <CardTitle className="mb-3">WordPress 관리</CardTitle>
          <a
            href={site.wp_admin_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button icon={<ExternalLink className="w-4 h-4" />} className="w-full">
              WordPress 관리자(wp-admin) 열기
            </Button>
          </a>
        </Card>
      )}

      {/* 서버 관리 */}
      <Card>
        <CardTitle className="mb-4">서버 관리</CardTitle>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
            <Toggle
              checked={autoUpdate}
              onChange={setAutoUpdate}
              label="WordPress 자동 업데이트"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="w-4 h-4" />}
              loading={loading === 'restart'}
              onClick={() => handleAction('restart')}
              className="flex-1"
            >
              서버 재시작
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Database className="w-4 h-4" />}
              loading={loading === 'backup'}
              onClick={() => handleAction('backup')}
              className="flex-1"
            >
              백업 생성
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={<ArrowUpCircle className="w-4 h-4" />}
            className="w-full"
          >
            서버 사양 업그레이드
          </Button>
        </div>
      </Card>

      {/* SSH 접속 정보 */}
      {sshInfo && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-gray-500" />
              <CardTitle>SSH 접속 정보</CardTitle>
            </div>
            <button
              onClick={() => setShowSSH(!showSSH)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {showSSH ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showSSH ? '숨기기' : '보기'}
            </button>
          </div>
          {showSSH && (
            <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-green-400 flex items-center justify-between gap-3">
              <span className="flex-1 break-all">{sshInfo}</span>
              <CopyButton text={sshInfo} />
            </div>
          )}
          {!showSSH && (
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 font-mono text-xs text-gray-400">
              ••••••••••••••••••••••••••••••••
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2">⚠️ SSH 키 파일을 안전하게 보관하세요.</p>
        </Card>
      )}
    </div>
  )
}