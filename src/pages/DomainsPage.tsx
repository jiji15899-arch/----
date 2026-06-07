// 저장 위치: /src/pages/DomainsPage.tsx
import { useState, useEffect } from 'react'
import { Globe, Plus, Copy, CheckCircle2, Clock, XCircle, X, AlertCircle, ExternalLink } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getMyDomains, getMySites, addDomain } from '@/lib/db'
import { Domain, Site } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { useToastStore } from '@/store/toastStore'
import { copyToClipboard, isValidDomain, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

type AddStep = 1 | 2 | 3

export function DomainsPage() {
  const { profile } = useAuthStore()
  const { success, error, info } = useToastStore()

  const [domains, setDomains] = useState<Domain[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addStep, setAddStep] = useState<AddStep>(1)
  const [newDomain, setNewDomain] = useState('')
  const [domainError, setDomainError] = useState('')
  const [addingDomain, setAddingDomain] = useState(false)
  const [createdDomain, setCreatedDomain] = useState<Domain | null>(null)

  useEffect(() => {
    loadData()
  }, [profile])

  const loadData = async () => {
    if (!profile?.user_id) return
    try {
      const [dom, sit] = await Promise.all([
        getMyDomains(profile.user_id),
        getMySites(profile.user_id),
      ])
      setDomains(dom)
      setSites(sit)
    } catch {
      error('로드 실패', '도메인 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleAddDomain = async () => {
    setDomainError('')
    if (!newDomain.trim()) {
      setDomainError('도메인을 입력해주세요.')
      return
    }
    if (!isValidDomain(newDomain.trim().toLowerCase())) {
      setDomainError('올바른 도메인 형식이 아닙니다. (예: example.com)')
      return
    }

    setAddingDomain(true)
    try {
      // 가상 네임서버 생성 (실제 환경에서는 Cloudflare Edge Function 호출)
      const ns1 = 'alice.ns.cloudflare.com'
      const ns2 = 'bob.ns.cloudflare.com'

      const domainData = await addDomain({
        user_id: profile?.user_id,
        domain: newDomain.trim().toLowerCase(),
        nameserver_1: ns1,
        nameserver_2: ns2,
        ns_status: 'pending',
        ssl_status: 'inactive',
        created_at: new Date().toISOString(),
      })

      setCreatedDomain(domainData)
      setAddStep(2)
      await loadData()
    } catch (err: unknown) {
      if (err instanceof Error && err.message?.includes('duplicate')) {
        setDomainError('이미 등록된 도메인입니다.')
      } else {
        error('도메인 추가 실패', '잠시 후 다시 시도해주세요.')
      }
    } finally {
      setAddingDomain(false)
    }
  }

  const handleCopy = async (text: string) => {
    await copyToClipboard(text)
    success('복사 완료', '클립보드에 복사되었습니다.')
  }

  const handleCheckStatus = () => {
    info('확인 중', '네임서버 전파 상태를 확인하고 있습니다. 최대 48시간 소요될 수 있습니다.')
    setAddStep(3)
  }

  const closeModal = () => {
    setShowAddModal(false)
    setAddStep(1)
    setNewDomain('')
    setDomainError('')
    setCreatedDomain(null)
  }

  const getNSStatusIcon = (status: string) => {
    if (status === 'active') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
    if (status === 'failed') return <XCircle className="w-4 h-4 text-red-500" />
    return <Clock className="w-4 h-4 text-amber-500" />
  }

  const getSSLStatusLabel = (status: string) => {
    if (status === 'active') return '활성'
    if (status === 'issuing') return '발급 중'
    return '비활성'
  }

  const getNSStatusLabel = (status: string) => {
    if (status === 'active') return '연결 완료'
    if (status === 'failed') return '연결 실패'
    return '대기 중'
  }

  return (
    <div className="page-container animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">도메인 관리</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            총 {domains.length}개 도메인 등록됨
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          도메인 추가하기
        </button>
      </div>

      {/* 안내 배너 */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-semibold mb-1">커스텀 도메인 연결 방법</p>
            <p>도메인을 추가하면 네임서버 2개를 제공해드립니다. 도메인 구매처(가비아, 카페24, GoDaddy 등)의 관리 페이지에서 네임서버를 변경해주세요. 변경 후 최대 48시간 내에 자동으로 연결됩니다.</p>
          </div>
        </div>
      </div>

      {/* 도메인 목록 */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : domains.length === 0 ? (
        <div className="card p-16 text-center">
          <Globe className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
            등록된 도메인이 없습니다
          </h3>
          <p className="text-slate-500 text-sm mb-6">
            커스텀 도메인을 추가하여 사이트를 더욱 전문적으로 운영하세요
          </p>
          <button onClick={() => setShowAddModal(true)} className="btn-primary mx-auto">
            <Plus className="w-4 h-4" />
            첫 도메인 추가하기
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-5 py-3.5">도메인</th>
                  <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3.5">연결된 사이트</th>
                  <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3.5">네임서버</th>
                  <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3.5">SSL</th>
                  <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3.5">등록일</th>
                  <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3.5">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {domains.map((domain) => {
                  const connectedSite = sites.find((s) => s.id === domain.connected_site_id)
                  return (
                    <tr key={domain.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            {domain.domain}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {connectedSite ? (
                          <span className="text-primary font-medium">{connectedSite.name}</span>
                        ) : (
                          <span className="text-slate-400">미연결</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 text-sm">
                          {getNSStatusIcon(domain.ns_status)}
                          <span className={cn(
                            'text-xs font-medium',
                            domain.ns_status === 'active' ? 'text-emerald-600 dark:text-emerald-400' :
                            domain.ns_status === 'failed' ? 'text-red-600 dark:text-red-400' :
                            'text-amber-600 dark:text-amber-400'
                          )}>
                            {getNSStatusLabel(domain.ns_status)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded-full',
                          domain.ssl_status === 'active'
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                            : domain.ssl_status === 'issuing'
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                        )}>
                          {getSSLStatusLabel(domain.ssl_status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-400">
                        {formatDate(domain.created_at).split(' ').slice(0, 3).join(' ')}
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => handleCopy(domain.domain)}
                          className="text-xs text-slate-500 hover:text-primary transition-colors flex items-center gap-1"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          복사
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 도메인 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {addStep === 1 && '도메인 추가'}
                  {addStep === 2 && '네임서버 설정'}
                  {addStep === 3 && '연결 확인 중'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">단계 {addStep} / 3</p>
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 단계 표시 */}
            <div className="flex px-6 pt-4 gap-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className={cn(
                  'flex-1 h-1 rounded-full transition-colors',
                  addStep >= s ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
                )} />
              ))}
            </div>

            {/* 단계 1: 도메인 입력 */}
            {addStep === 1 && (
              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    도메인 주소
                  </label>
                  <input
                    type="text"
                    value={newDomain}
                    onChange={(e) => { setNewDomain(e.target.value); setDomainError('') }}
                    placeholder="example.com"
                    className="input-field"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                  />
                  {domainError && (
                    <p className="text-xs text-danger mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {domainError}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-1.5">
                    서브도메인 없이 루트 도메인을 입력하세요 (예: example.com)
                  </p>
                </div>
                <button
                  onClick={handleAddDomain}
                  disabled={addingDomain}
                  className="btn-primary w-full justify-center"
                >
                  {addingDomain ? <Spinner size="sm" /> : null}
                  다음: 네임서버 확인
                </button>
              </div>
            )}

            {/* 단계 2: 네임서버 안내 */}
            {addStep === 2 && createdDomain && (
              <div className="p-6">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-5">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
                    ⚠️ 네임서버를 변경해주세요
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    가비아, 카페24, GoDaddy 등 도메인 구매처에서 아래 네임서버로 변경해주세요.
                    변경 후 최대 48시간 소요될 수 있습니다.
                  </p>
                </div>

                <div className="space-y-3 mb-5">
                  {[createdDomain.nameserver_1, createdDomain.nameserver_2].map((ns, i) => (
                    ns && (
                      <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div>
                          <p className="text-xs text-slate-400 mb-0.5">네임서버 {i + 1}</p>
                          <p className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200">{ns}</p>
                        </div>
                        <button
                          onClick={() => handleCopy(ns)}
                          className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-500"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  ))}
                </div>

                <button onClick={handleCheckStatus} className="btn-primary w-full justify-center">
                  네임서버 변경 완료, 확인하기
                </button>
              </div>
            )}

            {/* 단계 3: 대기 중 */}
            {addStep === 3 && (
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-primary animate-pulse" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
                  네임서버 전파 대기 중
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
                  도메인 전파가 완료되면 자동으로 연결됩니다.
                  최대 48시간 소요될 수 있습니다.
                </p>
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 text-left mb-5">
                  <p className="text-xs text-slate-500 mb-2">도메인</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {createdDomain?.domain}
                  </p>
                </div>
                <button onClick={closeModal} className="btn-outline w-full justify-center">
                  확인
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
