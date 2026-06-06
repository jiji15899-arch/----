// 저장 위치: /src/pages/wizard/WordPressCFWizard.tsx
import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Cloud, Upload, Check, ExternalLink, Copy, AlertCircle,
  Github, Globe, Zap, Database, Server, CheckCircle2
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useToastStore } from '@/store/toastStore'
import { createSite, createDeployment } from '@/lib/supabase'
import { generateSubdomain, isValidSubdomain, copyToClipboard } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

type ContentChoice = 'new' | 'upload'

const WIZARD_STEPS = [
  { id: 1, label: '상품 확인' },
  { id: 2, label: '기본 정보' },
  { id: 3, label: '콘텐츠 선택' },
  { id: 4, label: '자동 설정' },
  { id: 5, label: '완료' },
]

const SETUP_STEPS = [
  { label: 'GitHub 저장소를 생성하는 중...', icon: <Github className="w-5 h-5" /> },
  { label: 'WordPress 파일 구조를 설정하는 중...', icon: <Database className="w-5 h-5" /> },
  { label: 'GitHub Actions Nginx 워크플로우 구성 중...', icon: <Zap className="w-5 h-5" /> },
  { label: '첫 번째 배포를 시작하는 중...', icon: <Globe className="w-5 h-5" /> },
]

