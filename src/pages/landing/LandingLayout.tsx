// src/pages/landing/LandingLayout.tsx
import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { zoneOrigin, isProd } from '@/lib/domainRouter'

function ssoLink(path: string) {
  return isProd() ? `${zoneOrigin('sso')}${path}` : `/sso${path}`
}
function consoleLink(path: string) {
  return isProd() ? `${zoneOrigin('console')}${path}` : `/console${path}`
}

const NAV_LINKS = [
  { href: '/features', label: '기능' },
  { href: '/products', label: '상품' },
  { href: '/pricing',  label: '요금제' },
  { href: '/about',    label: '소개' },
  { href: '/faq',      label: 'FAQ' },
]

export function LandingLayout() {
  const location = useLocation()
  const [scrolled, setScrolled]   = useState(false)
  const [menuOpen, setMenuOpen]   = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  return (
    <div className="min-h-screen bg-[#060810] text-white">
      {/* ── 네비게이션 ── */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[#060810]/90 backdrop-blur-xl border-b border-white/10 shadow-lg'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* 로고 */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0070f3] to-[#00d4ff] flex items-center justify-center shadow-[0_0_20px_rgba(0,112,243,0.5)] group-hover:shadow-[0_0_30px_rgba(0,112,243,0.7)] transition-all">
              <span className="text-white font-black text-sm">CP</span>
            </div>
            <span className="font-bold text-lg tracking-tight text-white">
              Cloud<span className="text-[#0070f3]">Press</span>
            </span>
          </Link>

          {/* 데스크톱 메뉴 */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                to={href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === href
                    ? 'text-white bg-white/10'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href={ssoLink('/login')}
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors px-3 py-2"
            >
              로그인
            </a>
            <a
              href={ssoLink('/signup')}
              className="text-sm font-semibold bg-[#0070f3] hover:bg-[#0060d8] text-white px-4 py-2 rounded-lg transition-all hover:shadow-[0_0_20px_rgba(0,112,243,0.4)]"
            >
              무료 시작 →
            </a>
          </div>

          {/* 모바일 햄버거 */}
          <button
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            onClick={() => setMenuOpen(v => !v)}
            aria-label="메뉴"
          >
            {menuOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* 모바일 드로어 */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#060810]/95 backdrop-blur-xl px-6 py-4 flex flex-col gap-1">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                to={href}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === href
                    ? 'text-white bg-white/10'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {label}
              </Link>
            ))}
            <div className="border-t border-white/10 mt-2 pt-3 flex flex-col gap-2">
              <a href={ssoLink('/login')} className="px-3 py-2.5 text-sm font-medium text-slate-400 hover:text-white">
                로그인
              </a>
              <a href={ssoLink('/signup')} className="px-3 py-2.5 text-sm font-semibold bg-[#0070f3] text-white rounded-lg text-center">
                무료 시작 →
              </a>
            </div>
          </div>
        )}
      </header>

      {/* ── 페이지 콘텐츠 ── */}
      <main className="pt-16">
        <Outlet />
      </main>

      {/* ── 푸터 ── */}
      <footer className="border-t border-white/10 mt-24">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10">
            {/* 브랜드 */}
            <div className="col-span-2">
              <Link to="/" className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0070f3] to-[#00d4ff] flex items-center justify-center">
                  <span className="text-white font-black text-sm">CP</span>
                </div>
                <span className="font-bold text-lg text-white">
                  Cloud<span className="text-[#0070f3]">Press</span>
                </span>
              </Link>
              <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
                Cloudflare 기반 서버리스 호스팅 플랫폼.<br />
                WordPress부터 쇼핑몰까지, 코드 없이 배포하세요.
              </p>
            </div>

            {/* 제품 */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">제품</h4>
              <ul className="space-y-2.5">
                {[
                  ['기능', '/features'],
                  ['상품 목록', '/products'],
                  ['요금제', '/pricing'],
                ].map(([label, href]) => (
                  <li key={href}>
                    <Link to={href} className="text-sm text-slate-400 hover:text-white transition-colors">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* 회사 */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">회사</h4>
              <ul className="space-y-2.5">
                {[
                  ['소개', '/about'],
                  ['FAQ', '/faq'],
                ].map(([label, href]) => (
                  <li key={href}>
                    <Link to={href} className="text-sm text-slate-400 hover:text-white transition-colors">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* 계정 */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">계정</h4>
              <ul className="space-y-2.5">
                {[
                  ['로그인', ssoLink('/login')],
                  ['회원가입', ssoLink('/signup')],
                  ['콘솔', consoleLink('/dashboard')],
                ].map(([label, href]) => (
                  <li key={href}>
                    <a href={href} className="text-sm text-slate-400 hover:text-white transition-colors">{label}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-600">
              © 2024 CloudPress. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">개인정보처리방침</a>
              <a href="#" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">이용약관</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
