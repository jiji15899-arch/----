# 클라우드프레스 (CloudPress)

> WordPress 호스팅 플랫폼 — GitHub + Cloudflare로 자동 배포, 진짜 WordPress 제공

## 🚀 소개

클라우드프레스는 한국 시장을 위한 풀스택 WordPress 호스팅 플랫폼입니다.
사용자가 WordPress 사이트를 클릭 몇 번으로 생성하고, GitHub + Cloudflare를 통해 자동 배포할 수 있습니다.

### 주요 특징

- **진짜 WordPress** — PHP + SQLite, 플러그인/테마 100% 호환
- **서버리스 운영** — GitHub Actions + Nginx로 서버 없이 WordPress 운영
- **GitHub 기반 저장** — 모든 파일(미디어 포함)이 사용자의 GitHub 저장소에 저장
- **멀티 VPS 지원** — AWS EC2, Vultr, DigitalOcean 선택 가능
- **한국어 전용 UI** — 모든 인터페이스가 한국어

## 🛠 기술 스택

| 분류 | 기술 |
|------|------|
| Frontend | React + TypeScript + Tailwind CSS |
| Backend | Supabase (Auth, Database, Edge Functions) |
| 배포 A | GitHub Actions + Nginx (서버리스 WordPress) |
| 배포 B | AWS EC2 / Vultr / DigitalOcean (VPS) |
| 결제 | PayPal SDK |
| 폰트 | Noto Sans KR |
| 아이콘 | lucide-react |

## 📁 프로젝트 구조

```
cloudpress/
├── index.html                          # Vite 진입점
├── public/
│   └── favicon.svg                     # 파비콘
├── src/
│   ├── App.tsx                         # 라우터 설정
│   ├── main.tsx                        # React 진입점
│   ├── index.css                       # 전역 스타일 (Tailwind)
│   ├── types/
│   │   └── index.ts                    # 타입 정의 + PRODUCT_CATALOG + PLANS
│   ├── store/
│   │   ├── authStore.ts                # Zustand 인증 상태
│   │   └── toastStore.ts               # Zustand 토스트 상태
│   ├── lib/
│   │   ├── supabase.ts                 # Supabase 클라이언트 + DB 헬퍼
│   │   ├── api.ts                      # Edge Function 호출 헬퍼
│   │   └── utils.ts                    # 유틸리티 함수
│   ├── hooks/
│   │   ├── useAuth.ts                  # 인증 훅
│   │   ├── useSites.ts                 # 사이트 데이터 훅
│   │   └── useDomains.ts               # 도메인 데이터 훅
│   ├── components/
│   │   ├── ui/                         # 공통 UI 컴포넌트
│   │   │   ├── Badge.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── CopyButton.tsx
│   │   │   ├── EmptySpace.tsx
│   │   │   ├── HostingBadge.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Spinner.tsx             # Spinner + LoadingPage
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── Textarea.tsx
│   │   │   ├── Toast.tsx
│   │   │   └── Toggle.tsx
│   │   ├── dashboard/
│   │   │   ├── DashboardLayout.tsx     # 전체 레이아웃
│   │   │   └── Sidebar.tsx             # 사이드바 네비게이션
│   │   ├── sites/
│   │   │   ├── SIteCard.tsx            # 사이트 카드
│   │   │   └── VPSPanel.tsx            # VPS 관리 패널
│   │   ├── wizard/
│   │   │   ├── DeployProgress.tsx      # 배포 진행 표시
│   │   │   └── StepIndicator.tsx       # 단계 인디케이터
│   │   └── conversion/
│   │       └── ConversionEngine.tsx    # PHP→Astro 변환 엔진 UI
│   └── pages/
│       ├── AuthPage.tsx                # 로그인/회원가입
│       ├── DashboardPage.tsx           # 메인 대시보드
│       ├── SitesPage.tsx               # 내 사이트 목록
│       ├── SiteDetailPage.tsx          # 사이트 상세/관리
│       ├── CreateSitePage.tsx          # 상품 카탈로그 (24개)
│       ├── DomainsPage.tsx             # 도메인 관리
│       ├── ProfilePage.tsx             # 내 정보 관리
│       ├── BillingPage.tsx             # 결제/플랜
│       ├── AdminPage.tsx               # 관리자 패널
│       └── wizard/
│           ├── WordPressCFWizard.tsx   # Cloudflare 기반 WordPress 마법사
│           ├── WordPressVPSWizard.tsx  # VPS 기반 WordPress 마법사
│           ├── GeneralWizard.tsx       # 일반 사이트 마법사
│           └── GenericSiteWizard.tsx   # GeneralWizard re-export
├── supabase/
│   └── functions/
│       ├── validate-cloudflare/        # Cloudflare API 검증
│       ├── validate-github/            # GitHub 토큰 검증 ✨NEW
│       ├── validate-aws/               # AWS 자격증명 검증
│       ├── validate-vps-provider/      # Vultr/DO API 검증
│       ├── create-github-repo/         # GitHub 저장소 생성
│       ├── setup-wordpress-github/     # WordPress→GitHub 배포 ✨NEW
│       ├── trigger-cf-deploy/          # Cloudflare Pages 배포
│       ├── convert-wordpress/          # PHP→Astro 변환
│       ├── provision-vps/              # VPS 인스턴스 생성
│       ├── manage-vps/                 # VPS 관리 (재시작 등)
│       ├── add-domain/                 # 도메인 추가
│       ├── check-domain-status/        # 도메인 상태 확인
│       ├── connect-domain-to-site/     # 도메인-사이트 연결
│       └── paypal-webhook/             # PayPal 웹훅
├── 001_initial_schema.sql              # Supabase DB 스키마
├── .env.example                        # 환경변수 템플릿 ✨NEW
├── index.html                          # HTML 진입점 ✨NEW
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── wrangler.toml
```

