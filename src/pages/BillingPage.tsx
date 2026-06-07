// 저장 위치: /src/pages/BillingPage.tsx
import { useState, useEffect } from 'react'
import { Check, CreditCard, TrendingUp, FileText, Download } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getInvoices } from '@/lib/db'
import { PLANS, Plan, Invoice } from '@/types'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToastStore } from '@/store/toastStore'
import { formatDate, formatPrice } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function BillingPage() {
  const { profile } = useAuthStore()
  const { success, info } = useToastStore()

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const currentPlan = PLANS.find((p) => p.id === profile?.plan_id) || PLANS[0]

  useEffect(() => {
    loadInvoices()
  }, [profile])

  const loadInvoices = async () => {
    if (!profile?.user_id) return
    try {
      const data = await getInvoices(profile.user_id)
      setInvoices(data)
    } catch {
      // 조용히 실패
    } finally {
      setLoading(false)
    }
  }

  const handleSelectPlan = (plan: Plan) => {
    if (plan.id === currentPlan.id) return
    setSelectedPlan(plan)
    setShowConfirm(true)
  }

  const handleConfirmPlan = () => {
    setShowConfirm(false)
    // 실제 환경: PayPal SDK 결제 플로우 실행
    info('PayPal 결제', `${selectedPlan?.name} 플랜 결제를 시작합니다. PayPal 창이 열립니다.`)
  }

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = { paid: '결제 완료', pending: '대기 중', failed: '실패' }
    return map[status] || status
  }

  const getStatusClass = (status: string) => {
    if (status === 'paid') return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
    if (status === 'failed') return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
    return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
  }

  return (
    <div className="page-container animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">결제 / 플랜</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          플랜을 선택하고 결제를 관리하세요
        </p>
      </div>

      {/* 현재 플랜 */}
      <div className="card p-5 mb-8 bg-gradient-to-r from-primary/5 to-blue-50 dark:from-primary/10 dark:to-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">현재 플랜</p>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {currentPlan.name} 플랜 · {formatPrice(currentPlan.price_usd)}/월
            </p>
          </div>
        </div>
      </div>

      {/* 플랜 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan.id
          const isUpgrade = plan.price_usd > currentPlan.price_usd

          return (
            <div
              key={plan.id}
              className={cn(
                'card p-6 relative transition-all duration-200',
                isCurrent
                  ? 'ring-2 ring-primary shadow-lg'
                  : 'hover:shadow-card-hover cursor-pointer',
                plan.id === 'pro' && !isCurrent && 'border-primary/30'
              )}
            >
              {plan.id === 'pro' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                    인기
                  </span>
                </div>
              )}
              {isCurrent && (
                <div className="absolute top-3 right-3">
                  <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                    현재 플랜
                  </span>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-primary">{formatPrice(plan.price_usd)}</span>
                  <span className="text-slate-400 text-sm">/월</span>
                </div>
              </div>

              <ul className="space-y-2.5 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectPlan(plan)}
                disabled={isCurrent}
                className={cn(
                  'w-full py-2.5 rounded-xl text-sm font-semibold transition-all',
                  isCurrent
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                    : isUpgrade
                    ? 'bg-primary hover:bg-primary-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'
                )}
              >
                {isCurrent ? '현재 플랜' : isUpgrade ? '업그레이드' : '다운그레이드'}
              </button>
            </div>
          )
        })}
      </div>

      {/* 청구서 */}
      <div>
        <div className="section-header mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            청구서
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : invoices.length === 0 ? (
          <div className="card p-10 text-center">
            <CreditCard className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">아직 청구서가 없습니다</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-5 py-3.5">날짜</th>
                  <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3.5">플랜</th>
                  <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3.5">금액</th>
                  <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3.5">상태</th>
                  <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {invoices.map((invoice) => {
                  const plan = PLANS.find((p) => p.id === invoice.plan_id)
                  return (
                    <tr key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-4 text-sm text-slate-700 dark:text-slate-300">
                        {formatDate(invoice.created_at).split(' ').slice(0, 3).join(' ')}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
                        {plan?.name || '-'} 플랜
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {formatPrice(invoice.amount)}
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn(
                          'text-xs font-semibold px-2 py-0.5 rounded-full',
                          getStatusClass(invoice.status)
                        )}>
                          {getStatusLabel(invoice.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => success('영수증 다운로드', '영수증을 다운로드합니다.')}
                          className="text-slate-400 hover:text-primary transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showConfirm}
        title={`${selectedPlan?.name} 플랜으로 변경`}
        message={`${selectedPlan?.name} 플랜(${formatPrice(selectedPlan?.price_usd || 0)}/월)으로 변경하시겠습니까? PayPal을 통해 결제가 진행됩니다.`}
        confirmLabel="PayPal로 결제"
        onConfirm={handleConfirmPlan}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}
