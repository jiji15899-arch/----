// 저장 위치: /src/components/ui/ConfirmDialog.tsx
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  const confirmBtnClass = {
    danger: 'btn-danger',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white font-medium px-4 py-2 rounded-lg transition-colors',
    default: 'btn-primary',
  }[variant]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-md animate-fade-in">
        {variant !== 'default' && (
          <div className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center mb-4',
            variant === 'danger' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
          )}>
            <AlertTriangle className={cn(
              'w-6 h-6',
              variant === 'danger' ? 'text-danger' : 'text-warning'
            )} />
          </div>
        )}
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">{title}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-outline text-sm">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className={cn(confirmBtnClass, 'text-sm')}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}