## ⚡ 빠른 시작

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

```bash
cp .env.example .env.local
```

`.env.local`을 열고 Supabase 프로젝트 정보를 입력하세요:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL=http://localhost:5173
VITE_SERVICE_DOMAIN=cloudpress.io
```

### 3. Supabase 데이터베이스 설정

Supabase 대시보드 → SQL Editor에서 `001_initial_schema.sql` 파일을 실행하세요.

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속하세요.

### 5. 빌드

```bash
npm run build
```

## 🗄 데이터베이스 스키마

`001_initial_schema.sql` 파일에 전체 스키마가 포함됩니다:

- `profiles` — 사용자 프로필 (역할, API 키)
- `sites` — 사이트 정보 (Cloudflare/VPS 공통)
- `domains` — 도메인 관리
- `deployments` — 배포 이력
- `products` — 상품 카탈로그 (24개, 활성화 토글)
- `plans` — 요금제 정보
- `invoices` — 청구서
- `admin_settings` — 관리자 설정 (AWS, PayPal 등)
- `audit_logs` — 감사 로그

모든 테이블에 RLS(Row Level Security) 적용됨.

## 🔑 관리자 설정

관리자 패널(`/admin`)에서 아래 설정을 입력해야 VPS/결제 기능이 작동합니다:

### AWS EC2 설정
- AWS Access Key ID
- AWS Secret Access Key
- 리전 (기본: ap-northeast-2 서울)
- EC2 AMI ID (WordPress 사전 설치 이미지)
- 보안 그룹 ID
- 키페어 이름

### Vultr 설정
- Vultr API Key

### DigitalOcean 설정
- DigitalOcean API Key

### PayPal 설정
- PayPal Client ID
- PayPal Secret Key
- 모드: sandbox / live

## 📦 상품 카탈로그 (24개)

| 카테고리 | 상품 수 |
|----------|---------|
| 워드프레스 호스팅 | 2개 |
| 웹사이트 빌더 | 6개 |
| 쇼핑몰 / 커머스 | 4개 |
| 비즈니스 도구 | 4개 |
| 콘텐츠 & 미디어 | 4개 |
| 개발자 도구 | 4개 |

관리자는 각 상품을 개별 활성화/비활성화할 수 있습니다.

## 💡 WordPress 서버리스 운영 방식

"Cloudflare 기반 WordPress"는 실제로 아래 방식으로 운영됩니다:

```
사용자 요청
    ↓
GitHub Actions 트리거
    ↓
Ubuntu Runner에서 Nginx + PHP-FPM 설치
    ↓
WordPress 파일 (GitHub 저장소에서 체크아웃)
    ↓
SQLite DB로 WordPress 실행
    ↓
Cloudflare 터널 또는 ngrok으로 외부 노출
```

- **WordPress 파일**: 사용자의 GitHub 저장소에 저장
- **미디어 파일**: `wordpress/wp-content/uploads/`에 저장 (Git LFS 사용 권장)
- **데이터베이스**: SQLite 파일 (`wordpress/wp-content/database/cloudpress.db`)
- **플러그인/테마**: 실제 WordPress 플러그인/테마 100% 호환

## 🤝 기여

이 프로젝트는 클라우드프레스 내부 프로젝트입니다.

## 📄 라이선스

Copyright © 2025 CloudPress. All rights reserved.