// src/pages/landing/AboutPage.tsx
import { Link } from 'react-router-dom'
import { zoneOrigin, isProd } from '@/lib/domainRouter'

function ssoLink(p: string) { return isProd() ? `${zoneOrigin('sso')}${p}` : `/sso${p}` }

const VALUES = [
  {
    icon: '🚀',
    title: '단순함',
    desc: '복잡한 인프라 설정 없이 누구나 3분 안에 배포할 수 있어야 합니다.',
  },
  {
    icon: '🔒',
    title: '신뢰성',
    desc: '99.9% SLA와 Cloudflare 기반 인프라로 항상 안정적인 서비스를 제공합니다.',
  },
  {
    icon: '💡',
    title: '혁신',
    desc: 'WordPress의 자산을 버리지 않고, 최신 서버리스 기술로 전환할 수 있게 합니다.',
  },
  {
    icon: '🤝',
    title: '투명성',
    desc: '숨겨진 비용 없음. 사용한 만큼만 지불하는 단순한 요금 구조.',
  },
]

const TIMELINE = [
  { year: '2023', title: '창업', desc: 'WordPress 마이그레이션의 어려움을 직접 겪고 CloudPress를 시작했습니다.' },
  { year: '2024 Q1', title: 'Cloudflare Workers 통합', desc: '서버리스 아키텍처로 전환해 배포 시간을 90% 단축했습니다.' },
  { year: '2024 Q2', title: '24개 템플릿 출시', desc: 'WordPress부터 쇼핑몰까지 다양한 프리셋 템플릿을 출시했습니다.' },
  { year: '2024 Q3', title: 'D1 데이터베이스 지원', desc: 'Cloudflare D1으로 서버리스 SQLite를 완전 지원합니다.' },
]

export function AboutPage() {
  return (
    <div className="px-6 py-20">
      {/* 헤더 */}
      <div className="max-w-3xl mx-auto text-center mb-20">
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6">
          <span className="text-xs text-slate-400 font-medium">회사 소개</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white mb-5 leading-tight">
          웹 배포를<br />
          <span className="bg-gradient-to-r from-[#0070f3] to-[#00d4ff] bg-clip-text text-transparent">누구나 쉽게</span>
        </h1>
        <p className="text-slate-400 text-lg leading-relaxed">
          CloudPress는 기술적 장벽 없이 누구나 전세계에 웹 서비스를 배포할 수 있는 세상을 만듭니다.
        </p>
      </div>

      {/* 미션 */}
      <div className="max-w-4xl mx-auto mb-24">
        <div className="bg-gradient-to-br from-[#0070f3]/10 to-transparent border border-[#0070f3]/20 rounded-3xl p-10 text-center">
          <div className="text-4xl mb-4">☁️</div>
          <h2 className="text-2xl font-black text-white mb-4">우리의 미션</h2>
          <p className="text-slate-300 text-lg leading-relaxed max-w-2xl mx-auto">
            "모든 개발자와 창업자가 서버 운영의 부담 없이, 아이디어를 즉시 전세계에 배포할 수 있게 한다."
          </p>
        </div>
      </div>

      {/* 핵심 가치 */}
      <div className="max-w-5xl mx-auto mb-24">
        <h2 className="text-2xl font-black text-white text-center mb-12">핵심 가치</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {VALUES.map(({ icon, title, desc }) => (
            <div key={title} className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 text-center hover:border-white/15 transition-all">
              <div className="text-3xl mb-3">{icon}</div>
              <h3 className="font-bold text-white mb-2 text-sm">{title}</h3>
              <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 연혁 */}
      <div className="max-w-2xl mx-auto mb-24">
        <h2 className="text-2xl font-black text-white text-center mb-12">성장 스토리</h2>
        <div className="relative">
          {/* 타임라인 선 */}
          <div className="absolute left-[5.5rem] top-0 bottom-0 w-px bg-white/10" />
          <div className="space-y-8">
            {TIMELINE.map(({ year, title, desc }) => (
              <div key={year} className="flex gap-6">
                <div className="w-20 flex-shrink-0 text-right">
                  <span className="text-xs font-semibold text-[#0070f3]">{year}</span>
                </div>
                <div className="relative">
                  <div className="absolute -left-[1.4rem] top-1 w-2.5 h-2.5 rounded-full bg-[#0070f3] border-2 border-[#060810]" />
                  <div className="pl-2">
                    <div className="font-bold text-white text-sm mb-1">{title}</div>
                    <div className="text-slate-500 text-xs leading-relaxed">{desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 기술 스택 */}
      <div className="max-w-3xl mx-auto mb-24">
        <h2 className="text-2xl font-black text-white text-center mb-12">기반 기술</h2>
        <div className="flex flex-wrap gap-3 justify-center">
          {['Cloudflare Workers', 'Cloudflare D1', 'Cloudflare Pages', 'Cloudflare R2', 'Astro', 'TypeScript', 'React', 'Vite', 'Tailwind CSS', 'PayPal SDK', 'GitHub API', 'Web Crypto API'].map((tech) => (
            <span key={tech} className="bg-white/5 border border-white/10 text-slate-300 text-sm px-4 py-2 rounded-lg">
              {tech}
            </span>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-2xl font-black text-white mb-4">함께 만들어 가요</h2>
        <p className="text-slate-400 mb-8">CloudPress와 함께 더 빠르고, 더 안전하고, 더 저렴하게 배포하세요.</p>
        <a href={ssoLink('/signup')} className="inline-flex items-center gap-2 bg-[#0070f3] hover:bg-[#0060d8] text-white font-semibold px-7 py-3 rounded-xl transition-all text-sm">
          무료로 시작하기 →
        </a>
      </div>
    </div>
  )
}
