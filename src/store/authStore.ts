// 저장 위치: /src/store/authStore.ts
// Cloudflare Workers JWT 인증 기반 (Supabase Auth 완전 제거)

import { create } from 'zustand'
import { auth, getProfile } from '@/lib/db'
import type { Profile } from '@/types'

interface AuthUser {
  id: string
  email: string
}

interface AuthState {
  user: AuthUser | null
  profile: Profile | null
  loading: boolean
  initialized: boolean

  setUser: (user: AuthUser | null) => void
  setProfile: (profile: Profile | null) => void
  setLoading: (loading: boolean) => void

  loadProfile: (userId: string) => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  initialized: false,

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),

  loadProfile: async (userId: string) => {
    try {
      const profile = await getProfile(userId)
      set({ profile })
    } catch (error) {
      console.error('프로필 로드 실패:', error)
    }
  },

  signUp: async (email, password, name) => {
    // Workers /api/auth/signup 호출 → 이메일 인증 메일 발송
    await auth.signUp(email, password, name)
    // 회원가입 후 자동 로그인 없음 (이메일 인증 필요)
  },

  signIn: async (email, password) => {
    const { token, user } = await auth.signIn(email, password)
    localStorage.setItem('cp_token', token)
    localStorage.setItem('cp_user', JSON.stringify(user))
    set({ user })
    await get().loadProfile(user.id)
  },

  signOut: () => {
    auth.signOut()
    set({ user: null, profile: null })
  },

  initialize: async () => {
    try {
      // localStorage에서 저장된 세션 복원
      const stored = localStorage.getItem('cp_user')
      const token = localStorage.getItem('cp_token')

      if (stored && token) {
        const user = JSON.parse(stored) as AuthUser
        set({ user })

        // 서버에서 토큰 유효성 확인
        try {
          const verified = await auth.me()
          set({ user: { id: verified.id, email: verified.email } })
          await get().loadProfile(verified.id)
        } catch {
          // 토큰 만료 → 로그아웃
          auth.signOut()
          set({ user: null, profile: null })
        }
      }
    } catch (error) {
      console.error('인증 초기화 실패:', error)
      auth.signOut()
    } finally {
      set({ loading: false, initialized: true })
    }
  },
}))