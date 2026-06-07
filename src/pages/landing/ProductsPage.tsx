// src/pages/landing/ProductsPage.tsx
import { useState } from 'react'
import { zoneOrigin, isProd } from '@/lib/domainRouter'
import { PRODUCT_CATALOG } from '@/types'

function ssoLink(p: string) { return isProd() ? `${zoneOrigin('sso')}${p}` : `/sso${p}` }
function consoleLink(p: string) { return isProd() ? `${zoneOrigin('console')}${p}` : `/console${p}` }

const CATEGORIES = ['전체', ...Array.from(new Set(PRODUCT_CATALOG.map(p => p.category)))]

const HOSTING_LABEL: Record<string, string> = {
  cloudflare: '☁️ 서버리스',
  vps:        '🖥️ VPS',
  both:       '☁️/🖥️ 선택 가능',
}

export function ProductsPage() {
  const [activeCategory, setActiveCategory] = useState('전체')
  const [query, setQuery] = useState('')

  const filtered = PRODUCT_CATALOG.filter(p => {
    const matchCat = activeCategory === '전체' || p.category === activeCategory
    const matchQ   = !query || p.name.includes(query) || p.description.includes(query) || p.tags.some(t => t.includes(query))
    return matchCat && matchQ
  })

  return (
    <div className="px-6 py-20">
      {/* 헤더 */}
      <div className="max-w-3xl mx-auto text-center mb-14">
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6">
          <span className="text-xs text-slate-400 font-medium">24가지 템플릿</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white mb-5">
          무엇을 만들고 싶으세요?
        </h1>
        <p className="text-slate-400 text-lg">
          WordPress, 쇼핑몰, 블로그, 포트폴리오 — 원하는 템플릿으로 바로 시작하세요.
        </p>
      </div>

      {/* 검색 */}
      <div className="max-w-xl mx-auto mb-10">
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="템플릿 검색..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 text-sm focus:outline-none focus:border-[#0070f3]/50 focus:bg-white/8 transition-all"
          />
        </div>
      </div>

      {/* 카테고리 탭 */}
      <div className="flex flex-wrap gap-2 justify-center mb-12">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeCategory === cat
                ? 'bg-[#0070f3] text-white shadow-[0_0_15px_rgba(0,112,243,0.3)]'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/8'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 상품 그리드 */}
      <div className="max-w-7xl mx-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <div className="text-4xl mb-4">🔍</div>
            <p>검색 결과가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((product) => (
              <div
                key={product.id}
                className="group bg-white/[0.03] hover:bg-white/[0.07] border border-white/8 hover:border-[#0070f3]/25 rounded-2xl p-6 transition-all duration-200 flex flex-col"
              >
                {/* 아이콘 + 호스팅 타입 */}
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-2xl">
                    {product.icon}
                  </div>
                  <span className="text-[10px] text-slate-500 bg-white/5 border border-white/8 rounded-full px-2 py-0.5">
                    {HOSTING_LABEL[product.hosting_type]}
                  </span>
                </div>

                {/* 카테고리 */}
                <div className="text-[10px] text-[#0070f3] font-semibold uppercase tracking-wider mb-1">
                  {product.category}
                </div>

                {/* 이름 */}
                <h3 className="font-bold text-white text-sm mb-2 leading-tight">{product.name}</h3>

                {/* 설명 */}
                <p className="text-slate-500 text-xs leading-relaxed mb-4 flex-1">{product.description}</p>

                {/* 태그 */}
                <div className="flex flex-wrap gap-1 mb-5">
                  {product.tags.map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-[#0070f3]/10 text-[#0070f3] border border-[#0070f3]/15">
                      {tag}
                    </span>
                  ))}
                </div>

                {/* CTA */}
                <a
                  href={consoleLink(`/create/${product.id}`)}
                  className="block text-center text-xs font-semibold bg-white/5 group-hover:bg-[#0070f3] border border-white/10 group-hover:border-transparent text-slate-300 group-hover:text-white py-2.5 rounded-lg transition-all"
                >
                  이 템플릿으로 시작 →
                </a>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-slate-600 text-xs mt-8">
          총 {filtered.length}개의 템플릿
        </p>
      </div>

      {/* 하단 CTA */}
      <div className="max-w-2xl mx-auto text-center mt-20">
        <div className="bg-gradient-to-br from-[#0070f3]/10 to-transparent border border-[#0070f3]/20 rounded-2xl p-10">
          <h2 className="text-xl font-black text-white mb-3">원하는 템플릿이 없나요?</h2>
          <p className="text-slate-400 text-sm mb-6">
            커스텀 요청을 남겨주시면 새 템플릿 추가를 검토합니다.
          </p>
          <a href="mailto:hello@cloud-press.co.kr" className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium px-6 py-2.5 rounded-lg transition-all text-sm">
            📧 템플릿 요청하기
          </a>
        </div>
      </div>
    </div>
  )
}
