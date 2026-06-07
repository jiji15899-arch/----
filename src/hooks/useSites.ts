import { useState, useEffect } from 'react'
import { getMySites, deleteSite as apiDeleteSite } from '@/lib/db'
import { Site } from '@/types'
import { useAuthStore } from '@/store/authStore'

export function useSites() {
  const { user } = useAuthStore()
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) fetchSites()
  }, [user])

  const fetchSites = async () => {
    if (!user) return
    try {
      setLoading(true)
      const data = await getMySites(user.id)
      setSites(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '사이트 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const deleteSite = async (siteId: string) => {
    await apiDeleteSite(siteId)
    setSites(prev => prev.filter(s => s.id !== siteId))
  }

  return { sites, loading, error, refetch: fetchSites, deleteSite }
}
