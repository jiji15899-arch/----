// src/pages/landing/FaqPage.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { zoneOrigin, isProd } from '@/lib/domainRouter'

function ssoLink(p: string) { return isProd() ? `${zoneOrigin('sso')}${p}` : `/sso${p}` }

const FAQ_GROUPS = [
  {
    group: '시작하기',
    items: [
      {
        q: 'CloudPress를 사용하려면 기술 지식이 필요한가요?',
        a: '아니요. CloudPress는 비개발자도 쉽게 사용할 수 있도록 설계되었습니다. 마법사 형태의 단계별 안내를 따라가면 코드 없이 3분 안에 배포가 완료됩니다. GitHub 계정이 있으면 더욱 풍부한 기능을 활용할 수 있습니다.',
      },
      {
        q: '무료로 사용할 수 있나요?',
        a: '네. 무료 플랜을 영구적으로 제공합니다. 무료 플랜에서는 1개 사이트, 1개 도메인, 5GB 스토리지를 사용할 수 있습니다. 신용카드 없이도 가입 즉시 시작할 수 있습니다.',
      },
      {
        q: '도메인이 없어도 시작할 수 있나요?',
        a: '네. 별도 도메인 없이도 *.pages.dev 서브도메인을 무료로 제공합니다. 이후 원하는 커스텀 도메인을 연결하는 것도 간단합니다.',
      },
    ],
  },
  {
    group: 'WordPress 마이그레이션',
    items: [
      {
        q: 'WordPress 사이트를 어떻게 옮기나요?',
        a: 'WordPress 관리자에서 콘텐츠를 ZIP으로 내보낸 뒤 CloudPress에 업로드하면 됩니다. 자동 변환 엔진이 PHP 템플릿을 Astro + TypeScript로 변환합니다. 변환 리포트를 통해 수동 확인이 필요한 항목을 명확히 안내합니다.',
      },
      {
        q: 'WooCommerce 쇼핑몰도 이전할 수 있나요?',
        a: '네. WooCommerce의 상품, 주문, 결제 로직을 서버리스 구조로 전환합니다. PayPal 결제는 자동 연동되며, 다른 결제 수단은 추가 설정이 필요합니다.',
      },
      {
        q: '플러그인은 어떻게 되나요?',
        a: '모든 WordPress 플러그인이 완벽하게 변환되지는 않습니다. 변환 리포트에서 지원되는 플러그인과 대안을 확인할 수 있습니다. 핵심 기능(SEO, 폼, 갤러리 등)은 대부분 지원됩니다.',
      },
    ],
  },
  {
    group: '도메인 & SSL',
    items: [
      {
        q: 'Cloudflare 계정이 없어도 도메인 연결이 가능한가요?',
        a: 'CloudPress 콘솔에서 Cloudflare API 키를 등록하면 도메인 Zone 생성과 DNS 설정을 자동으로 처리합니다. 이미 Cloudflare를 사용 중이라면 기존 계정을 연동할 수 있습니다.',
      },
      {
        q: 'SSL 인증서는 자동으로 발급되나요?',
        a: '네. Cloudflare Universal SSL이 자동으로 적용됩니다. 도메인 활성화 후 수 분 내에 HTTPS가 적용되며, 갱신도 자동으로 처리됩니다.',
      },
    ],
  },
  {
    group: '요금 & 결제',
    items: [
      {
        q: '언제든 플랜을 변경하거나 취소할 수 있나요?',
        a: '네. 언제든 플랜 업그레이드 또는 다운그레이드가 가능합니다. 취소 시 현재 결제 주기 종료 후 해지됩니다. 위약금이나 해지 수수료는 없습니다.',
      },
      {
        q: '어떤 결제 수단을 지원하나요?',
        a: '현재 PayPal을 통한 결제를 지원합니다. 신용카드, 체크카드, PayPal 잔액 등 PayPal에서 지원하는 모든 결제 수단을 사용할 수 있습니다.',
      },
      {
        q: '사용량 초과 시 어떻게 되나요?',
        a: '플랜 한도 도달 시 서비스가 중단되는 것이 아니라, 업그레이드 안내 알림을 받게 됩니다. 여유 있는 업그레이드가 가능하도록 사전에 충분한 경고를 드립니다.',
      },
    ],
  },
  {
    group: '보안 & 데이터',
    items: [
      {
        q: '내 데이터는 어디에 저장되나요?',
        a: 'Cloudflare D1(SQLite)과 R2 오브젝트 스토리지에 저장됩니다. 모든 데이터는 암호화되어 전송되며, 비밀번호는 PBKDF2 알고리즘으로 해싱되어 저장됩니다.',
      },
      {
        q: 'DDoS 공격으로부터 보호되나요?',
        a: '네. Cloudflare의 엔터프라이즈급 DDoS 방어가 모든 플랜에 기본 포함됩니다. 봇 필터링, 레이트 리미팅, WAF 기능이 자동으로 적용됩니다.',
      },
    ],
  },
]

function AccordionItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`border border-white/8 rounded-xl overflow-hidden transition-colors ${open ? 'border-white/15' : 'hover:border-white/12'}`}>
      <button
        className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left"
        onClick={() => setOpen(v => !v)}
      >
        <span className="font-medium text-white text-sm">{q}</span>
        <svg
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-6 pb-5 text-slate-400 text-sm leading-relaxed border-t border-white/5 pt-4">
          {a}
        </div>
      )}
    </div>
  )
}

export function FaqPage() {
  return (
    <div className="px-6 py-20">
      {/* 헤더 */}
      <div className="max-w-2xl mx-auto text-center mb-16">
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6">
          <span className="text-xs text-slate-400 font-medium">자주 묻는 질문</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white mb-5">
          FAQ
        </h1>
        <p className="text-slate-400">
          궁금한 점이 있으신가요? 아래에서 빠르게 답을 찾아보세요.
        </p>
      </div>

      {/* FAQ 그룹 */}
      <div className="max-w-3xl mx-auto space-y-12">
        {FAQ_GROUPS.map(({ group, items }) => (
          <div key={group}>
            <h2 className="text-sm font-semibold text-[#0070f3] uppercase tracking-wider mb-4">{group}</h2>
            <div className="space-y-3">
              {items.map(({ q, a }) => (
                <AccordionItem key={q} q={q} a={a} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 추가 문의 */}
      <div className="max-w-2xl mx-auto mt-20 text-center">
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-10">
          <div className="text-3xl mb-4">💬</div>
          <h2 className="text-xl font-bold text-white mb-3">아직 궁금한 게 있으신가요?</h2>
          <p className="text-slate-400 text-sm mb-6">
            원하는 답변을 찾지 못하셨다면 직접 문의해주세요. 빠르게 도움드리겠습니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="mailto:support@cloud-press.co.kr" className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium px-6 py-2.5 rounded-lg transition-all text-sm">
              📧 이메일 문의
            </a>
            <a href={ssoLink('/signup')} className="inline-flex items-center justify-center gap-2 bg-[#0070f3] hover:bg-[#0060d8] text-white font-semibold px-6 py-2.5 rounded-lg transition-all text-sm">
              무료로 시작하기 →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
