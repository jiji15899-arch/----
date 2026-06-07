// src/pages/landing/FeaturesPage.tsx
import { Link } from 'react-router-dom'
import { zoneOrigin, isProd } from '@/lib/domainRouter'

function ssoLink(p: string) { return isProd() ? `${zoneOrigin('sso')}${p}` : `/sso${p}` }

const FEATURE_SECTIONS = [
  {
    category: '배포 & 인프라',
    icon: '⚡',
    color: '#0070f3',
    features: [
      { title: 'Cloudflare Workers 서버리스', desc: '전세계 275개 엣지 노드에 자동 분산 배포. 콜드 스타트 없는 즉각 응답.' },
      { title: 'Cloudflare Pages 통합', desc: '정적 사이트 및 SSR 앱을 Cloudflare Pages에 원클릭 배포.' },
      { title: 'VPS 호스팅 지원', desc: 'AWS, Vultr, DigitalOcean 등 주요 VPS에 서버 자동 프로비저닝.' },
      { title: 'GitHub 연동 CI/CD', desc: 'GitHub 저장소 생성부터 자동 배포 파이프라인까지 자동 구성.' },
    ],
  },
  {
    category: '도메인 & SSL',
    icon: '🌐',
    color: '#00d4ff',
    features: [
      { title: 'Cloudflare DNS 자동 연동', desc: '도메인 구매 후 Nameserver만 변경하면 5분 내 연결 완료.' },
      { title: '무료 SSL 인증서', desc: 'Let\'s Encrypt 기반 SSL 자동 발급 및 갱신. 모든 플랜 포함.' },
      { title: 'Cloudflare Proxy 보호', desc: 'DDoS 방어, 봇 필터링, 캐시 최적화가 자동 적용됩니다.' },
      { title: '서브도메인 무제한', desc: '하나의 도메인으로 여러 사이트를 서브도메인으로 분리 운영.' },
    ],
  },
  {
    category: 'WordPress 변환',
    icon: '🔄',
    color: '#7c3aed',
    features: [
      { title: 'PHP → Astro 자동 변환', desc: '기존 WordPress PHP 테마를 Astro + TypeScript로 자동 변환.' },
      { title: 'WooCommerce 마이그레이션', desc: '쇼핑몰 상품, 주문, 결제 로직을 서버리스 구조로 전환.' },
      { title: 'ZIP 업로드 지원', desc: 'WordPress 익스포트 파일을 직접 업로드해 즉시 변환 시작.' },
      { title: '변환 리포트 제공', desc: '변환된 파일, 수동 확인 필요 항목을 상세 보고서로 제공.' },
    ],
  },
  {
    category: '데이터베이스 & 스토리지',
    icon: '🗄️',
    color: '#059669',
    features: [
      { title: 'Cloudflare D1 (SQLite)', desc: '서버리스 SQLite 데이터베이스. 별도 DB 서버 없이 글로벌 분산 쿼리.' },
      { title: 'Cloudflare KV 스토리지', desc: '엣지 키-값 저장소로 초저지연 데이터 읽기.' },
      { title: 'R2 오브젝트 스토리지', desc: '이미지, 파일 업로드를 위한 S3 호환 스토리지. egress 비용 없음.' },
      { title: '자동 백업', desc: '일별 자동 백업으로 데이터 보호. 언제든 롤백 가능.' },
    ],
  },
  {
    category: '결제 & 커머스',
    icon: '💳',
    color: '#f59e0b',
    features: [
      { title: 'PayPal 결제 연동', desc: 'PayPal SDK 내장. 결제 버튼 5분 만에 추가.' },
      { title: '구독 멤버십 관리', desc: '정기 결제, 멤버십 등급, 콘텐츠 잠금 기능 내장.' },
      { title: 'PayPal 웹훅 처리', desc: '결제 완료, 취소 등 이벤트를 Worker에서 자동 처리.' },
      { title: '인보이스 자동 발행', desc: '결제 완료 시 인보이스 자동 생성 및 이메일 발송.' },
    ],
  },
  {
    category: '보안 & 인증',
    icon: '🛡️',
    color: '#ef4444',
    features: [
      { title: 'JWT 기반 인증', desc: 'Web Crypto API를 사용한 서버리스 JWT. 외부 라이브러리 없이 구현.' },
      { title: 'PBKDF2 비밀번호 해싱', desc: '100,000 이터레이션 PBKDF2로 안전한 비밀번호 저장.' },
      { title: 'CORS 및 CSP 자동 설정', desc: '보안 헤더가 모든 응답에 자동 적용됩니다.' },
      { title: '관리자 감사 로그', desc: '모든 관리자 작업이 타임스탬프와 함께 기록됩니다.' },
    ],
  },
]

export function FeaturesPage() {
  return (
    <div className="px-6 py-20">
      {/* 헤더 */}
      <div className="max-w-3xl mx-auto text-center mb-20">
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6">
          <span className="text-xs text-slate-400 font-medium">기능 소개</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white mb-5 leading-tight">
          모든 기능이<br />
          <span className="bg-gradient-to-r from-[#0070f3] to-[#00d4ff] bg-clip-text text-transparent">하나의 플랫폼</span>에
        </h1>
        <p className="text-slate-400 text-lg leading-relaxed">
          배포부터 결제, 도메인, 보안까지. 웹 서비스 운영에 필요한 모든 것을 제공합니다.
        </p>
      </div>

      {/* 기능 섹션들 */}
      <div className="max-w-6xl mx-auto space-y-20">
        {FEATURE_SECTIONS.map(({ category, icon, color, features }) => (
          <div key={category}>
            <div className="flex items-center gap-3 mb-8">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: `${color}20`, border: `1px solid ${color}30` }}
              >
                {icon}
              </div>
              <h2 className="text-xl font-bold text-white">{category}</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {features.map(({ title, desc }) => (
                <div
                  key={title}
                  className="bg-white/[0.03] border border-white/8 rounded-xl p-5 hover:border-white/15 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} />
                    <div>
                      <div className="font-semibold text-white text-sm mb-1">{title}</div>
                      <div className="text-slate-500 text-xs leading-relaxed">{desc}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="max-w-2xl mx-auto text-center mt-24">
        <h2 className="text-2xl font-black text-white mb-4">직접 경험해보세요</h2>
        <p className="text-slate-400 mb-8">모든 기능을 무료 플랜으로 14일간 체험할 수 있습니다.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href={ssoLink('/signup')} className="inline-flex items-center justify-center gap-2 bg-[#0070f3] hover:bg-[#0060d8] text-white font-semibold px-7 py-3 rounded-xl transition-all text-sm">
            무료 시작하기 →
          </a>
          <Link to="/pricing" className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-7 py-3 rounded-xl transition-all text-sm">
            요금제 비교
          </Link>
        </div>
      </div>
    </div>
  )
}
