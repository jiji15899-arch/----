import { SiteStatus, NSStatus, SSLStatus } from '@/types'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: SiteStatus | NSStatus | SSLStatus | string
  className?: string
}

const STATUS_CONFIG: Record<string, { label: string; className: string; pulse?: boolean }> = {
  // 사이트 상태
  active: { label: '운영중', className: 'bg-success-50 text-success-500 border-success-500/20' },
  building: { label: '빌드중', className: 'bg-warning-50 text-warning-500 border-warning-500/20', pulse: true },
  error: { label: '오류', className: 'bg-danger-50 text-danger border-danger/20' },
  idle: { label: '대기', className: 'bg-gray-100 text-gray-600 border-gray-300' },
  // 네임서버
  pending: { label: '대기중', className: 'bg-warning-50 text-warning-500 border-warning-500/20', pulse: true },
  failed: { label: '실패', className: 'bg-danger-50 text-danger border-danger/20' },
  // SSL
  issuing: { label: '발급중', className: 'bg-blue-50 text-blue-500 border-blue-200', pulse: true },
  inactive: { label: '비활성', className: 'bg-gray-100 text-gray-500 border-gray-300' },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    className: 'bg-gray-100 text-gray-600 border-gray-300',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.className,
        className
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full bg-current',
          config.pulse && 'animate-pulse-slow'
        )}
      />
      {config.label}
    </span>
  )
}