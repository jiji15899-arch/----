import { cn } from '@/lib/utils'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  className?: string
}

export function Toggle({ checked, onChange, label, disabled, className }: ToggleProps) {
  return (
    <label className={cn('inline-flex items-center gap-3 cursor-pointer', disabled && 'opacity-50 cursor-not-allowed', className)}>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div
          className={cn(
            'w-11 h-6 rounded-full transition-colors duration-200',
            'peer-focus:ring-2 peer-focus:ring-primary/30 peer-focus:ring-offset-1',
            checked ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
          )}
        />
        <div
          className={cn(
            'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
            checked && 'translate-x-5'
          )}
        />
      </div>
      {label && (
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 select-none">{label}</span>
      )}
    </label>
  )
}