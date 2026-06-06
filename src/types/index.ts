// 저장 위치: /src/types/index.ts

export type UserRole = 'user' | 'admin'
export type HostingType = 'cloudflare' | 'vps'
export type SiteStatus = 'active' | 'building' | 'error' | 'idle'
export type NSStatus = 'pending' | 'active' | 'failed'
export type SSLStatus = 'active' | 'issuing' | 'inactive'
export type VPSProvider = 'aws' | 'vultr' | 'digitalocean'

export interface Profile {
  id: string
  user_id: string
  name: string
  avatar_url?: string
  role: UserRole
  cf_api_key_encrypted?: string
  cf_email?: string
  gh_token_encrypted?: string
  plan_id?: string
  created_at: string
}

export interface Site {
  id: string
  user_id: string
  name: string
  product_type: string
  hosting_type: HostingType
  subdomain: string
  github_repo_url?: string
  cf_pages_url?: string
  ec2_instance_id?: string
  ec2_public_ip?: string
  ec2_region?: string
  wp_admin_url?: string
  vps_provider?: VPSProvider
  status: SiteStatus
  plan: string
  created_at: string
  last_deployed_at?: string
}

export interface Domain {
  id: string
  user_id: string
  domain: string
  cf_zone_id?: string
  nameserver_1?: string
  nameserver_2?: string
  ns_status: NSStatus
  ssl_status: SSLStatus
  connected_site_id?: string
  created_at: string
  verified_at?: string
}

export interface Deployment {
  id: string
  site_id: string
  status: 'pending' | 'running' | 'success' | 'failed'
  log?: string
  triggered_at: string
  completed_at?: string
}

export interface Product {
  id: string
  name: string
  description: string
  category: string
  icon: string
  tags: string[]
  is_active: boolean
  hosting_type: 'cloudflare' | 'vps' | 'both'
  created_at: string
  updated_at: string
}

export interface Plan {
  id: string
  name: string
  price_usd: number
  max_sites: number | null
  max_domains: number | null
  storage_gb: number
  vps_spec: 'basic' | 'standard' | 'high'
  features: string[]
}

export interface Invoice {
  id: string
  user_id: string
  plan_id: string
  amount: number
  paypal_order_id: string
  status: 'pending' | 'paid' | 'failed'
  created_at: string
}

export interface AdminSetting {
  key: string
  value: string
}

export interface AuditLog {
  id: string
  admin_id: string
  action: string
  target_type: string
  target_id: string
  created_at: string
}

export interface ConversionJob {
  id: string
  site_id: string
  user_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  input_type: 'zip' | 'url'
  total_files?: number
  converted?: number
  stubs?: number
  warnings?: number
  created_at: string
}

// 마법사 단계 타입
export interface WizardStep {
  id: number
  label: string
  completed: boolean
  active: boolean
}

// VPS 서버 사양
export interface VPSSpec {
  id: string
  label: string
  vcpu: number
  ram: string
  ssd: string
  plan: string
  price_usd: number
}

export const VPS_SPECS: VPSSpec[] = [
  { id: 'basic', label: '기본', vcpu: 1, ram: '1GB', ssd: '20GB', plan: '스타터', price_usd: 9 },
  { id: 'standard', label: '표준', vcpu: 2, ram: '2GB', ssd: '40GB', plan: '프로', price_usd: 29 },
  { id: 'high', label: '고성능', vcpu: 4, ram: '8GB', ssd: '100GB', plan: '비즈니스', price_usd: 79 },
]

