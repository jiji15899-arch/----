import { HostingType } from '@/types'
import { cn } from '@/lib/utils'
import { Cloud, Server } from 'lucide-react'

interface HostingBadgeProps {
  type: HostingType
  provider?: string
  className?: string
}

export function HostingBadge({ type, provider, className }: HostingBadgeProps) {
  if (type === 'cloudflare') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium',
          'bg-blue-50 text-blue-600 border border-blue-200',
          className
        )}
      >
        <Cloud className="w-3 h-3" />
        Cloudflare
      </span>
    )
  }

  const providerLabel =
    provider === 'aws' ? 'AWS' : provider === 'vultr' ? 'Vultr' : provider === 'digitalocean' ? 'DigitalOcean' : 'VPS'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium',
        'bg-orange-50 text-orange-600 border border-orange-200',
        className
      )}
    >
      <Server className="w-3 h-3" />
      {providerLabel}
    </span>
  )
}