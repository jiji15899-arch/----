import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
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
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('domains')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setDomains(data || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '도메인 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const deleteDomain = async (domainId: string) => {
    const { error } = await supabase.from('domains').delete().eq('id', domainId)
    if (error) throw error
    setDomains(prev => prev.filter(d => d.id !== domainId))
  }

  return { domains, loading, error, refetch: fetchDomains, deleteDomain }
}