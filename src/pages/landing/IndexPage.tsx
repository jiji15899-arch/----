// src/pages/landing/IndexPage.tsx
import { Link } from 'react-router-dom'
import { zoneOrigin, isProd } from '@/lib/domainRouter'
import { PRODUCT_CATALOG, PLANS } from '@/types'

function ssoLink(path: string) {
  return isProd() ? `${zoneOrigin('sso')}${path}` : `/sso${path}`
}

const STATS = [
  { value: '24+', label: '제품 템플릿' },
  { value: '99.9%', label: '업타임 SLA' },
  { value: '3분', label: '평균 배포 시간' },
  { value: '무료', label: 'SSL 인증서' },
]

const HIGHLIGHTS = [
  {
    icon: '⚡',
    title: '서버리스 배포',
    desc: 'Cloudflare Workers 기반. 서버 관리 없이 전세계 275개 엣지 노드에 즉시 배포됩니다.',
  },
  {
    icon: '🔄',
    title: 'WordPress 자동 변환',
    desc: '기존 PHP 코드를 Astro + TypeScript로 자동 변환. 기존 자산을 그대로 활용하세요.',
  },
  {
    icon: '🌐',
    title: '커스텀 도메인',
    desc: 'Cloudflare DNS 연동으로 도메인 연결 5분 완료. 자동 SSL 발급 포함.',
  },
  {
    icon: '🛡️',
    title: 'DDoS 방어 내장',
    desc: 'Cloudflare의 기업급 보안이 모든 플랜에 기본 포함됩니다.',
  },
]

// 상품 중 인기 카테고리 8개만
const FEATURED = PRODUCT_CATALOG.slice(0, 8)

export function IndexPage() {
  return (
    <div className="overflow-hidden">
      {/* ── 히어로 ── */}
      <section className="relative min-h-[92vh] flex items-center justify-center px-6">
        {/* 배경 글로우 */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-[#0070f3]/10 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 left-1/4 w-[400px] h-[400px] bg-[#00d4ff]/5 rounded-full blur-[100px]" />
        </div>

        {/* 그리드 패턴 */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0070f3] animate-pulse" />
            <span className="text-xs text-slate-400 font-medium">Cloudflare 엣지 네트워크 기반 호스팅 플랫폼</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black leading-[1.05] tracking-tight mb-6">
            <span className="block text-white">서버 없이</span>
            <span className="block bg-gradient-to-r from-[#0070f3] via-[#00d4ff] to-[#0070f3] bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer_3s_linear_infinite]">
              전세계에 배포
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10">
            WordPress, 쇼핑몰, 블로그, 포트폴리오 — 24가지 템플릿으로<br className="hidden md:block" />
            3분 만에 Cloudflare 엣지에 배포하세요.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={ssoLink('/signup')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#0070f3] hover:bg-[#0060d8] text-white font-semibold px-8 py-3.5 rounded-xl transition-all hover:shadow-[0_0_30px_rgba(0,112,243,0.4)] text-base"
            >
              무료로 시작하기
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
            <Link
              to="/products"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-8 py-3.5 rounded-xl transition-all text-base"
            >
              템플릿 보기
            </Link>
          </div>

          {/* 신뢰 배지 */}
          <p className="mt-6 text-xs text-slate-600">
            신용카드 불필요 · 무료 플랜 영구 제공 · 언제든 업그레이드
          </p>
        </div>
      </section>

      {/* ── 통계 ── */}
      <section className="border-y border-white/5 py-14">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="text-4xl font-black text-white mb-1">{value}</div>
              <div className="text-sm text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 핵심 기능 ── */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              왜 CloudPress인가요?
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              기존 웹호스팅의 복잡함 없이, 엔터프라이즈급 인프라를 누구나.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {HIGHLIGHTS.map(({ icon, title, desc }) => (
              <div
                key={title}
                className="group bg-white/[0.03] hover:bg-white/[0.06] border border-white/8 hover:border-white/15 rounded-2xl p-6 transition-all duration-300"
              >
                <div className="text-3xl mb-4">{icon}</div>
                <h3 className="font-bold text-white mb-2 text-sm">{title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link to="/features" className="text-sm text-[#0070f3] hover:text-[#00d4ff] font-medium transition-colors">
              전체 기능 보기 →
            </Link>
          </div>
        </div>
      </section>

      {/* ── 상품 미리보기 ── */}
      <section className="py-24 px-6 bg-gradient-to-b from-transparent to-white/[0.02]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              24가지 템플릿
            </h2>
            <p className="text-slate-400">
              WordPress, 쇼핑몰, 블로그, 포트폴리오… 뭐든 바로 시작하세요.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {FEATURED.map((p) => (
              <Link
                key={p.id}
                to="/products"
                className="group bg-white/[0.03] hover:bg-white/[0.07] border border-white/8 hover:border-[#0070f3]/30 rounded-xl p-5 transition-all duration-200"
              >
                <div className="text-2xl mb-3">{p.icon}</div>
                <div className="font-semibold text-white text-sm mb-1 leading-tight">{p.name}</div>
                <div className="text-xs text-slate-500 line-clamp-2">{p.description}</div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {p.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-[#0070f3]/10 text-[#0070f3] border border-[#0070f3]/20">
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium px-6 py-2.5 rounded-lg transition-all text-sm"
            >
              전체 24개 템플릿 보기
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 요금제 요약 ── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">단순한 요금제</h2>
            <p className="text-slate-400">숨겨진 비용 없음. 언제든 취소 가능.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map((plan, i) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-6 border transition-all ${
                  i === 1
                    ? 'bg-[#0070f3]/10 border-[#0070f3]/40 shadow-[0_0_40px_rgba(0,112,243,0.15)]'
                    : 'bg-white/[0.03] border-white/10'
                }`}
              >
                {i === 1 && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0070f3] text-white text-xs font-semibold px-3 py-1 rounded-full">
                    인기
                  </div>
                )}
                <div className="mb-4">
                  <div className="text-lg font-bold text-white">{plan.name}</div>
                  <div className="mt-2">
                    <span className="text-3xl font-black text-white">${plan.price_usd}</span>
                    <span className="text-slate-500 text-sm ml-1">/ 월</span>
                  </div>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-400">
                      <svg className="w-4 h-4 text-[#0070f3] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={ssoLink('/signup')}
                  className={`block text-center text-sm font-semibold py-2.5 rounded-lg transition-all ${
                    i === 1
                      ? 'bg-[#0070f3] hover:bg-[#0060d8] text-white'
                      : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                  }`}
                >
                  시작하기
                </a>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link to="/pricing" className="text-sm text-[#0070f3] hover:text-[#00d4ff] font-medium transition-colors">
              요금제 자세히 보기 →
            </Link>
          </div>
        </div>
      </section>

      {/* ── 하단 CTA ── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-gradient-to-br from-[#0070f3]/20 to-[#00d4ff]/10 border border-[#0070f3]/20 rounded-3xl p-12">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              지금 바로 시작하세요
            </h2>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              무료 플랜으로 시작, 필요할 때 업그레이드. 신용카드 없이도 OK.
            </p>
            <a
              href={ssoLink('/signup')}
              className="inline-flex items-center gap-2 bg-[#0070f3] hover:bg-[#0060d8] text-white font-semibold px-8 py-3.5 rounded-xl transition-all hover:shadow-[0_0_30px_rgba(0,112,243,0.4)] text-base"
            >
              무료로 시작하기 →
            </a>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
    </div>
  )
}