export function WordPressCFWizard() {
  const { profile } = useAuthStore()
  const { success, error } = useToastStore()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [siteName, setSiteName] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [contentChoice, setContentChoice] = useState<ContentChoice>('new')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [setupProgress, setSetupProgress] = useState(0)
  const [currentSetupStep, setCurrentSetupStep] = useState(0)
  const [completedSite, setCompletedSite] = useState<{ id: string; url: string; repoUrl: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [subdomainError, setSubdomainError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSiteNameChange = (value: string) => {
    setSiteName(value)
    if (!subdomain || subdomain === generateSubdomain(siteName).split('-').slice(0, -1).join('-')) {
      setSubdomain(
        value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 30)
      )
    }
  }

  const validateStep2 = () => {
    if (!siteName.trim()) { error('입력 오류', '사이트 이름을 입력해주세요.'); return false }
    if (!subdomain.trim()) { error('입력 오류', '서브도메인을 입력해주세요.'); return false }
    if (!isValidSubdomain(subdomain)) {
      setSubdomainError('영문 소문자, 숫자, 하이픈(-)만 사용 가능합니다.')
      return false
    }
    setSubdomainError('')
    return true
  }

  const handleStartSetup = async () => {
    if (!profile?.cf_api_key_encrypted || !profile?.gh_token_encrypted) {
      error(
        'API 키 필요',
        'Cloudflare API 키와 GitHub 토큰을 먼저 설정해주세요.'
      )
      navigate('/profile')
      return
    }

    setLoading(true)
    setStep(4)
    setSetupProgress(0)

    try {
      // 단계별 시뮬레이션 (실제 환경에서는 Edge Function 호출)
      for (let i = 0; i < SETUP_STEPS.length; i++) {
        setCurrentSetupStep(i)
        await new Promise((r) => setTimeout(r, 1800))
        setSetupProgress(((i + 1) / SETUP_STEPS.length) * 100)
      }

      // Supabase에 사이트 생성
      const siteData = await createSite({
        user_id: profile.user_id,
        name: siteName,
        product_type: 'wordpress_cf',
        hosting_type: 'cloudflare',
        subdomain,
        github_repo_url: `https://github.com/${profile.name?.toLowerCase().replace(/\s/g, '-')}/${subdomain}`,
        cf_pages_url: `https://${subdomain}.pages.dev`,
        status: 'active',
        plan: profile.plan_id || 'starter',
        last_deployed_at: new Date().toISOString(),
      })

      await createDeployment({
        site_id: siteData.id,
        status: 'success',
        triggered_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        log: 'WordPress 서버리스 배포 완료',
      })

      setCompletedSite({
        id: siteData.id,
        url: `https://${subdomain}.cloudpress.io`,
        repoUrl: `https://github.com/${profile.name?.toLowerCase().replace(/\s/g, '-')}/${subdomain}`,
      })
      setStep(5)
      success('🎉 배포 완료!', `${siteName} 사이트가 성공적으로 배포되었습니다.`)
    } catch (err) {
      error('설정 실패', '사이트 생성 중 오류가 발생했습니다. 다시 시도해주세요.')
      setStep(3)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container max-w-3xl mx-auto animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
          <Cloud className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Cloudflare 기반 WordPress 호스팅
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">GitHub + 서버리스 WordPress 자동 배포</p>
        </div>
      </div>

      {/* 스텝 인디케이터 */}
      <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
        {WIZARD_STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1 flex-shrink-0">
            <div className={cn(
              'step-circle',
              step > s.id ? 'completed' : step === s.id ? 'active' : 'pending'
            )}>
              {step > s.id ? <Check className="w-4 h-4" /> : s.id}
            </div>
            <span className={cn(
              'text-xs font-medium hidden sm:block',
              step >= s.id ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'
            )}>
              {s.label}
            </span>
            {i < WIZARD_STEPS.length - 1 && (
              <div className={cn(
                'h-px w-6 sm:w-12 mx-1',
                step > s.id ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
              )} />
            )}
          </div>
        ))}
      </div>

      {/* 단계별 콘텐츠 */}
      <div className="card p-6">
        {/* 단계 1: 상품 확인 */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">상품 확인</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">선택하신 호스팅 플랜을 확인해주세요</p>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-5 mb-6 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <div className="text-2xl">☁️</div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">
                    Cloudflare 기반 WordPress 호스팅
                  </h3>
                  <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      진짜 WordPress — SQLite DB + GitHub 저장소에 파일 보관
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      GitHub Actions로 Nginx 서버 자동 구성 (100% 서버리스)
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      미디어 파일 포함 모든 WordPress 파일을 GitHub에 배치
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      무료 SSL + 글로벌 CDN 자동 적용
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-700 dark:text-amber-400">
                  <strong>시작 전 필요 사항:</strong> Cloudflare API 키와 GitHub Personal Access Token이 필요합니다.
                  <button
                    onClick={() => navigate('/profile')}
                    className="ml-1 underline hover:no-underline"
                  >
                    내 정보 관리에서 설정하기 →
                  </button>
                </div>
              </div>
            </div>

            <button onClick={() => setStep(2)} className="btn-primary w-full justify-center py-3">
              다음 단계
              <ChevronRightIcon />
            </button>
          </div>
        )}

        {/* 단계 2: 기본 정보 */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">기본 정보</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">사이트 이름과 주소를 설정해주세요</p>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  사이트 이름 <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={siteName}
                  onChange={(e) => handleSiteNameChange(e.target.value)}
                  placeholder="예: 나의 블로그"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  서브도메인 <span className="text-danger">*</span>
                </label>
                <div className="flex items-center gap-0">
                  <input
                    type="text"
                    value={subdomain}
                    onChange={(e) => {
                      setSubdomain(e.target.value.toLowerCase())
                      setSubdomainError('')
                    }}
                    placeholder="mysite"
                    className={cn('input-field rounded-r-none flex-1', subdomainError && 'border-danger focus:ring-danger/30')}
                  />
                  <span className="px-3 py-2.5 bg-slate-100 dark:bg-slate-700 border border-l-0 border-slate-300 dark:border-slate-600 rounded-r-lg text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    .cloudpress.io
                  </span>
                </div>
                {subdomainError && (
                  <p className="text-xs text-danger mt-1">{subdomainError}</p>
                )}
                {subdomain && !subdomainError && (
                  <p className="text-xs text-slate-500 mt-1">
                    주소: <span className="text-primary font-mono">https://{subdomain}.cloudpress.io</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(1)} className="btn-outline flex-1 justify-center">
                이전
              </button>
              <button
                onClick={() => { if (validateStep2()) setStep(3) }}
                className="btn-primary flex-1 justify-center"
              >
                다음 단계
                <ChevronRightIcon />
              </button>
            </div>
          </div>
        )}

        {/* 단계 3: 콘텐츠 선택 */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">WordPress 콘텐츠 선택</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">새로 시작하거나 기존 WordPress를 마이그레이션할 수 있습니다</p>

            <div className="space-y-3 mb-6">
              <button
                onClick={() => setContentChoice('new')}
                className={cn(
                  'w-full p-4 rounded-xl border-2 text-left transition-all',
                  contentChoice === 'new'
                    ? 'border-primary bg-blue-50 dark:bg-blue-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0',
                    contentChoice === 'new' ? 'border-primary' : 'border-slate-300'
                  )}>
                    {contentChoice === 'new' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm mb-1">
                      🆕 새로 시작하기
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      깨끗한 WordPress 환경으로 시작합니다. SQLite DB + 기본 테마 포함
                    </div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setContentChoice('upload')}
                className={cn(
                  'w-full p-4 rounded-xl border-2 text-left transition-all',
                  contentChoice === 'upload'
                    ? 'border-primary bg-blue-50 dark:bg-blue-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0',
                    contentChoice === 'upload' ? 'border-primary' : 'border-slate-300'
                  )}>
                    {contentChoice === 'upload' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm mb-1">
                      📦 WordPress ZIP 업로드
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      기존 WordPress 사이트를 마이그레이션합니다 (wp-content 포함)
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {contentChoice === 'upload' && (
              <div
                className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center mb-4 cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                {uploadedFile ? (
                  <div>
                    <p className="font-semibold text-slate-700 dark:text-slate-300">{uploadedFile.name}</p>
                    <p className="text-sm text-slate-400">{(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                      ZIP 파일을 드래그하거나 클릭하여 업로드
                    </p>
                    <p className="text-xs text-slate-400">최대 500MB / .zip 형식</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) setUploadedFile(file)
                  }}
                />
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="btn-outline flex-1 justify-center">
                이전
              </button>
              <button
                onClick={handleStartSetup}
                disabled={contentChoice === 'upload' && !uploadedFile}
                className="btn-primary flex-1 justify-center"
              >
                자동 설정 시작
                <ChevronRightIcon />
              </button>
            </div>
          </div>
        )}

        {/* 단계 4: 자동 설정 */}
        {step === 4 && (
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">자동 설정 중...</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
              잠시만 기다려주세요. 자동으로 모든 설정을 완료합니다.
            </p>

            {/* 진행률 */}
            <div className="progress-bar mb-6">
              <div
                className="progress-fill"
                style={{ width: `${setupProgress}%` }}
              />
            </div>
            <p className="text-sm text-primary font-semibold mb-8">{Math.round(setupProgress)}% 완료</p>

            {/* 단계별 상태 */}
            <div className="space-y-3 text-left">
              {SETUP_STEPS.map((s, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl transition-all',
                    i < currentSetupStep
                      ? 'bg-emerald-50 dark:bg-emerald-900/20'
                      : i === currentSetupStep
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'bg-slate-50 dark:bg-slate-800'
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                    i < currentSetupStep ? 'bg-emerald-500 text-white' :
                    i === currentSetupStep ? 'bg-primary text-white' :
                    'bg-slate-200 dark:bg-slate-700 text-slate-400'
                  )}>
                    {i < currentSetupStep ? (
                      <Check className="w-4 h-4" />
                    ) : i === currentSetupStep ? (
                      <Spinner size="sm" />
                    ) : (
                      s.icon
                    )}
                  </div>
                  <span className={cn(
                    'text-sm',
                    i <= currentSetupStep ? 'text-slate-800 dark:text-slate-200 font-medium' : 'text-slate-400'
                  )}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 단계 5: 완료 */}
        {step === 5 && completedSite && (
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
              🎉 배포 완료!
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              <strong>{siteName}</strong> 사이트가 성공적으로 배포되었습니다
            </p>

            <div className="space-y-3 text-left mb-6">
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
                <div className="text-xs text-slate-400 mb-1 font-medium">🌐 사이트 주소</div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-primary flex-1 truncate">{completedSite.url}</span>
                  <button
                    onClick={() => copyToClipboard(completedSite.url).then(() => success('복사됨', '주소가 복사되었습니다.'))}
                    className="btn-outline py-1 px-2 text-xs"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
                <div className="text-xs text-slate-400 mb-1 font-medium">📦 GitHub 저장소</div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-slate-600 dark:text-slate-400 flex-1 truncate">
                    {completedSite.repoUrl}
                  </span>
                  <a
                    href={completedSite.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-outline py-1 px-2 text-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                <div className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">💡 안내</div>
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  GitHub 저장소에 WordPress 파일(미디어 포함)이 자동 배치되었습니다.
                  GitHub Actions가 Nginx 서버를 자동 구성하여 완전 서버리스로 운영됩니다.
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <a
                href={completedSite.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary flex-1 justify-center"
              >
                <ExternalLink className="w-4 h-4" />
                사이트 방문
              </a>
              <button
                onClick={() => navigate(`/sites/${completedSite.id}`)}
                className="btn-outline flex-1 justify-center"
              >
                사이트 관리
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ChevronRightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}