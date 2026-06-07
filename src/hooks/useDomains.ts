import { useState, useEffect } from 'react'
import { getMyDomains, deleteDomain as apiDeleteDomain } from '@/lib/db'
import { Domain } from '@/types'
import { useAuthStore } from '@/store/authStore'

export function useDomains() {
  const { user } = useAuthStore()
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) fetchDomains()
  }, [user])

  const fetchDomains = async () => {
    if (!user) return
    try {
      setLoading(true)
      const data = await getMyDomains(user.id)
      setDomains(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '도메인 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const deleteDomain = async (domainId: string) => {
    await apiDeleteDomain(domainId)
    setDomains(prev => prev.filter(d => d.id !== domainId))
  }

  return { domains, loading, error, refetch: fetchDomains, deleteDomain }
}
