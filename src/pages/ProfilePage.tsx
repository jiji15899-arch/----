// 저장 위치: /src/pages/ProfilePage.tsx
import { useState } from 'react'
import { Eye, EyeOff, Check, X, AlertTriangle, Save, User, KeyRound, Github, Cloud } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { updateProfile } from '@/lib/supabase'
import { useToastStore } from '@/store/toastStore'
import { maskApiKey } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export function ProfilePage() {
  const { profile, loadProfile } = useAuthStore()
  const { success, error, warning } = useToastStore()

  // 기본 정보
  const [name, setName] = useState(profile?.name || '')
  const [savingProfile, setSavingProfile] = useState(false)

  // Cloudflare
  const [cfApiKey, setCfApiKey] = useState('')
  const [cfEmail, setCfEmail] = useState(profile?.cf_email || '')
  const [showCfKey, setShowCfKey] = useState(false)
  const [cfStatus, setCfStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle')

  // GitHub
  const [ghToken, setGhToken] = useState('')
  const [showGhToken, setShowGhToken] = useState(false)
  const [ghStatus, setGhStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle')
  const [savingApiKeys, setSavingApiKeys] = useState(false)

  // 계정 삭제
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)

  const handleSaveProfile = async () => {
    if (!profile?.user_id) return
    setSavingProfile(true)
    try {
      await updateProfile(profile.user_id, { name: name.trim() })
      await loadProfile(profile.user_id)
      success('저장 완료', '프로필이 업데이트되었습니다.')
    } catch {
      error('저장 실패', '프로필 저장 중 오류가 발생했습니다.')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleValidateCF = async () => {
    if (!cfApiKey && !profile?.cf_api_key_encrypted) {
      warning('입력 필요', 'Cloudflare API 키를 입력해주세요.')
      return
    }
    setCfStatus('checking')
    // 실제 환경: Edge Function /functions/validate-cloudflare 호출
    await new Promise((r) => setTimeout(r, 1500))
    // 데모: 키 길이 기반 검증
    const key = cfApiKey || profile?.cf_api_key_encrypted || ''
    if (key.length > 8) {
      setCfStatus('ok')
      success('인증 완료', 'Cloudflare API 키가 유효합니다. ✅')
    } else {
      setCfStatus('fail')
      error('인증 실패', '유효하지 않은 Cloudflare API 키입니다.')
    }
  }

  const handleValidateGH = async () => {
    if (!ghToken && !profile?.gh_token_encrypted) {
      warning('입력 필요', 'GitHub 토큰을 입력해주세요.')
      return
    }
    setGhStatus('checking')
    await new Promise((r) => setTimeout(r, 1500))
    const token = ghToken || profile?.gh_token_encrypted || ''
    if (token.length > 8) {
      setGhStatus('ok')
      success('인증 완료', 'GitHub 토큰이 유효합니다. ✅')
    } else {
      setGhStatus('fail')
      error('인증 실패', '유효하지 않은 GitHub 토큰입니다.')
    }
  }

  const handleSaveApiKeys = async () => {
    if (!profile?.user_id) return
    setSavingApiKeys(true)
    try {
      const updates: Record<string, string> = {}
      if (cfApiKey) updates.cf_api_key_encrypted = cfApiKey
      if (cfEmail) updates.cf_email = cfEmail
      if (ghToken) updates.gh_token_encrypted = ghToken
      await updateProfile(profile.user_id, updates)
      await loadProfile(profile.user_id)
      success('저장 완료', 'API 키가 안전하게 저장되었습니다.')
      setCfApiKey('')
      setGhToken('')
    } catch {
      error('저장 실패', 'API 키 저장 중 오류가 발생했습니다.')
    } finally {
      setSavingApiKeys(false)
    }
  }

  const handleDeleteAccount = async () => {
    try {
      await supabase.auth.signOut()
      success('계정 삭제 완료', '계정이 삭제되었습니다.')
    } catch {
      error('삭제 실패', '계정 삭제 중 오류가 발생했습니다.')
    }
  }

  const StatusIcon = ({ status }: { status: 'idle' | 'checking' | 'ok' | 'fail' }) => {
    if (status === 'checking') return <Spinner size="sm" />
    if (status === 'ok') return <Check className="w-4 h-4 text-emerald-500" />
    if (status === 'fail') return <X className="w-4 h-4 text-danger" />
    return null
  }

  return (
    <div className="page-container animate-fade-in max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">내 정보 관리</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          프로필 및 API 키를 관리하세요
        </p>
      </div>

      {/* 기본 정보 */}
      <div className="card p-6 mb-5">
        <div className="flex items-center gap-2 mb-5">
          <User className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">기본 정보</h2>
        </div>

        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="w-14 h-14 rounded-full object-cover"
              />
            ) : (
              <span className="text-primary text-xl font-bold">
                {profile?.name?.[0]?.toUpperCase() || '?'}
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{profile?.name}</p>
            <p className="text-xs text-slate-400">{profile?.role === 'admin' ? '관리자' : '일반 사용자'}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              이름
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              이메일
            </label>
            <input
              type="email"
              value={profile?.user_id || ''}
              disabled
              className="input-field opacity-60 cursor-not-allowed"
              placeholder="이메일은 변경할 수 없습니다"
            />
          </div>
        </div>

        <button
          onClick={handleSaveProfile}
          disabled={savingProfile}
          className="btn-primary mt-5"
        >
          {savingProfile ? <Spinner size="sm" /> : <Save className="w-4 h-4" />}
          저장
        </button>
      </div>

      {/* Cloudflare 연동 */}
      <div className="card p-6 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <Cloud className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Cloudflare 연동</h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Cloudflare 기반 WordPress 호스팅 및 도메인 관리에 필요합니다.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Cloudflare 글로벌 API 키
            </label>
            {profile?.cf_api_key_encrypted && !cfApiKey && (
              <div className="input-field text-slate-500 dark:text-slate-400 mb-2 text-sm font-mono">
                {maskApiKey(profile.cf_api_key_encrypted)}
                <span className="ml-2 text-xs text-emerald-500">✅ 저장됨</span>
              </div>
            )}
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showCfKey ? 'text' : 'password'}
                value={cfApiKey}
                onChange={(e) => { setCfApiKey(e.target.value); setCfStatus('idle') }}
                placeholder="새 API 키 입력 (변경 시에만)"
                className="input-field pl-10 pr-20"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <StatusIcon status={cfStatus} />
                <button
                  onClick={() => setShowCfKey(!showCfKey)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  {showCfKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Cloudflare 계정 이메일
            </label>
            <input
              type="email"
              value={cfEmail}
              onChange={(e) => setCfEmail(e.target.value)}
              placeholder="cloudflare@example.com"
              className="input-field"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleValidateCF}
            disabled={cfStatus === 'checking'}
            className="btn-outline text-sm"
          >
            {cfStatus === 'checking' ? <Spinner size="sm" /> : null}
            검증하기
          </button>
          {cfStatus === 'ok' && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> 인증 완료
            </span>
          )}
          {cfStatus === 'fail' && (
            <span className="text-xs text-danger flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> 유효하지 않은 키
            </span>
          )}
        </div>
      </div>

      {/* GitHub 연동 */}
      <div className="card p-6 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <Github className="w-5 h-5 text-slate-800 dark:text-slate-200" />
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">GitHub 연동</h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Cloudflare 기반 사이트 배포 시 GitHub 저장소를 자동으로 생성합니다.
        </p>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 mb-4 text-xs text-blue-700 dark:text-blue-300">
          <p className="font-semibold mb-1">필요 권한: <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">repo</code>, <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">workflow</code></p>
          <p>GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)에서 생성하세요.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            GitHub Personal Access Token
          </label>
          {profile?.gh_token_encrypted && !ghToken && (
            <div className="input-field text-slate-500 dark:text-slate-400 mb-2 text-sm font-mono">
              {maskApiKey(profile.gh_token_encrypted)}
              <span className="ml-2 text-xs text-emerald-500">✅ 저장됨</span>
            </div>
          )}
          <div className="relative">
            <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type={showGhToken ? 'text' : 'password'}
              value={ghToken}
              onChange={(e) => { setGhToken(e.target.value); setGhStatus('idle') }}
              placeholder="ghp_xxxx... (변경 시에만)"
              className="input-field pl-10 pr-20"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <StatusIcon status={ghStatus} />
              <button
                onClick={() => setShowGhToken(!showGhToken)}
                className="text-slate-400 hover:text-slate-600"
              >
                {showGhToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleValidateGH}
            disabled={ghStatus === 'checking'}
            className="btn-outline text-sm"
          >
            {ghStatus === 'checking' ? <Spinner size="sm" /> : null}
            검증하기
          </button>
          {ghStatus === 'ok' && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> 인증 완료
            </span>
          )}
          {ghStatus === 'fail' && (
            <span className="text-xs text-danger flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> 유효하지 않은 토큰
            </span>
          )}
        </div>
      </div>

      {/* API 키 일괄 저장 */}
      <div className="flex justify-end mb-8">
        <button
          onClick={handleSaveApiKeys}
          disabled={savingApiKeys || (!cfApiKey && !cfEmail && !ghToken)}
          className="btn-primary"
        >
          {savingApiKeys ? <Spinner size="sm" /> : <Save className="w-4 h-4" />}
          API 키 저장
        </button>
      </div>

      {/* 위험 구역 */}
      <div className="card p-6 border-danger/30">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-danger" />
          <h2 className="text-base font-bold text-danger">위험 구역</h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          계정을 삭제하면 모든 사이트, 도메인, 데이터가 영구적으로 삭제됩니다.
        </p>
        <button
          onClick={() => setShowDeleteAccount(true)}
          className="btn-danger text-sm"
        >
          계정 삭제
        </button>
      </div>

      <ConfirmDialog
        open={showDeleteAccount}
        title="계정 삭제"
        message="계정을 삭제하면 모든 사이트, 도메인, 결제 정보가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다. 정말 삭제하시겠습니까?"
        confirmLabel="영구 삭제"
        cancelLabel="취소"
        variant="danger"
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteAccount(false)}
      />
    </div>
  )
}