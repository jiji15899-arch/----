// 저장 위치: /src/components/ui/Spinner.tsx
import { cn } from '@/lib/utils'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3',
  }

  return (
    <div
      className={cn(
        'rounded-full border-slate-300 dark:border-slate-600 border-t-primary animate-spin',
        sizes[size],
        className
      )}
    />
  )
}

export function LoadingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 gap-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <span className="text-white text-xs font-bold">CP</span>
        </div>
        <span className="text-lg font-bold text-slate-800 dark:text-slate-100">클라우드프레스</span>
      </div>
      <Spinner size="lg" />
      <p className="text-slate-500 text-sm">로딩 중...</p>
    </div>
  )
}