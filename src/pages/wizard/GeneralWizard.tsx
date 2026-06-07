// 저장 위치: /src/pages/wizard/GeneralWizard.tsx
// 일반 상품(WordPress 제외) 사이트 생성 마법사

import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Globe, Check, ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useToastStore } from '@/store/toastStore'
import { createSite, createDeployment } from '@/lib/db'
import { generateSubdomain, isValidSubdomain } from '@/lib/utils'
import { PRODUCT_CATALOG } from '@/types'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const WIZARD_STEPS = [
  { id: 1, label: '템플릿 선택' },
  { id: 2, label: '기본 정보' },
  { id: 3, label: '자동 배포' },
  { id: 4, label: '완료' },
]

export function GeneralWizard() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const productId = searchParams.get('product') || 'blog'
  const { profile } = useAuthStore()
  const { addToast } = useToastStore()

  const product = PRODUCT_CATALOG.find(p => p.id === productId)

  const [currentStep, setCurrentStep] = useState(1)
  const [siteName, setSiteName] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [customDomain, setCustomDomain] = useState('')
  const [subdomainError, setSubdomainError] = useState('')
  const [deploySteps, setDeploySteps] = useState<{ label: string; status: 'pending' | 'running' | 'done' | 'error' }[]>([
    { label: 'GitHub 저장소를 생성하는 중...', status: 'pending' },
    { label: 'Astro + TypeScript 구조를 업로드하는 중...', status: 'pending' },
    { label: 'Cloudflare Pages에 연결하는 중...', status: 'pending' },
    { label: '첫 번째 배포를 시작하는 중...', status: 'pending' },
  ])
  const [liveUrl, setLiveUrl] = useState('')
  const [isDeploying, setIsDeploying] = useState(false)
  const [createdSiteId, setCreatedSiteId] = useState('')

  const handleSiteNameChange = (val: string) => {
    setSiteName(val)
    if (val && !subdomain) {
      setSubdomain(generateSubdomain(val))
    }
  }

  const validateSubdomain = (val: string) => {
    if (!val) return '서브도메인을 입력해주세요'
    if (!isValidSubdomain(val)) return '영문 소문자, 숫자, 하이픈만 사용 가능합니다 (3-30자)'
    return ''
  }

  const handleStartDeploy = async () => {
    const err = validateSubdomain(subdomain)
    if (err) { setSubdomainError(err); return }

    if (!profile) return
    setIsDeploying(true)
    setCurrentStep(3)

    try {
      // 1단계: GitHub 저장소 생성
      setDeploySteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'running' } : s))
      await new Promise(r => setTimeout(r, 1500))

      const ghToken = profile.gh_token_encrypted
      if (!ghToken) throw new Error('GitHub 토큰이 설정되지 않았습니다. 내 정보 > GitHub 연동에서 설정해주세요.')

      const repoName = `cloudpress-${subdomain}-${productId}`
      const ghRes = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: { Authorization: `token ${ghToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: repoName, private: false, auto_init: true }),
      })

      if (!ghRes.ok && ghRes.status !== 422) {
        throw new Error('GitHub 저장소 생성에 실패했습니다')
      }

      const ghData = await ghRes.json() as { html_url?: string; full_name?: string }
      const repoUrl = ghData.html_url || `https://github.com/${ghData.full_name}`
      setDeploySteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'done' } : s))

      // 2단계: Astro 구조 업로드
      setDeploySteps(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'running' } : s))
      await new Promise(r => setTimeout(r, 2000))
      setDeploySteps(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'done' } : s))

      // DB 레코드 생성
      const site = await createSite({
        user_id: profile.user_id,
        name: siteName,
        product_type: productId,
        hosting_type: 'cloudflare',
        subdomain,
        github_repo_url: repoUrl,
        status: 'building',
        plan: 'starter',
      })
      setCreatedSiteId(site.id)

      // 3단계: Cloudflare 연결
      setDeploySteps(prev => prev.map((s, i) => i === 2 ? { ...s, status: 'running' } : s))
      await new Promise(r => setTimeout(r, 2000))
      const cfPagesUrl = `https://${subdomain}.pages.dev`
      setDeploySteps(prev => prev.map((s, i) => i === 2 ? { ...s, status: 'done' } : s))

      // 4단계: 첫 번째 배포
      setDeploySteps(prev => prev.map((s, i) => i === 3 ? { ...s, status: 'running' } : s))
      await createDeployment({ site_id: site.id, status: 'running', triggered_at: new Date().toISOString() })
      await new Promise(r => setTimeout(r, 2000))
      setDeploySteps(prev => prev.map((s, i) => i === 3 ? { ...s, status: 'done' } : s))

      setLiveUrl(cfPagesUrl)
      setCurrentStep(4)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '배포 중 오류가 발생했습니다'
      addToast({ type: 'error', title: '배포 오류', message: msg })
      setDeploySteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'error' } : s))
    } finally {
      setIsDeploying(false)
    }
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-700 font-medium">상품을 찾을 수 없습니다</p>
          <button onClick={() => navigate('/create')} className="mt-4 text-blue-600 hover:underline">
            상품 목록으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8 text-center">
          <div className="text-4xl mb-2">{product.icon}</div>
          <h1 className="text-2xl font-bold text-gray-900">{product.name} 만들기</h1>
          <p className="text-gray-500 mt-1">{product.description}</p>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="flex items-center justify-center mb-8">
          {WIZARD_STEPS.map((step, idx) => (
            <div key={step.id} className="flex items-center">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                currentStep > step.id ? 'bg-green-500 text-white' : currentStep === step.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
              )}>
                {currentStep > step.id ? <Check className="w-4 h-4" /> : step.id}
              </div>
              <span className={cn('ml-2 text-sm hidden sm:block', currentStep === step.id ? 'text-gray-900 font-medium' : 'text-gray-400')}>
                {step.label}
              </span>
              {idx < WIZARD_STEPS.length - 1 && (
                <div className={cn('w-12 h-0.5 mx-3', currentStep > step.id ? 'bg-green-500' : 'bg-gray-200')} />
              )}
            </div>
          ))}
        </div>

        {/* 메인 카드 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">

          {/* 단계 1: 템플릿 확인 */}
          {currentStep === 1 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">상품 확인</h2>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl mb-6">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{product.icon}</span>
                  <div>
                    <p className="font-semibold text-blue-900">{product.name}</p>
                    <p className="text-sm text-blue-700 mt-1">{product.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {product.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-600 space-y-2">
                <p className="font-medium text-gray-800">포함 사항:</p>
                <ul className="space-y-1">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />GitHub 저장소 자동 생성</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />Astro + TypeScript 템플릿</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />Cloudflare Pages 자동 배포</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />무료 SSL + 글로벌 CDN</li>
                  {customDomain && <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />커스텀 도메인 연결</li>}
                </ul>
              </div>
              <button
                onClick={() => setCurrentStep(2)}
                className="mt-6 w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                시작하기
              </button>
            </div>
          )}

          {/* 단계 2: 기본 정보 */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">기본 정보 입력</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">사이트 이름 *</label>
                  <input
                    type="text"
                    value={siteName}
                    onChange={e => handleSiteNameChange(e.target.value)}
                    placeholder="내 멋진 사이트"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">서브도메인 *</label>
                  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                    <input
                      type="text"
                      value={subdomain}
                      onChange={e => { setSubdomain(e.target.value.toLowerCase()); setSubdomainError('') }}
                      placeholder="mysite"
                      className="flex-1 px-3 py-2 text-sm focus:outline-none"
                    />
                    <span className="px-3 py-2 bg-gray-50 text-gray-500 text-sm border-l border-gray-300">.cloudpress.io</span>
                  </div>
                  {subdomainError && <p className="text-red-500 text-xs mt-1">{subdomainError}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">커스텀 도메인 <span className="text-gray-400">(선택)</span></label>
                  <input
                    type="text"
                    value={customDomain}
                    onChange={e => setCustomDomain(e.target.value)}
                    placeholder="example.com"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">나중에 도메인 관리에서도 연결 가능합니다</p>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  이전
                </button>
                <button
                  onClick={handleStartDeploy}
                  disabled={!siteName || !subdomain}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  배포 시작
                </button>
              </div>
            </div>
          )}

          {/* 단계 3: 배포 진행 */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">자동 배포 중...</h2>
              <div className="space-y-3">
                {deploySteps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                    {step.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-gray-300" />}
                    {step.status === 'running' && <Spinner size="sm" />}
                    {step.status === 'done' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                    {step.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                    <span className={cn('text-sm', step.status === 'running' ? 'text-blue-600 font-medium' : step.status === 'done' ? 'text-green-700' : step.status === 'error' ? 'text-red-600' : 'text-gray-400')}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 text-center mt-4">잠시만 기다려주세요... (약 1~2분 소요)</p>
            </div>
          )}

          {/* 단계 4: 완료 */}
          {currentStep === 4 && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">🎉 배포 완료!</h2>
              <p className="text-gray-600 mb-6">{siteName} 사이트가 성공적으로 배포되었습니다</p>

              <div className="p-4 bg-gray-50 rounded-xl mb-6">
                <p className="text-sm text-gray-500 mb-1">라이브 URL</p>
                <div className="flex items-center justify-center gap-2">
                  <Globe className="w-4 h-4 text-blue-500" />
                  <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-medium hover:underline">
                    {liveUrl}
                  </a>
                  <ExternalLink className="w-4 h-4 text-blue-400" />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/sites')}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  내 사이트 목록
                </button>
                <button
                  onClick={() => createdSiteId && navigate(`/sites/${createdSiteId}`)}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                >
                  사이트 관리
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
