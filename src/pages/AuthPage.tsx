// 저장 위치: /src/pages/AuthPage.tsx
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Cloud, Mail, Lock, User, Github, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useToastStore } from '@/store/toastStore'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'

type AuthMode = 'login' | 'signup' | 'forgot'

export function AuthPage() {
  const { user, signIn, signUp } = useAuthStore()
  const { success, error: toastError } = useToastStore()
  const navigate = useNavigate()

  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  if (user) return <Navigate to="/dashboard" replace />

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        if (!name.trim()) {
          setErrorMsg('이름을 입력해주세요.')
          return
        }
        if (password.length < 8) {
          setErrorMsg('비밀번호는 8자 이상이어야 합니다.')
          return
        }
        await signUp(email, password, name)
        success(
          '인증 메일 발송 완료',
          '입력하신 이메일로 인증 메일을 발송했습니다. 확인 후 로그인해주세요.'
        )
        setMode('login')

      } else if (mode === 'login') {
        await signIn(email, password)
        navigate('/dashboard')

      } else {
        // 비밀번호 재설정
        const API_BASE = import.meta.env.VITE_API_URL || '/api'
        const res = await fetch(`${API_BASE}/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        if (!res.ok) {
          const d = await res.json()
          throw new Error(d.error || '요청 실패')
        }
        success('이메일 발송 완료', '비밀번호 재설정 링크를 이메일로 발송했습니다.')
        setMode('login')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '오류가 발생했습니다.'
      const mapped =
        msg.includes('Invalid login') || msg.includes('invalid_credentials')
          ? '이메일 또는 비밀번호가 올바르지 않습니다.'
          : msg.includes('Email not confirmed') || msg.includes('not verified')
          ? '이메일 인증을 완료해주세요. 받은 편지함을 확인해주세요.'
          : msg.includes('already registered') || msg.includes('already exists')
          ? '이미 사용 중인 이메일입니다.'
          : msg
      setErrorMsg(mapped)
      toastError('오류', mapped)
    } finally {
      setLoading(false)
    }
  }

  const handleSocialLogin = (provider: 'google' | 'github') => {
    const API_BASE = import.meta.env.VITE_API_URL || '/api'
    window.location.href = `${API_BASE}/auth/oauth/${provider}?redirect=${encodeURIComponent(window.location.origin + '/dashboard')}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/25">
              <Cloud className="w-7 h-7 text-white" />
            </div>
            <div className="text-left">
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100">클라우드프레스</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">CloudPress</div>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {mode === 'login' && '클라우드프레스에 오신 것을 환영합니다'}
            {mode === 'signup' && '새 계정 만들기'}
            {mode === 'forgot' && '비밀번호 재설정'}
          </h1>
          {mode === 'login' && (
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
              WordPress 호스팅을 클라우드에서 간편하게
            </p>
          )}
        </div>

        <div className="card p-8 shadow-card">
          {/* 소셜 로그인 (로그인/회원가입만) */}
          {mode !== 'forgot' && (
            <>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  onClick={() => handleSocialLogin('google')}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google로 {mode === 'login' ? '로그인' : '가입'}
                </button>
                <button
                  onClick={() => handleSocialLogin('github')}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  <Github className="w-4 h-4" />
                  GitHub로 {mode === 'login' ? '로그인' : '가입'}
                </button>
              </div>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-white dark:bg-slate-800 text-slate-400">또는 이메일로 계속하기</span>
                </div>
              </div>
            </>
          )}

          {/* 이메일 폼 */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">이름</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="홍길동"
                    className="input-field pl-10"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">이메일</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="input-field pl-10"
                  required
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">비밀번호</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? '8자 이상 입력' : '비밀번호 입력'}
                    className="input-field pl-10 pr-10"
                    required
                    minLength={mode === 'signup' ? 8 : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-400">{errorMsg}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Spinner size="sm" className="border-white border-t-white/30" /> 처리 중...</>
              ) : mode === 'login' ? (
                '로그인'
              ) : mode === 'signup' ? (
                '회원가입'
              ) : (
                '재설정 링크 발송'
              )}
            </button>
          </form>

          {/* 하단 링크 */}
          <div className="mt-6 space-y-3 text-center text-sm">
            {mode === 'login' && (
              <>
                <button
                  onClick={() => { setMode('forgot'); setErrorMsg('') }}
                  className="text-primary hover:underline block w-full"
                >
                  비밀번호를 잊으셨나요?
                </button>
                <p className="text-slate-500 dark:text-slate-400">
                  계정이 없으신가요?{' '}
                  <button
                    onClick={() => { setMode('signup'); setErrorMsg('') }}
                    className="text-primary font-semibold hover:underline"
                  >
                    회원가입
                  </button>
                </p>
              </>
            )}
            {(mode === 'signup' || mode === 'forgot') && (
              <button
                onClick={() => { setMode('login'); setErrorMsg('') }}
                className="text-primary hover:underline"
              >
                ← 로그인으로 돌아가기
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          © 2025 클라우드프레스(CloudPress). All rights reserved.
        </p>
      </div>
    </div>
  )
}