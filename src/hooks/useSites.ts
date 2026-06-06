import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
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
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setSites(data || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '사이트 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const deleteSite = async (siteId: string) => {
    const { error } = await supabase.from('sites').delete().eq('id', siteId)
    if (error) throw error
    setSites(prev => prev.filter(s => s.id !== siteId))
  }

  return { sites, loading, error, refetch: fetchSites, deleteSite }
}