// 상품 카탈로그 (24개) - 정적 정의
export const PRODUCT_CATALOG = [
  // 카테고리 1: 워드프레스 호스팅
  {
    id: 'wordpress_cf',
    name: 'Cloudflare 기반 WordPress 호스팅',
    description: 'PHP→Astro+TS 자동 변환, GitHub+Cloudflare 서버리스 배포',
    category: '워드프레스 호스팅',
    icon: '☁️',
    tags: ['인기', '추천', '서버리스'],
    hosting_type: 'cloudflare' as const,
    is_active: true,
  },
  {
    id: 'wordpress_vps',
    name: 'VPS 기반 WordPress 호스팅',
    description: '실제 PHP+MySQL WordPress 환경, SSH 접근 가능',
    category: '워드프레스 호스팅',
    icon: '🖥️',
    tags: ['강력한 성능', '완전한 WordPress'],
    hosting_type: 'vps' as const,
    is_active: true,
  },
  // 카테고리 2: 웹사이트 빌더
  {
    id: 'blog',
    name: '블로그',
    description: 'Markdown/MDX 정적 블로그, SEO 최적화',
    category: '웹사이트 빌더',
    icon: '📝',
    tags: ['SEO', 'MDX'],
    hosting_type: 'cloudflare' as const,
    is_active: true,
  },
  {
    id: 'portfolio',
    name: '포트폴리오 사이트',
    description: '개발자/디자이너용, GitHub 프로젝트 자동 연동',
    category: '웹사이트 빌더',
    icon: '🎨',
    tags: ['GitHub 연동'],
    hosting_type: 'cloudflare' as const,
    is_active: true,
  },
  {
    id: 'landing',
    name: '랜딩페이지 빌더',
    description: '전환율 최적화, A/B 테스트 기능',
    category: '웹사이트 빌더',
    icon: '🚀',
    tags: ['A/B 테스트', '전환 최적화'],
    hosting_type: 'cloudflare' as const,
    is_active: true,
  },
  {
    id: 'linkinbio',
    name: '링크인바이오 페이지',
    description: 'SNS 프로필 링크 모음, 커스텀 도메인 연결',
    category: '웹사이트 빌더',
    icon: '🔗',
    tags: ['SNS', '링크 모음'],
    hosting_type: 'cloudflare' as const,
    is_active: true,
  },
  {
    id: 'company',
    name: '기업 홈페이지',
    description: '회사 소개, 팀 소개, 연락처 폼, 다국어 지원',
    category: '웹사이트 빌더',
    icon: '🏢',
    tags: ['다국어', '기업용'],
    hosting_type: 'cloudflare' as const,
    is_active: true,
  },
  {
    id: 'resume',
    name: '이력서/CV 사이트',
    description: '온라인 이력서, PDF 내보내기',
    category: '웹사이트 빌더',
    icon: '📄',
    tags: ['PDF 내보내기'],
    hosting_type: 'cloudflare' as const,
    is_active: true,
  },
  // 카테고리 3: 쇼핑몰 / 커머스
  {
    id: 'shop',
    name: '쇼핑몰',
    description: 'WooCommerce PHP 코드 자동 변환, PayPal/Stripe 결제 연동',
    category: '쇼핑몰 / 커머스',
    icon: '🛍️',
    tags: ['WooCommerce', '결제 연동'],
    hosting_type: 'cloudflare' as const,
    is_active: true,
  },
  {
    id: 'digital_goods',
    name: '디지털 상품 판매 사이트',
    description: 'PDF, 영상, 소프트웨어 판매, 자동 다운로드 링크',
    category: '쇼핑몰 / 커머스',
    icon: '💾',
    tags: ['디지털 판매', '자동 배송'],
    hosting_type: 'cloudflare' as const,
    is_active: true,
  },
  {
    id: 'booking',
    name: '예약/예매 사이트',
    description: '서비스 예약, 티켓 판매, 캘린더 연동',
    category: '쇼핑몰 / 커머스',
    icon: '📅',
    tags: ['예약', '캘린더'],
    hosting_type: 'cloudflare' as const,
    is_active: true,
  },
  {
    id: 'membership',
    name: '구독 멤버십 사이트',
    description: '유료 콘텐츠 잠금, 멤버십 등급 관리',
    category: '쇼핑몰 / 커머스',
    icon: '👑',
    tags: ['멤버십', '구독'],
    hosting_type: 'cloudflare' as const,
    is_active: true,
  },
  // 카테고리 4: 비즈니스 도구
  {
    id: 'newsletter',
    name: '뉴스레터 구독 페이지',
    description: '이메일 수집, Mailchimp/Resend 연동',
    category: '비즈니스 도구',
    icon: '📧',
    tags: ['Mailchimp', 'Resend'],
    hosting_type: 'cloudflare' as const,
    is_active: true,
  },
  {
    id: 'form_builder',
    name: '설문/폼 빌더 사이트',
    description: '커스텀 폼 생성, 응답 수집 및 분석',
    category: '비즈니스 도구',
    icon: '📋',
    tags: ['설문', '데이터 수집'],
    hosting_type: 'cloudflare' as const,
    is_active: true,
  },
  {
    id: 'event',
    name: '이벤트 페이지',
    description: '행사 안내, 참가 신청, 카운트다운',
    category: '비즈니스 도구',
    icon: '🎉',
    tags: ['이벤트', '카운트다운'],
    hosting_type: 'cloudflare' as const,
    is_active: true,
  },
  {
    id: 'admin_dashboard',
    name: '대시보드/어드민 사이트',
    description: '내부 관리자 도구, 데이터 시각화',
    category: '비즈니스 도구',
    icon: '📊',
    tags: ['대시보드', '데이터 시각화'],
    hosting_type: 'cloudflare' as const,
    is_active: true,
  },
  // 카테고리 5: 콘텐츠 & 미디어
  {
    id: 'gallery',
    name: '사진 갤러리 / 포토그래퍼 사이트',
    description: '고해상도 이미지 최적화, Cloudflare Images 연동',
    category: '콘텐츠 & 미디어',
    icon: '📸',
    tags: ['갤러리', 'Cloudflare Images'],
    hosting_type: 'cloudflare' as const,
    is_active: true,
  },
  {
    id: 'youtube',
    name: '유튜브/영상 채널 사이트',
    description: 'YouTube API 연동, 영상 임베드 자동화',
    category: '콘텐츠 & 미디어',
    icon: '🎥',
    tags: ['YouTube API', '영상'],
    hosting_type: 'cloudflare' as const,
    is_active: true,
  },
  {
    id: 'podcast',
    name: '팟캐스트 사이트',
    description: '에피소드 관리, RSS 피드 자동 생성',
    category: '콘텐츠 & 미디어',
    icon: '🎙️',
    tags: ['RSS', '팟캐스트'],
    hosting_type: 'cloudflare' as const,
    is_active: true,
  },
  {
    id: 'wiki',
    name: '문서/위키 사이트',
    description: 'Notion 스타일 문서 관리, 검색 기능 내장',
    category: '콘텐츠 & 미디어',
    icon: '📚',
    tags: ['위키', '문서'],
    hosting_type: 'cloudflare' as const,
    is_active: true,
  },
  // 카테고리 6: 개발자 도구
  {
    id: 'api_docs',
    name: 'API 문서 사이트',
    description: 'OpenAPI/Swagger 자동 문서화',
    category: '개발자 도구',
    icon: '📖',
    tags: ['OpenAPI', 'Swagger'],
    hosting_type: 'cloudflare' as const,
    is_active: true,
  },
  {
    id: 'opensource',
    name: '오픈소스 프로젝트 페이지',
    description: 'GitHub README 자동 연동, 기여자 목록',
    category: '개발자 도구',
    icon: '💻',
    tags: ['오픈소스', 'GitHub'],
    hosting_type: 'cloudflare' as const,
    is_active: true,
  },
  {
    id: 'status_page',
    name: '상태 페이지',
    description: '서비스 운영 현황 실시간 표시, 장애 공지',
    category: '개발자 도구',
    icon: '🟢',
    tags: ['상태 모니터링', '장애 공지'],
    hosting_type: 'cloudflare' as const,
    is_active: true,
  },
  {
    id: 'dev_blog',
    name: '개발 블로그 + 코드 하이라이팅',
    description: 'Shiki 문법 강조, GitHub Gist 연동',
    category: '개발자 도구',
    icon: '✍️',
    tags: ['Shiki', 'GitHub Gist'],
    hosting_type: 'cloudflare' as const,
    is_active: true,
  },
]

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: '스타터',
    price_usd: 9,
    max_sites: 1,
    max_domains: 1,
    storage_gb: 5,
    vps_spec: 'basic',
    features: ['1개 사이트', '1개 도메인', '5GB 저장용량', '기본 VPS 사양', 'Cloudflare CDN', '무료 SSL'],
  },
  {
    id: 'pro',
    name: '프로',
    price_usd: 29,
    max_sites: 5,
    max_domains: 5,
    storage_gb: 20,
    vps_spec: 'standard',
    features: ['5개 사이트', '5개 도메인', '20GB 저장용량', '표준 VPS 사양', '우선 지원', 'PHP→Astro 자동 변환'],
  },
  {
    id: 'business',
    name: '비즈니스',
    price_usd: 79,
    max_sites: null,
    max_domains: null,
    storage_gb: 100,
    vps_spec: 'high',
    features: ['무제한 사이트', '무제한 도메인', '100GB 저장용량', '고성능 VPS 사양', '전용 지원', '고급 분석'],
  },
]