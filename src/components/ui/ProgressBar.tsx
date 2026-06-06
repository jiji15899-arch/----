import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max?: number
  label?: string
  showPercent?: boolean
  color?: 'primary' | 'success' | 'warning' | 'danger'
  className?: string
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercent = false,
  color = 'primary',
  className,
}: ProgressBarProps) {
  const percent = Math.min(100, Math.round((value / max) * 100))

  const colors = {
    primary: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
  }

  return (
    <div className={cn('w-full', className)}>
      {(label || showPercent) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>}
          {showPercent && <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{percent}%</span>}
        </div>
      )}
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', colors[color])}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}