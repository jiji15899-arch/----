// 저장 위치: /src/components/ui/Badge.tsx
import { cn } from '@/lib/utils'

interface BadgeProps {
  variant?: 'cloudflare' | 'vps' | 'active' | 'building' | 'error' | 'idle' | 'default'
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  const variantClasses = {
    cloudflare: 'badge-cloudflare',
    vps: 'badge-vps',
    active: 'badge-active',
    building: 'badge-building',
    error: 'badge-error',
    idle: 'badge-idle',
    default: 'badge-idle',
  }

  return (
    <span className={cn(variantClasses[variant], className)}>
      {variant === 'building' && (
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse-slow" />
      )}
      {variant === 'active' && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      )}
      {variant === 'error' && (
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
      )}
      {children}
    </span>
  )
}