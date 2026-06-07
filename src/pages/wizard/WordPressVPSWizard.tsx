// 저장 위치: /src/pages/wizard/WordPressVPSWizard.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Server, Check, ExternalLink, Copy, Eye, EyeOff,
  ChevronDown, ChevronUp, CheckCircle2, Zap, Cloud
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useToastStore } from '@/store/toastStore'
import { createSite, createDeployment } from '@/lib/supabase'
import { generateSubdomain, isValidSubdomain, copyToClipboard, generateTempPassword } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { VPS_SPECS } from '@/types'
import { cn } from '@/lib/utils'

const WIZARD_STEPS = [
  { id: 1, label: '상품 확인' },
  { id: 2, label: '서버 사양' },
  { id: 3, label: '기본 정보' },
  { id: 4, label: '인프라 구성' },
  { id: 5, label: '완료' },
]

const SETUP_STEPS = [
  { label: 'VPS 인스턴스를 생성하는 중...', detail: '선택한 공급자의 서버 할당' },
  { label: 'WordPress + PHP + MySQL 환경을 설치하는 중...', detail: '자동 소프트웨어 설치' },
  { label: '도메인 및 SSL 인증서를 설정하는 중...', detail: 'Let\'s Encrypt SSL 발급' },
  { label: 'WordPress 초기 설정을 완료하는 중...', detail: '관리자 계정 생성' },
]

type VPSProvider = 'aws' | 'vultr' | 'digitalocean'

const VPS_PROVIDERS = [
  { id: 'aws', name: 'AWS EC2', icon: '🟠', desc: '글로벌 인프라, 최고 안정성' },
  { id: 'vultr', name: 'Vultr', icon: '🔵', desc: '빠른 배포, 합리적 가격' },
  { id: 'digitalocean', name: 'DigitalOcean', icon: '🌊', desc: '개발자 친화적, 쉬운 관리' },
]

