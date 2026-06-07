import { useAuthStore } from '@/store/authStore'

export function useAuth() {
  const { user, profile, loading, signOut } = useAuthStore()
  return { user, profile, loading, signOut }
}
