/**
 * src/components/ZoneGuard.tsx
 * 현재 서브도메인과 경로가 맞지 않으면 올바른 도메인으로 이동시킨다.
 * 모든 <Route> 앞에 래핑하여 사용.
 */
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { detectZone, resolvePathZone, enforceZone } from '@/lib/domainRouter'
import type { AppZone } from '@/lib/domainRouter'

interface ZoneGuardProps {
  /** 이 컴포넌트가 속한 존 */
  zone: AppZone
  children: React.ReactNode
}

export function ZoneGuard({ zone, children }: ZoneGuardProps) {
  const location = useLocation()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const currentZone = detectZone()

    // 1. 현재 존이 맞으면 그냥 렌더
    if (currentZone === zone) {
      setChecked(true)
      return
    }

    // 2. path 기반으로 어느 존이어야 하는지 판별
    const pathZone = resolvePathZone(location.pathname)

    if (pathZone && pathZone !== currentZone) {
      // 잘못된 존에서 접근 → 올바른 존으로 리다이렉트
      enforceZone(pathZone)
      return
    }

    // 3. 규칙이 없는 경로 → 현재 렌더 중인 존으로 허용
    setChecked(true)
  }, [location.pathname, zone])

  if (!checked) return null
  return <>{children}</>
}