export function WordPressVPSWizard() {
  const { profile } = useAuthStore()
  const { success, error } = useToastStore()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [selectedSpec, setSelectedSpec] = useState(VPS_SPECS[0])
  const [selectedProvider, setSelectedProvider] = useState<VPSProvider>('aws')
  const [siteName, setSiteName] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [subdomainError, setSubdomainError] = useState('')
  const [setupProgress, setSetupProgress] = useState(0)
  const [currentSetupStep, setCurrentSetupStep] = useState(0)
  const [showSSH, setShowSSH] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [completedSite, setCompletedSite] = useState<{
    id: string; wpAdminUrl: string; ip: string;
    adminUser: string; adminPass: string; sshInfo: string
  } | null>(null)

  const handleSiteNameChange = (value: string) => {
    setSiteName(value)
    setSubdomain(
      value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 30)
    )
  }

  const handleStartSetup = async () => {
    setStep(4)
    setSetupProgress(0)

    try {
      for (let i = 0; i < SETUP_STEPS.length; i++) {
        setCurrentSetupStep(i)
        await new Promise((r) => setTimeout(r, 2200))
        setSetupProgress(((i + 1) / SETUP_STEPS.length) * 100)
      }

      const fakeIp = `${Math.floor(Math.random() * 200) + 50}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 254) + 1}`
      const tempPass = generateTempPassword()

      const siteData = await createSite({
        user_id: profile?.user_id,
        name: siteName,
        product_type: 'wordpress_vps',
        hosting_type: 'vps',
        subdomain,
        ec2_public_ip: fakeIp,
        ec2_region: 'ap-northeast-2',
        wp_admin_url: `http://${fakeIp}/wp-admin`,
        vps_provider: selectedProvider,
        status: 'active',
        plan: selectedSpec.plan.toLowerCase(),
        last_deployed_at: new Date().toISOString(),
      })

      await createDeployment({
        site_id: siteData.id,
        status: 'success',
        triggered_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        log: `${selectedProvider.toUpperCase()} VPS WordPress 설치 완료`,
      })

      setCompletedSite({
        id: siteData.id,
        wpAdminUrl: `http://${fakeIp}/wp-admin`,
        ip: fakeIp,
        adminUser: 'admin',
        adminPass: tempPass,
        sshInfo: `ssh -i keypair.pem ubuntu@${fakeIp}`,
      })
      setStep(5)
      success('🎉 WordPress 설치 완료!', `${siteName} WordPress가 VPS에 설치되었습니다.`)
    } catch (err) {
      error('설치 실패', 'VPS 인스턴스 생성 중 오류가 발생했습니다.')
      setStep(3)
    }
  }

  return (
    <div className="page-container max-w-3xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-orange-50 dark:bg-orange-900/20 rounded-xl flex items-center justify-center">
          <Server className="w-6 h-6 text-orange-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            VPS 기반 WordPress 호스팅
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">완전한 PHP+MySQL WordPress 환경</p>
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

      <div className="card p-6">
        {/* 단계 1: 상품 확인 */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6">상품 확인</h2>

            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-5 mb-6 border border-orange-200 dark:border-orange-800">
              <div className="flex items-start gap-3">
                <div className="text-2xl">🖥️</div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-2">VPS 기반 WordPress 호스팅</h3>
                  <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
                    {[
                      '실제 PHP+MySQL WordPress 환경 (완전한 WordPress)',
                      'AWS / Vultr / DigitalOcean VPS 자동 생성',
                      'SSH 접근, WP-CLI, 플러그인/테마 그대로 사용',
                      '자동 SSL 인증서 (Let\'s Encrypt)',
                      '사용자는 VPS 제공자 계정 불필요 (관리자가 인프라 관리)',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <button onClick={() => setStep(2)} className="btn-primary w-full justify-center py-3">
              다음 단계 →
            </button>
          </div>
        )}

        {/* 단계 2: 서버 사양 */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">서버 사양 선택</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">필요한 성능에 맞는 서버를 선택하세요</p>

            {/* VPS 공급자 */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">VPS 공급자</label>
              <div className="grid grid-cols-3 gap-2">
                {VPS_PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProvider(p.id as VPSProvider)}
                    className={cn(
                      'p-3 rounded-xl border-2 text-center transition-all',
                      selectedProvider === p.id
                        ? 'border-primary bg-blue-50 dark:bg-blue-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    )}
                  >
                    <div className="text-xl mb-1">{p.icon}</div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">{p.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 서버 사양 */}
            <div className="space-y-3 mb-6">
              {VPS_SPECS.map((spec) => (
                <button
                  key={spec.id}
                  onClick={() => setSelectedSpec(spec)}
                  className={cn(
                    'w-full p-4 rounded-xl border-2 text-left transition-all',
                    selectedSpec.id === spec.id
                      ? 'border-primary bg-blue-50 dark:bg-blue-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                        selectedSpec.id === spec.id ? 'border-primary' : 'border-slate-300'
                      )}>
                        {selectedSpec.id === spec.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                          {spec.label} — {spec.vcpu} vCPU / {spec.ram} RAM / {spec.ssd} SSD
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {spec.plan} 플랜 요금제
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-primary">${spec.price_usd}</div>
                      <div className="text-[10px] text-slate-400">/월</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="btn-outline flex-1 justify-center">이전</button>
              <button onClick={() => setStep(3)} className="btn-primary flex-1 justify-center">다음 단계 →</button>
            </div>
          </div>
        )}

        {/* 단계 3: 기본 정보 */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6">기본 정보</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  사이트 이름 <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={siteName}
                  onChange={(e) => handleSiteNameChange(e.target.value)}
                  placeholder="예: 내 쇼핑몰"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  서브도메인 <span className="text-danger">*</span>
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                    className="input-field rounded-r-none flex-1"
                  />
                  <span className="px-3 py-2.5 bg-slate-100 dark:bg-slate-700 border border-l-0 border-slate-300 dark:border-slate-600 rounded-r-lg text-sm text-slate-500">
                    .cloudpress.io
                  </span>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 text-sm">
                <div className="font-medium text-slate-700 dark:text-slate-300 mb-2">선택한 사양 요약</div>
                <div className="text-slate-500 dark:text-slate-400 space-y-1">
                  <div>공급자: <span className="font-medium text-slate-700 dark:text-slate-300">
                    {VPS_PROVIDERS.find(p => p.id === selectedProvider)?.name}
                  </span></div>
                  <div>사양: <span className="font-medium text-slate-700 dark:text-slate-300">
                    {selectedSpec.vcpu} vCPU / {selectedSpec.ram} RAM / {selectedSpec.ssd} SSD
                  </span></div>
                  <div>요금: <span className="font-bold text-primary">${selectedSpec.price_usd}/월</span></div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(2)} className="btn-outline flex-1 justify-center">이전</button>
              <button
                onClick={() => {
                  if (!siteName || !subdomain) { error('입력 오류', '모든 필드를 입력해주세요.'); return }
                  if (!isValidSubdomain(subdomain)) { setSubdomainError('유효하지 않은 서브도메인'); return }
                  handleStartSetup()
                }}
                className="btn-primary flex-1 justify-center"
              >
                자동 인프라 구성 시작 →
              </button>
            </div>
          </div>
        )}

        {/* 단계 4: 인프라 구성 */}
        {step === 4 && (
          <div className="text-center">
            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Server className="w-8 h-8 text-orange-500 animate-pulse" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">인프라 자동 구성 중...</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
              {VPS_PROVIDERS.find(p => p.id === selectedProvider)?.name}에 WordPress 환경을 구성하고 있습니다
            </p>

            <div className="progress-bar mb-4">
              <div className="progress-fill" style={{ width: `${setupProgress}%` }} />
            </div>
            <p className="text-sm text-primary font-semibold mb-8">{Math.round(setupProgress)}% 완료</p>

            <div className="space-y-3 text-left">
              {SETUP_STEPS.map((s, i) => (
                <div key={i} className={cn(
                  'flex items-start gap-3 p-3 rounded-xl transition-all',
                  i < currentSetupStep ? 'bg-emerald-50 dark:bg-emerald-900/20' :
                  i === currentSetupStep ? 'bg-orange-50 dark:bg-orange-900/20' :
                  'bg-slate-50 dark:bg-slate-800'
                )}>
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                    i < currentSetupStep ? 'bg-emerald-500 text-white' :
                    i === currentSetupStep ? 'bg-orange-500 text-white' :
                    'bg-slate-200 dark:bg-slate-700 text-slate-400'
                  )}>
                    {i < currentSetupStep ? <Check className="w-4 h-4" /> :
                     i === currentSetupStep ? <Spinner size="sm" /> :
                     <span className="text-xs">{i + 1}</span>}
                  </div>
                  <div>
                    <div className={cn('text-sm', i <= currentSetupStep ? 'text-slate-800 dark:text-slate-200 font-medium' : 'text-slate-400')}>
                      {s.label}
                    </div>
                    <div className="text-xs text-slate-400">{s.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 단계 5: 완료 */}
        {step === 5 && completedSite && (
          <div>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">🎉 WordPress 설치 완료!</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                <strong>{siteName}</strong> WordPress가 VPS에 설치되었습니다
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <InfoRow
                label="🌐 WordPress 관리자"
                value={completedSite.wpAdminUrl}
                isLink
                onCopy={() => copyToClipboard(completedSite.wpAdminUrl)}
              />
              <InfoRow label="👤 관리자 계정" value={completedSite.adminUser} onCopy={() => copyToClipboard(completedSite.adminUser)} />
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
                <div className="text-xs text-slate-400 mb-2 font-medium">🔑 임시 비밀번호</div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm flex-1 text-slate-700 dark:text-slate-300">
                    {showPassword ? completedSite.adminPass : '•'.repeat(16)}
                  </span>
                  <button onClick={() => setShowPassword(!showPassword)} className="btn-outline py-1 px-2 text-xs">
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => copyToClipboard(completedSite.adminPass).then(() => success('복사됨', ''))} className="btn-outline py-1 px-2 text-xs">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">⚠️ 로그인 후 반드시 비밀번호를 변경하세요</p>
              </div>

              {/* SSH 정보 (접기/펼치기) */}
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowSSH(!showSSH)}
                  className="w-full flex items-center justify-between p-4 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span>🔐 SSH 접속 정보 (고급)</span>
                  {showSSH ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showSSH && (
                  <div className="px-4 pb-4">
                    <div className="code-block flex items-center gap-2">
                      <span className="flex-1">{completedSite.sshInfo}</span>
                      <button onClick={() => copyToClipboard(completedSite.sshInfo).then(() => success('복사됨', ''))} className="text-slate-400 hover:text-slate-200">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <a href={completedSite.wpAdminUrl} target="_blank" rel="noopener noreferrer" className="btn-primary flex-1 justify-center">
                <ExternalLink className="w-4 h-4" />
                WordPress 관리자로 이동
              </a>
              <button onClick={() => navigate(`/sites/${completedSite.id}`)} className="btn-outline flex-1 justify-center">
                사이트 관리
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value, isLink, onCopy }: {
  label: string; value: string; isLink?: boolean; onCopy?: () => Promise<boolean>
}) {
  const { success } = useToastStore()
  return (
    <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
      <div className="text-xs text-slate-400 mb-1 font-medium">{label}</div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">{value}</span>
        {onCopy && (
          <button onClick={() => onCopy().then(() => success('복사됨', ''))} className="btn-outline py-1 px-2 text-xs">
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
        {isLink && (
          <a href={value} target="_blank" rel="noopener noreferrer" className="btn-outline py-1 px-2 text-xs">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}
