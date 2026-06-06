import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Check, Loader2 } from 'lucide-react'

interface DeployStep {
  label: string
  duration: number // ms
}

interface DeployProgressProps {
  steps: DeployStep[]
  onComplete: () => void
  siteUrl?: string
}

export function DeployProgress({ steps, onComplete, siteUrl }: DeployProgressProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    let cancelled = false
    let stepIndex = 0

    const runSteps = async () => {
      for (const step of steps) {
        if (cancelled) return
        await new Promise(res => setTimeout(res, step.duration))
        if (cancelled) return
        stepIndex++
        setCurrentStep(stepIndex)
      }
      if (!cancelled) {
        setCompleted(true)
        setTimeout(onComplete, 800)
      }
    }

    runSteps()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="py-4">
      <div className="space-y-3 mb-6">
        {steps.map((step, index) => {
          const isDone = index < currentStep
          const isRunning = index === currentStep && !completed

          return (
            <div
              key={index}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg transition-all duration-300',
                isDone && 'bg-success-50 dark:bg-success/10',
                isRunning && 'bg-primary/5',
                !isDone && !isRunning && 'opacity-40'
              )}
            >
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                isDone && 'bg-success text-white',
                isRunning && 'text-primary',
                !isDone && !isRunning && 'bg-gray-200 dark:bg-gray-700'
              )}>
                {isDone ? (
                  <Check className="w-3.5 h-3.5" />
                ) : isRunning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                )}
              </div>
              <span className={cn(
                'text-sm font-medium',
                isDone && 'text-success',
                isRunning && 'text-primary',
                !isDone && !isRunning && 'text-gray-400'
              )}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>

      {siteUrl && completed && (
        <div className="bg-success-50 dark:bg-success/10 border border-success/20 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">🎉 배포 완료!</p>
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-medium text-sm hover:underline"
          >
            {siteUrl}
          </a>
        </div>
      )}
    </div>
  )
}