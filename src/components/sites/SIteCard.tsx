import { Site } from '@/types'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { HostingBadge } from '@/components/ui/HostingBadge'
import { Button } from '@/components/ui/Button'
import { ExternalLink, RefreshCw, Settings, Globe } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface SiteCardProps {
  site: Site
  onRedeploy?: (siteId: string) => void
}

export function SiteCard({ site, onRedeploy }: SiteCardProps) {
  const navigate = useNavigate()

  const siteUrl = site.cf_pages_url || (site.ec2_public_ip ? `http://${site.ec2_public_ip}` : null)

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '없음'
    return new Date(dateStr).toLocaleString('ko-KR', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <Card className="hover:shadow-card-hover transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <HostingBadge type={site.hosting_type} provider={site.vps_provider} />
          <StatusBadge status={site.status} />
        </div>
        {siteUrl && (
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-primary transition-colors"
            title="사이트 열기"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>

      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1 truncate">
        {site.name}
      </h3>

      <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-4">
        <Globe className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{site.subdomain}.cloudpress.io</span>
      </div>

      <div className="text-xs text-gray-400 dark:text-gray-500 mb-4">
        마지막 배포: {formatDate(site.last_deployed_at)}
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          icon={<Settings className="w-3.5 h-3.5" />}
          className="flex-1"
          onClick={() => navigate(`/sites/${site.id}`)}
        >
          사이트 관리
        </Button>
        {onRedeploy && (
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => onRedeploy(site.id)}
            disabled={site.status === 'building'}
          >
            재배포
          </Button>
        )}
      </div>
    </Card>
  )
}