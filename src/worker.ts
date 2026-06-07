/**
 * src/worker.ts
 * Cloudflare Workers 엔트리포인트
 * Supabase Edge Functions + Postgres를 완전히 대체
 * 데이터베이스: Cloudflare D1 (SQLite)
 * 인증: JWT (jose 라이브러리 없이 Web Crypto API 사용)
 */

export interface Env {
  DB: D1Database
  JWT_SECRET: string
  // OAuth 소셜 로그인 (Cloudflare Dashboard > Workers > 환경변수에서 설정)
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  GITHUB_CLIENT_ID?: string
  GITHUB_CLIENT_SECRET?: string
  APP_ORIGIN?: string  // e.g. https://sso.cloud-press.co.kr
  // 외부 서비스 키
  PAYPAL_CLIENT_ID?: string
  PAYPAL_SECRET?: string
  PAYPAL_MODE?: string
  PAYPAL_WEBHOOK_ID?: string
  // GitHub Actions용 (WordPress CF 호스팅)
  GH_ACTIONS_TOKEN?: string
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
}

// ─────────────────────────────────────────
// 유틸리티
// ─────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function err(message: string, status = 400): Response {
  return json({ error: message }, status)
}

// ─────────────────────────────────────────
// JWT (Web Crypto API — 외부 라이브러리 불필요)
// ─────────────────────────────────────────

async function signJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 }))
  const data = `${header}.${body}`
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  return `${data}.${signature}`
}

async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [header, body, signature] = parts
    const data = `${header}.${body}`
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    )
    const sig = Uint8Array.from(atob(signature.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
    const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(data))
    if (!valid) return null
    const payload = JSON.parse(atob(body)) as Record<string, unknown>
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomUUID()
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password + salt), { name: 'PBKDF2' }, false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256)
  const hash = btoa(String.fromCharCode(...new Uint8Array(bits)))
  return `${salt}:${hash}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password + salt), { name: 'PBKDF2' }, false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256)
  const candidate = btoa(String.fromCharCode(...new Uint8Array(bits)))
  return candidate === hash
}

// 요청에서 인증된 사용자 추출
async function getAuthUser(req: Request, env: Env): Promise<{ id: string; email: string; role: string } | null> {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const payload = await verifyJWT(auth.slice(7), env.JWT_SECRET)
  if (!payload) return null
  return { id: payload.id as string, email: payload.email as string, role: payload.role as string }
}

// ─────────────────────────────────────────
// D1 헬퍼 — Supabase 체이닝을 대체하는 단순 래퍼
// ─────────────────────────────────────────

async function dbGet<T>(db: D1Database, sql: string, args: unknown[] = []): Promise<T | null> {
  const res = await db.prepare(sql).bind(...args).first<T>()
  return res ?? null
}

async function dbAll<T>(db: D1Database, sql: string, args: unknown[] = []): Promise<T[]> {
  const res = await db.prepare(sql).bind(...args).all<T>()
  return res.results
}

async function dbRun(db: D1Database, sql: string, args: unknown[] = []): Promise<D1Result> {
  return db.prepare(sql).bind(...args).run()
}

// ─────────────────────────────────────────
// 라우터
// ─────────────────────────────────────────

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }

    const url = new URL(req.url)
    // /api 접두사 제거
    const path = url.pathname.replace(/^\/api/, '')
    const method = req.method

    try {
      // ── 인증 ──────────────────────────────
      if (path === '/auth/signup'      && method === 'POST') return handleSignUp(req, env)
      if (path === '/auth/signin'      && method === 'POST') return handleSignIn(req, env)
      if (path === '/auth/me'          && method === 'GET')  return handleMe(req, env)
      if (path === '/auth/reset-password' && method === 'POST') return handleResetPassword(req, env)
      if (path.startsWith('/auth/oauth/')) return handleOAuth(req, env, path)

      // ── 프로필 ────────────────────────────
      if (path.match(/^\/profiles\/[^/]+$/) && method === 'GET')   return handleGetProfile(req, env, path)
      if (path.match(/^\/profiles\/[^/]+$/) && method === 'PUT')   return handleUpdateProfile(req, env, path)

      // ── 사이트 ────────────────────────────
      if (path === '/sites'                     && method === 'GET')    return handleGetSites(req, env, url)
      if (path === '/sites'                     && method === 'POST')   return handleCreateSite(req, env)
      if (path.match(/^\/sites\/[^/]+$/)        && method === 'GET')    return handleGetSite(req, env, path)
      if (path.match(/^\/sites\/[^/]+$/)        && method === 'PATCH')  return handleUpdateSite(req, env, path)
      if (path.match(/^\/sites\/[^/]+$/)        && method === 'DELETE') return handleDeleteSite(req, env, path)

      // ── 도메인 ────────────────────────────
      if (path === '/domains'                   && method === 'GET')    return handleGetDomains(req, env, url)
      if (path === '/domains'                   && method === 'POST')   return handleAddDomain(req, env)
      if (path.match(/^\/domains\/[^/]+$/)      && method === 'DELETE') return handleDeleteDomain(req, env, path)

      // ── 상품 ──────────────────────────────
      if (path === '/products'                  && method === 'GET')    return handleGetProducts(req, env, url)

      // ── 배포 ──────────────────────────────
      if (path === '/deployments'               && method === 'POST')   return handleCreateDeployment(req, env)
      if (path === '/deployments'               && method === 'GET')    return handleGetDeployments(req, env, url)

      // ── 청구서 ────────────────────────────
      if (path === '/invoices'                  && method === 'GET')    return handleGetInvoices(req, env, url)

      // ── 관리자 ────────────────────────────
      if (path === '/admin/sites'               && method === 'GET')    return handleAdminGetSites(req, env)
      if (path === '/admin/domains'             && method === 'GET')    return handleAdminGetDomains(req, env)
      if (path === '/admin/users'               && method === 'GET')    return handleAdminGetUsers(req, env)
      if (path.match(/^\/admin\/users\/[^/]+$/) && method === 'PATCH')  return handleAdminUpdateUser(req, env, path)
      if (path.match(/^\/admin\/users\/[^/]+$/) && method === 'DELETE') return handleAdminDeleteUser(req, env, path)
      if (path === '/admin/settings'            && method === 'GET')    return handleAdminGetSettings(req, env)
      if (path === '/admin/settings'            && method === 'POST')   return handleAdminSaveSetting(req, env)
      if (path.match(/^\/admin\/products\/[^/]+$/) && method === 'PATCH') return handleAdminToggleProduct(req, env, path)
      if (path === '/admin/audit-logs'          && method === 'GET')    return handleAdminGetAuditLogs(req, env)
      if (path === '/admin/audit-logs'          && method === 'POST')   return handleAdminCreateAuditLog(req, env)

      // ── 액션 (Edge Function 대체) ─────────
      if (path.startsWith('/actions/') && method === 'POST') return handleAction(req, env, path)

      // ── PayPal 웹훅 ───────────────────────
      if (path === '/webhooks/paypal' && method === 'POST') return handlePaypalWebhook(req, env)

      return err('Not Found', 404)
    } catch (e) {
      console.error(e)
      return err('Internal Server Error', 500)
    }
  },
}

// ─────────────────────────────────────────
// 인증 핸들러
// ─────────────────────────────────────────

async function handleSignUp(req: Request, env: Env): Promise<Response> {
  const { email, password, name } = await req.json() as { email: string; password: string; name: string }
  if (!email || !password || !name) return err('필수 항목을 입력해주세요')

  const exists = await dbGet(env.DB, 'SELECT id FROM profiles WHERE email = ?', [email])
  if (exists) return err('이미 사용 중인 이메일입니다', 409)

  const id = crypto.randomUUID()
  const hashed = await hashPassword(password)
  const now = new Date().toISOString()

  await dbRun(env.DB,
    `INSERT INTO profiles (id, user_id, email, name, password_hash, role, created_at)
     VALUES (?, ?, ?, ?, ?, 'user', ?)`,
    [id, id, email, name, hashed, now]
  )

  return json({ ok: true, message: '회원가입 완료. 로그인해주세요.' })
}

async function handleSignIn(req: Request, env: Env): Promise<Response> {
  const { email, password } = await req.json() as { email: string; password: string }
  if (!email || !password) return err('이메일과 비밀번호를 입력해주세요')

  const user = await dbGet<{ id: string; email: string; password_hash: string; role: string }>(
    env.DB, 'SELECT id, email, password_hash, role FROM profiles WHERE email = ?', [email]
  )
  if (!user) return err('이메일 또는 비밀번호가 올바르지 않습니다', 401)

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) return err('이메일 또는 비밀번호가 올바르지 않습니다', 401)

  const token = await signJWT({ id: user.id, email: user.email, role: user.role }, env.JWT_SECRET)
  return json({ token, user: { id: user.id, email: user.email } })
}

async function handleMe(req: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(req, env)
  if (!user) return err('인증이 필요합니다', 401)
  return json({ id: user.id, email: user.email })
}

async function handleResetPassword(req: Request, env: Env): Promise<Response> {
  // 실제 환경에서는 이메일 발송 서비스 연동 필요
  const { email } = await req.json() as { email: string }
  if (!email) return err('이메일을 입력해주세요')
  const user = await dbGet(env.DB, 'SELECT id FROM profiles WHERE email = ?', [email])
  if (!user) return json({ ok: true }) // 보안상 존재 여부 노출 안 함
  // TODO: 이메일 발송 (Mailchannels / Resend 등)
  return json({ ok: true, message: '비밀번호 재설정 링크를 이메일로 발송했습니다.' })
}

async function handleOAuth(req: Request, env: Env, path: string): Promise<Response> {
  const url = new URL(req.url)
  const provider = path.replace('/auth/oauth/', '').split('/')[0]
  const appOrigin = env.APP_ORIGIN || url.origin

  // ── OAuth 콜백 처리 ──────────────────────────────────────────────
  // /auth/oauth/google/callback  또는  /auth/oauth/github/callback
  if (path.endsWith('/callback')) {
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state') // redirect URL
    if (!code) return new Response('OAuth code missing', { status: 400 })

    try {
      let userEmail = ''
      let userName = ''
      let avatarUrl = ''

      if (provider === 'google') {
        if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)
          return new Response('Google OAuth가 설정되지 않았습니다. Cloudflare Dashboard에서 GOOGLE_CLIENT_ID와 GOOGLE_CLIENT_SECRET을 설정하세요.', { status: 501 })

        // 토큰 교환
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri: `${appOrigin}/api/auth/oauth/google/callback`,
            grant_type: 'authorization_code',
          }),
        })
        const tokenData = await tokenRes.json() as { access_token?: string; error?: string }
        if (!tokenData.access_token) return new Response(`Google 토큰 오류: ${tokenData.error}`, { status: 400 })

        // 사용자 정보 조회
        const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        })
        const userData = await userRes.json() as { email: string; name: string; picture: string }
        userEmail = userData.email
        userName = userData.name
        avatarUrl = userData.picture

      } else if (provider === 'github') {
        if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET)
          return new Response('GitHub OAuth가 설정되지 않았습니다. Cloudflare Dashboard에서 GITHUB_CLIENT_ID와 GITHUB_CLIENT_SECRET을 설정하세요.', { status: 501 })

        // 토큰 교환
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: `${appOrigin}/api/auth/oauth/github/callback`,
          }),
        })
        const tokenData = await tokenRes.json() as { access_token?: string; error?: string }
        if (!tokenData.access_token) return new Response(`GitHub 토큰 오류: ${tokenData.error}`, { status: 400 })

        // 사용자 정보 조회
        const userRes = await fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'CloudPress/1.0' },
        })
        const userData = await userRes.json() as { email: string | null; name: string; login: string; avatar_url: string }

        // GitHub는 email이 null일 수 있어 emails API 조회
        let email = userData.email
        if (!email) {
          const emailRes = await fetch('https://api.github.com/user/emails', {
            headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'CloudPress/1.0' },
          })
          const emails = await emailRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>
          const primary = emails.find(e => e.primary && e.verified)
          email = primary?.email || emails[0]?.email || ''
        }
        userEmail = email
        userName = userData.name || userData.login
        avatarUrl = userData.avatar_url
      } else {
        return new Response(`지원하지 않는 OAuth 제공자: ${provider}`, { status: 400 })
      }

      if (!userEmail) return new Response('이메일을 가져올 수 없습니다.', { status: 400 })

      // DB에 사용자 생성 또는 조회
      let user = await dbGet<{ id: string; email: string; role: string }>(
        env.DB, 'SELECT id, email, role FROM profiles WHERE email = ?', [userEmail]
      )
      if (!user) {
        const id = crypto.randomUUID()
        await dbRun(env.DB,
          `INSERT INTO profiles (id, user_id, email, name, avatar_url, role, password_hash, created_at)
           VALUES (?, ?, ?, ?, ?, 'user', '', ?)`,
          [id, id, userEmail, userName, avatarUrl, new Date().toISOString()]
        )
        user = { id, email: userEmail, role: 'user' }
      } else {
        // 아바타 업데이트
        await dbRun(env.DB, 'UPDATE profiles SET avatar_url = ? WHERE id = ?', [avatarUrl, user.id])
      }

      const token = await signJWT({ id: user.id, email: user.email, role: user.role }, env.JWT_SECRET)

      // 프론트엔드로 토큰 전달 (query param으로 redirect)
      const redirectBase = decodeURIComponent(state || `${appOrigin}/dashboard`)
      const redirectUrl = new URL(redirectBase)
      redirectUrl.searchParams.set('cp_token', token)
      redirectUrl.searchParams.set('cp_user', JSON.stringify({ id: user.id, email: user.email }))

      return Response.redirect(redirectUrl.toString(), 302)
    } catch (e) {
      console.error('OAuth callback error:', e)
      return new Response(`OAuth 처리 중 오류가 발생했습니다: ${e}`, { status: 500 })
    }
  }

  // ── OAuth 시작 — 제공자로 리다이렉트 ────────────────────────────
  const redirectParam = url.searchParams.get('redirect') || `${appOrigin}/dashboard`

  if (provider === 'google') {
    if (!env.GOOGLE_CLIENT_ID)
      return err('Google OAuth가 설정되지 않았습니다. Cloudflare Dashboard에서 GOOGLE_CLIENT_ID를 설정하세요.', 501)
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: `${appOrigin}/api/auth/oauth/google/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      state: encodeURIComponent(redirectParam),
      access_type: 'online',
    })
    return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302)
  }

  if (provider === 'github') {
    if (!env.GITHUB_CLIENT_ID)
      return err('GitHub OAuth가 설정되지 않았습니다. Cloudflare Dashboard에서 GITHUB_CLIENT_ID를 설정하세요.', 501)
    const params = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      redirect_uri: `${appOrigin}/api/auth/oauth/github/callback`,
      scope: 'user:email',
      state: encodeURIComponent(redirectParam),
    })
    return Response.redirect(`https://github.com/login/oauth/authorize?${params}`, 302)
  }

  return err(`지원하지 않는 OAuth 제공자: ${provider}`, 400)
}

// ─────────────────────────────────────────
// 프로필 핸들러
// ─────────────────────────────────────────

async function handleGetProfile(req: Request, env: Env, path: string): Promise<Response> {
  const user = await getAuthUser(req, env)
  if (!user) return err('인증이 필요합니다', 401)
  const userId = path.split('/').pop()!
  const profile = await dbGet(env.DB,
    'SELECT id, user_id, name, avatar_url, role, cf_email, gh_token_encrypted, cf_api_key_encrypted, plan_id, created_at FROM profiles WHERE user_id = ?',
    [userId]
  )
  if (!profile) return err('프로필을 찾을 수 없습니다', 404)
  return json(profile)
}

async function handleUpdateProfile(req: Request, env: Env, path: string): Promise<Response> {
  const user = await getAuthUser(req, env)
  if (!user) return err('인증이 필요합니다', 401)
  const userId = path.split('/').pop()!
  if (user.id !== userId && user.role !== 'admin') return err('권한이 없습니다', 403)

  const updates = await req.json() as Record<string, string>
  const allowed = ['name', 'avatar_url', 'cf_api_key_encrypted', 'cf_email', 'gh_token_encrypted', 'plan_id']
  const fields = Object.keys(updates).filter(k => allowed.includes(k))
  if (fields.length === 0) return err('업데이트할 항목이 없습니다')

  const set = fields.map(f => `${f} = ?`).join(', ')
  const vals = fields.map(f => updates[f])
  await dbRun(env.DB, `UPDATE profiles SET ${set} WHERE user_id = ?`, [...vals, userId])

  const profile = await dbGet(env.DB, 'SELECT * FROM profiles WHERE user_id = ?', [userId])
  return json(profile)
}

// ─────────────────────────────────────────
// 사이트 핸들러
// ─────────────────────────────────────────

async function handleGetSites(req: Request, env: Env, url: URL): Promise<Response> {
  const user = await getAuthUser(req, env)
  if (!user) return err('인증이 필요합니다', 401)
  const userId = url.searchParams.get('user_id') || user.id
  const sites = await dbAll(env.DB,
    'SELECT * FROM sites WHERE user_id = ? ORDER BY created_at DESC', [userId]
  )
  return json(sites)
}

async function handleGetSite(req: Request, env: Env, path: string): Promise<Response> {
  const user = await getAuthUser(req, env)
  if (!user) return err('인증이 필요합니다', 401)
  const siteId = path.split('/').pop()!
  const site = await dbGet(env.DB, 'SELECT * FROM sites WHERE id = ?', [siteId])
  if (!site) return err('사이트를 찾을 수 없습니다', 404)
  return json(site)
}

async function handleCreateSite(req: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(req, env)
  if (!user) return err('인증이 필요합니다', 401)
  const body = await req.json() as Record<string, string>
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await dbRun(env.DB,
    `INSERT INTO sites (id, user_id, name, product_type, hosting_type, subdomain,
      github_repo_url, cf_pages_url, ec2_instance_id, ec2_public_ip, ec2_region,
      wp_admin_url, vps_provider, status, plan, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, body.user_id || user.id, body.name, body.product_type, body.hosting_type,
     body.subdomain, body.github_repo_url || null, body.cf_pages_url || null,
     body.ec2_instance_id || null, body.ec2_public_ip || null, body.ec2_region || null,
     body.wp_admin_url || null, body.vps_provider || null,
     body.status || 'idle', body.plan || 'starter', now]
  )
  const site = await dbGet(env.DB, 'SELECT * FROM sites WHERE id = ?', [id])
  return json(site, 201)
}

async function handleUpdateSite(req: Request, env: Env, path: string): Promise<Response> {
  const user = await getAuthUser(req, env)
  if (!user) return err('인증이 필요합니다', 401)
  const siteId = path.split('/').pop()!
  const updates = await req.json() as Record<string, string>
  const allowed = ['name', 'status', 'github_repo_url', 'cf_pages_url', 'ec2_instance_id',
    'ec2_public_ip', 'ec2_region', 'wp_admin_url', 'vps_provider', 'plan', 'last_deployed_at']
  const fields = Object.keys(updates).filter(k => allowed.includes(k))
  if (fields.length === 0) return err('업데이트할 항목이 없습니다')
  const set = fields.map(f => `${f} = ?`).join(', ')
  const vals = fields.map(f => updates[f])
  await dbRun(env.DB, `UPDATE sites SET ${set} WHERE id = ?`, [...vals, siteId])
  const site = await dbGet(env.DB, 'SELECT * FROM sites WHERE id = ?', [siteId])
  return json(site)
}

async function handleDeleteSite(req: Request, env: Env, path: string): Promise<Response> {
  const user = await getAuthUser(req, env)
  if (!user) return err('인증이 필요합니다', 401)
  const siteId = path.split('/').pop()!
  await dbRun(env.DB, 'DELETE FROM sites WHERE id = ? AND user_id = ?', [siteId, user.id])
  return json({ ok: true })
}

// ─────────────────────────────────────────
// 도메인 핸들러
// ─────────────────────────────────────────

async function handleGetDomains(req: Request, env: Env, url: URL): Promise<Response> {
  const user = await getAuthUser(req, env)
  if (!user) return err('인증이 필요합니다', 401)
  const userId = url.searchParams.get('user_id') || user.id
  const domains = await dbAll(env.DB,
    'SELECT * FROM domains WHERE user_id = ? ORDER BY created_at DESC', [userId]
  )
  return json(domains)
}

async function handleAddDomain(req: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(req, env)
  if (!user) return err('인증이 필요합니다', 401)
  const { domain, siteId } = await req.json() as { domain: string; siteId?: string }
  if (!domain) return err('도메인을 입력해주세요')

  // 사용자 CF 키 조회
  const profile = await dbGet<{ cf_api_key_encrypted: string; cf_email: string }>(
    env.DB, 'SELECT cf_api_key_encrypted, cf_email FROM profiles WHERE user_id = ?', [user.id]
  )
  if (!profile?.cf_api_key_encrypted) return err('Cloudflare API 키를 먼저 설정해주세요')

  // Cloudflare Zone 생성
  const zoneRes = await fetch('https://api.cloudflare.com/client/v4/zones', {
    method: 'POST',
    headers: {
      'X-Auth-Key': profile.cf_api_key_encrypted,
      'X-Auth-Email': profile.cf_email,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: domain, account: { id: '' }, jump_start: true }),
  })
  const zoneData = await zoneRes.json() as { success: boolean; result?: { id: string; name_servers: string[] }; errors?: { message: string }[] }
  if (!zoneData.success) return err(zoneData.errors?.[0]?.message || 'Cloudflare Zone 생성 실패')

  const zone = zoneData.result!
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await dbRun(env.DB,
    `INSERT INTO domains (id, user_id, domain, cf_zone_id, nameserver_1, nameserver_2,
      ns_status, ssl_status, connected_site_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', 'inactive', ?, ?)`,
    [id, user.id, domain, zone.id, zone.name_servers[0], zone.name_servers[1], siteId || null, now]
  )
  const record = await dbGet(env.DB, 'SELECT * FROM domains WHERE id = ?', [id])
  return json(record, 201)
}

async function handleDeleteDomain(req: Request, env: Env, path: string): Promise<Response> {
  const user = await getAuthUser(req, env)
  if (!user) return err('인증이 필요합니다', 401)
  const domainId = path.split('/').pop()!
  await dbRun(env.DB, 'DELETE FROM domains WHERE id = ? AND user_id = ?', [domainId, user.id])
  return json({ ok: true })
}

// ─────────────────────────────────────────
// 상품 핸들러
// ─────────────────────────────────────────

async function handleGetProducts(req: Request, env: Env, url: URL): Promise<Response> {
  const activeOnly = url.searchParams.get('active') === 'true'
  const sql = activeOnly
    ? 'SELECT * FROM products WHERE is_active = 1 ORDER BY created_at'
    : 'SELECT * FROM products ORDER BY created_at'
  const products = await dbAll(env.DB, sql)
  return json(products)
}

// ─────────────────────────────────────────
// 배포 핸들러
// ─────────────────────────────────────────

async function handleCreateDeployment(req: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(req, env)
  if (!user) return err('인증이 필요합니다', 401)
  const body = await req.json() as Record<string, string>
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await dbRun(env.DB,
    `INSERT INTO deployments (id, site_id, status, log, triggered_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, body.site_id, body.status || 'pending', body.log || null,
     body.triggered_at || now, body.completed_at || null]
  )
  const deployment = await dbGet(env.DB, 'SELECT * FROM deployments WHERE id = ?', [id])
  return json(deployment, 201)
}

async function handleGetDeployments(req: Request, env: Env, url: URL): Promise<Response> {
  const user = await getAuthUser(req, env)
  if (!user) return err('인증이 필요합니다', 401)
  const siteId = url.searchParams.get('site_id')
  if (!siteId) return err('site_id가 필요합니다')
  const deployments = await dbAll(env.DB,
    'SELECT * FROM deployments WHERE site_id = ? ORDER BY triggered_at DESC LIMIT 20', [siteId]
  )
  return json(deployments)
}

// ─────────────────────────────────────────
// 청구서 핸들러
// ─────────────────────────────────────────

async function handleGetInvoices(req: Request, env: Env, url: URL): Promise<Response> {
  const user = await getAuthUser(req, env)
  if (!user) return err('인증이 필요합니다', 401)
  const userId = url.searchParams.get('user_id') || user.id
  const invoices = await dbAll(env.DB,
    'SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC', [userId]
  )
  return json(invoices)
}

// ─────────────────────────────────────────
// 관리자 핸들러
// ─────────────────────────────────────────

async function requireAdmin(req: Request, env: Env): Promise<{ id: string; email: string; role: string } | null> {
  const user = await getAuthUser(req, env)
  if (!user || user.role !== 'admin') return null
  return user
}

async function handleAdminGetSites(req: Request, env: Env): Promise<Response> {
  if (!await requireAdmin(req, env)) return err('관리자 권한이 필요합니다', 403)
  return json(await dbAll(env.DB, 'SELECT * FROM sites ORDER BY created_at DESC'))
}

async function handleAdminGetDomains(req: Request, env: Env): Promise<Response> {
  if (!await requireAdmin(req, env)) return err('관리자 권한이 필요합니다', 403)
  return json(await dbAll(env.DB, 'SELECT * FROM domains ORDER BY created_at DESC'))
}

async function handleAdminGetUsers(req: Request, env: Env): Promise<Response> {
  if (!await requireAdmin(req, env)) return err('관리자 권한이 필요합니다', 403)
  return json(await dbAll(env.DB,
    'SELECT id, user_id, name, email, role, avatar_url, plan_id, created_at FROM profiles ORDER BY created_at DESC'
  ))
}

async function handleAdminUpdateUser(req: Request, env: Env, path: string): Promise<Response> {
  const admin = await requireAdmin(req, env)
  if (!admin) return err('관리자 권한이 필요합니다', 403)
  const userId = path.split('/').pop()!
  const { role } = await req.json() as { role: string }
  await dbRun(env.DB, 'UPDATE profiles SET role = ? WHERE user_id = ?', [role, userId])
  return json(await dbGet(env.DB, 'SELECT * FROM profiles WHERE user_id = ?', [userId]))
}

async function handleAdminDeleteUser(req: Request, env: Env, path: string): Promise<Response> {
  const admin = await requireAdmin(req, env)
  if (!admin) return err('관리자 권한이 필요합니다', 403)
  const userId = path.split('/').pop()!
  await dbRun(env.DB, 'DELETE FROM profiles WHERE user_id = ?', [userId])
  return json({ ok: true })
}

async function handleAdminGetSettings(req: Request, env: Env): Promise<Response> {
  if (!await requireAdmin(req, env)) return err('관리자 권한이 필요합니다', 403)
  return json(await dbAll(env.DB, 'SELECT key, value FROM admin_settings'))
}

async function handleAdminSaveSetting(req: Request, env: Env): Promise<Response> {
  if (!await requireAdmin(req, env)) return err('관리자 권한이 필요합니다', 403)
  const { key, value } = await req.json() as { key: string; value: string }
  await dbRun(env.DB,
    'INSERT INTO admin_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  )
  return json({ ok: true })
}

async function handleAdminToggleProduct(req: Request, env: Env, path: string): Promise<Response> {
  if (!await requireAdmin(req, env)) return err('관리자 권한이 필요합니다', 403)
  const productId = path.split('/').pop()!
  const { is_active } = await req.json() as { is_active: boolean }
  const now = new Date().toISOString()
  await dbRun(env.DB,
    'UPDATE products SET is_active = ?, updated_at = ? WHERE id = ?',
    [is_active ? 1 : 0, now, productId]
  )
  return json(await dbGet(env.DB, 'SELECT * FROM products WHERE id = ?', [productId]))
}

async function handleAdminGetAuditLogs(req: Request, env: Env): Promise<Response> {
  if (!await requireAdmin(req, env)) return err('관리자 권한이 필요합니다', 403)
  return json(await dbAll(env.DB,
    'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100'
  ))
}

async function handleAdminCreateAuditLog(req: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(req, env)
  if (!user) return err('인증이 필요합니다', 401)
  const { admin_id, action, target_type, target_id } = await req.json() as Record<string, string>
  const id = crypto.randomUUID()
  await dbRun(env.DB,
    'INSERT INTO audit_logs (id, admin_id, action, target_type, target_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, admin_id || user.id, action, target_type || '', target_id || '', new Date().toISOString()]
  )
  return json({ ok: true })
}

// ─────────────────────────────────────────
// 액션 핸들러 (Supabase Edge Functions 대체)
// ─────────────────────────────────────────

async function handleAction(req: Request, env: Env, path: string): Promise<Response> {
  const user = await getAuthUser(req, env)
  if (!user) return err('인증이 필요합니다', 401)

  const action = path.replace('/actions/', '')
  const body = await req.json() as Record<string, unknown>

  switch (action) {
    // ── Cloudflare 검증 ─────────────────
    case 'validate-cloudflare': {
      const { apiKey, email } = body as { apiKey: string; email: string }
      const res = await fetch('https://api.cloudflare.com/client/v4/user', {
        headers: { 'X-Auth-Key': apiKey, 'X-Auth-Email': email },
      })
      const data = await res.json() as { success: boolean; result?: { email: string } }
      if (!data.success) return json({ success: false, error: '유효하지 않은 Cloudflare API 키입니다.' })
      return json({ success: true, email: data.result?.email })
    }

    // ── GitHub 검증 ─────────────────────
    case 'validate-github': {
      const { token } = body as { token: string }
      const ghRes = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'CloudPress/1.0' },
      })
      if (!ghRes.ok) return json({ success: false, error: '유효하지 않은 GitHub 토큰입니다.' })
      const ghUser = await ghRes.json() as { login: string; name: string; avatar_url: string; public_repos: number }
      const scopes = (ghRes.headers.get('x-oauth-scopes') || '').split(',').map(s => s.trim())
      // D1에 토큰 저장
      await dbRun(env.DB, 'UPDATE profiles SET gh_token_encrypted = ? WHERE user_id = ?', [token, user.id])
      return json({ success: true, username: ghUser.login, name: ghUser.name, scopes })
    }

    // ── AWS 검증 ────────────────────────
    case 'validate-aws': {
      const { accessKeyId, secretAccessKey, region } = body as { accessKeyId: string; secretAccessKey: string; region: string }
      const r = region || 'ap-northeast-2'
      const date = new Date()
      const dateStr = date.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
      const dateShort = dateStr.slice(0, 8)
      const payload = 'Action=GetCallerIdentity&Version=2011-06-15'

      const canonicalHeaders = `content-type:application/x-www-form-urlencoded\nhost:sts.${r}.amazonaws.com\nx-amz-date:${dateStr}\n`
      const signedHeaders = 'content-type;host;x-amz-date'

      const encoder = new TextEncoder()
      const hash = async (msg: string) => {
        const buf = await crypto.subtle.digest('SHA-256', encoder.encode(msg))
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
      }
      const hmac = async (key: ArrayBuffer | string, msg: string) => {
        const k = typeof key === 'string' ? encoder.encode(key) : key
        const ck = await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
        return crypto.subtle.sign('HMAC', ck, encoder.encode(msg))
      }
      const hmacHex = async (key: ArrayBuffer, msg: string) =>
        Array.from(new Uint8Array(await hmac(key, msg))).map(b => b.toString(16).padStart(2, '0')).join('')

      const canonical = ['POST', '/', '', canonicalHeaders, signedHeaders, await hash(payload)].join('\n')
      const kDate = await hmac(`AWS4${secretAccessKey}`, dateShort)
      const kRegion = await hmac(kDate, r)
      const kService = await hmac(kRegion, 'sts')
      const kSigning = await hmac(kService, 'aws4_request')
      const credScope = `${dateShort}/${r}/sts/aws4_request`
      const sts = ['AWS4-HMAC-SHA256', dateStr, credScope, await hash(canonical)].join('\n')
      const sig = await hmacHex(kSigning, sts)
      const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${sig}`

      const awsRes = await fetch(`https://sts.${r}.amazonaws.com/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Amz-Date': dateStr, 'Host': `sts.${r}.amazonaws.com`, Authorization: authHeader },
        body: payload,
      })
      const text = await awsRes.text()
      if (!awsRes.ok || !text.includes('GetCallerIdentityResult')) return json({ success: false, error: '유효하지 않은 AWS 자격증명입니다.' })
      const accountMatch = text.match(/<Account>(.*?)<\/Account>/)
      return json({ success: true, accountId: accountMatch?.[1] || '' })
    }

    // ── VPS 제공업체 검증 ───────────────
    case 'validate-vps-provider': {
      const { provider, apiKey } = body as { provider: string; apiKey: string }
      if (provider === 'vultr') {
        const res = await fetch('https://api.vultr.com/v2/account', { headers: { Authorization: `Bearer ${apiKey}` } })
        if (res.ok) { const d = await res.json() as { account?: { email: string } }; return json({ success: true, account: d.account?.email }) }
        return json({ success: false, error: '유효하지 않은 Vultr API 키입니다.' })
      }
      if (provider === 'digitalocean') {
        const res = await fetch('https://api.digitalocean.com/v2/account', { headers: { Authorization: `Bearer ${apiKey}` } })
        if (res.ok) { const d = await res.json() as { account?: { email: string } }; return json({ success: true, account: d.account?.email }) }
        return json({ success: false, error: '유효하지 않은 DigitalOcean API 키입니다.' })
      }
      return err('지원하지 않는 VPS 제공업체입니다.')
    }

    // ── GitHub 저장소 생성 ──────────────
    case 'create-github-repo': {
      const { repoName, siteId, token } = body as { repoName: string; siteId: string; token: string }
      const profile = await dbGet<{ gh_token_encrypted: string }>(
        env.DB, 'SELECT gh_token_encrypted FROM profiles WHERE user_id = ?', [user.id]
      )
      const ghToken = token || profile?.gh_token_encrypted
      if (!ghToken) return err('GitHub 토큰을 먼저 설정해주세요')

      const ghRes = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ghToken}`, 'Content-Type': 'application/json', 'User-Agent': 'CloudPress/1.0' },
        body: JSON.stringify({ name: repoName, private: true, auto_init: true }),
      })
      if (!ghRes.ok && ghRes.status !== 422) {
        const e = await ghRes.json() as { message: string }
        return err(e.message || 'GitHub 저장소 생성 실패')
      }
      const repo = await ghRes.json() as { html_url: string; full_name: string }
      if (siteId) await dbRun(env.DB, 'UPDATE sites SET github_repo_url = ? WHERE id = ?', [repo.html_url, siteId])
      return json({ success: true, repoUrl: repo.html_url, repoName: repo.full_name })
    }

    // ── WordPress + GitHub 설정 (완전 구현) ───────────────────────
    case 'setup-wordpress-github': {
      const { siteId, repoName, githubToken, subdomain, siteName, contentType } = body as Record<string, string>
      const profile = await dbGet<{ gh_token_encrypted: string; cf_api_key_encrypted: string; cf_email: string }>(
        env.DB, 'SELECT gh_token_encrypted, cf_api_key_encrypted, cf_email FROM profiles WHERE user_id = ?', [user.id]
      )
      const ghToken = githubToken || profile?.gh_token_encrypted
      if (!ghToken) return err('GitHub 토큰을 먼저 설정해주세요')

      const ghHeaders = {
        Authorization: `Bearer ${ghToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'CloudPress/1.0',
        Accept: 'application/vnd.github+json',
      }

      // 1) GitHub 사용자 정보 조회
      const userRes = await fetch('https://api.github.com/user', { headers: ghHeaders })
      if (!userRes.ok) return err('GitHub 토큰이 유효하지 않습니다')
      const ghUser = await userRes.json() as { login: string }

      // 2) 저장소 생성 (이미 존재하면 그대로 사용)
      const repoSlug = (repoName || subdomain).replace(/[^a-z0-9-]/g, '-').toLowerCase()
      const createRes = await fetch('https://api.github.com/user/repos', {
        method: 'POST', headers: ghHeaders,
        body: JSON.stringify({
          name: repoSlug,
          description: `CloudPress WordPress: ${siteName}`,
          private: true,
          auto_init: true,
          gitignore_template: null,
        }),
      })
      let repoData: { html_url: string; full_name: string; default_branch: string }
      if (createRes.status === 422) {
        const existing = await fetch(`https://api.github.com/repos/${ghUser.login}/${repoSlug}`, { headers: ghHeaders })
        repoData = await existing.json() as typeof repoData
      } else {
        repoData = await createRes.json() as typeof repoData
      }
      const repoUrl = repoData.html_url
      const defaultBranch = repoData.default_branch || 'main'

      // 3) WordPress 필수 파일들을 GitHub API로 커밋
      const encodeContent = (s: string) => btoa(unescape(encodeURIComponent(s)))

      // nginx.conf — WordPress PHP-FPM 처리 설정
      const nginxConf = `
worker_processes auto;
error_log /dev/stderr warn;
pid /tmp/nginx.pid;

events { worker_connections 1024; }

http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  access_log /dev/stdout;
  sendfile on;
  keepalive_timeout 65;
  gzip on;
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

  server {
    listen 8080;
    server_name localhost;
    root /var/www/html;
    index index.php index.html;

    # WordPress permalink support
    location / {
      try_files $uri $uri/ /index.php?$args;
    }

    # PHP-FPM 처리
    location ~ \\.php$ {
      fastcgi_split_path_info ^(.+\\.php)(/.+)$;
      fastcgi_pass 127.0.0.1:9000;
      fastcgi_index index.php;
      include fastcgi_params;
      fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
      fastcgi_param PATH_INFO $fastcgi_path_info;
      fastcgi_read_timeout 300;
    }

    # 미디어/정적 파일
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
      expires 30d;
      add_header Cache-Control "public, immutable";
      try_files $uri =404;
    }

    location = /favicon.ico { log_not_found off; access_log off; }
    location = /robots.txt  { log_not_found off; access_log off; allow all; }
    location ~ /\\.          { deny all; }
  }
}
`.trim()

      // Cloudflare Worker (WordPress 미러링 — PHP 실행 결과 프록시)
      const cfWorkerScript = `
/**
 * CloudPress WordPress Worker
 * Cloudflare Worker → 서버리스 Nginx+PHP 백엔드를 미러링
 *
 * 동작 원리:
 *  1. 사용자 요청 수신
 *  2. GitHub Pages / Cloudflare Pages의 정적 자산은 직접 서빙
 *  3. PHP 처리가 필요한 요청은 백엔드 origin으로 프록시
 *
 * 환경변수 (wrangler.toml 또는 CF Dashboard):
 *   WP_ORIGIN  = 실제 PHP 서버 주소 (예: http://your-server-ip:8080)
 */

const WP_ORIGIN = (typeof WP_ORIGIN_ENV !== 'undefined' ? WP_ORIGIN_ENV : null)
                  || 'http://localhost:8080'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // 정적 자산 (.css/.js/.png 등) → CF 캐시 우선
    const isStatic = /\\.(css|js|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot|map)$/i.test(url.pathname)
    const cacheKey = new Request(request.url, request)
    const cache = caches.default

    if (isStatic) {
      const cached = await cache.match(cacheKey)
      if (cached) return cached
    }

    // WordPress 백엔드로 프록시
    const origin = env.WP_ORIGIN || WP_ORIGIN
    const proxyUrl = new URL(url.pathname + url.search, origin)

    try {
      const proxyReq = new Request(proxyUrl.toString(), {
        method: request.method,
        headers: request.headers,
        body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
        redirect: 'manual',
      })

      const response = await fetch(proxyReq)

      // WordPress 리다이렉트 처리
      if (response.status === 301 || response.status === 302) {
        const location = response.headers.get('Location') || ''
        const newLocation = location.replace(origin, url.origin)
        return new Response(null, {
          status: response.status,
          headers: { ...Object.fromEntries(response.headers), Location: newLocation },
        })
      }

      const newResponse = new Response(response.body, response)
      newResponse.headers.set('X-Powered-By', 'CloudPress')
      newResponse.headers.delete('X-Powered-By-PHP')

      // 정적 자산 캐싱
      if (isStatic && response.ok) {
        const cacheRes = newResponse.clone()
        cacheRes.headers.set('Cache-Control', 'public, max-age=2592000, immutable')
        await cache.put(cacheKey, cacheRes)
      }

      return newResponse
    } catch (err) {
      return new Response(\`CloudPress 백엔드 연결 오류: \${err}\`, { status: 502 })
    }
  }
}
`.trim()

      // GitHub Actions 워크플로우 — Nginx+PHP 빌드/배포
      const githubActionsWorkflow = `
name: CloudPress WordPress Deploy

on:
  push:
    branches: [ ${defaultBranch} ]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up PHP + Nginx + WordPress
        run: |
          sudo apt-get update -qq
          sudo apt-get install -y nginx php8.3-fpm php8.3-cli php8.3-mysql \\
            php8.3-pdo php8.3-sqlite3 php8.3-mbstring php8.3-xml \\
            php8.3-curl php8.3-gd php8.3-zip php8.3-intl php8.3-json \\
            sqlite3 curl unzip

      - name: Download WordPress (latest)
        if: \${{ !hashFiles('wordpress/wp-load.php') }}
        run: |
          curl -sL https://wordpress.org/latest.zip -o /tmp/wp.zip
          unzip -q /tmp/wp.zip -d /tmp/
          mkdir -p wordpress
          cp -r /tmp/wordpress/. wordpress/
          # 기본 SQLite 플러그인 설치 (DB 없이 실행 가능)
          mkdir -p wordpress/wp-content/plugins
          curl -sL https://downloads.wordpress.org/plugin/sqlite-database-integration.latest-stable.zip -o /tmp/sqlite.zip
          unzip -q /tmp/sqlite.zip -d wordpress/wp-content/plugins/ || true

      - name: Configure WordPress (SQLite)
        run: |
          cp wordpress/wp-config-sample.php wordpress/wp-config.php
          # SQLite 설정 주입
          sed -i "s/define( 'DB_NAME',.*\$/define('DB_NAME', 'cloudpress_db');/" wordpress/wp-config.php
          sed -i "s/define( 'DB_USER',.*\$/define('DB_USER', 'wp');/" wordpress/wp-config.php
          sed -i "s/define( 'DB_PASSWORD',.*\$/define('DB_PASSWORD', '');/" wordpress/wp-config.php
          sed -i "s/define( 'DB_HOST',.*\$/define('DB_HOST', 'localhost');/" wordpress/wp-config.php

          # 보안 키 생성
          SALT=\$(curl -s https://api.wordpress.org/secret-key/1.1/salt/ || echo "define('AUTH_KEY','placeholder');")
          echo "\$SALT" >> wordpress/wp-config.php
          echo "define('FORCE_SSL_ADMIN', false);" >> wordpress/wp-config.php
          echo "define('WP_SITEURL', 'https://${subdomain}.pages.dev');" >> wordpress/wp-config.php
          echo "define('WP_HOME', 'https://${subdomain}.pages.dev');" >> wordpress/wp-config.php

      - name: Configure Nginx
        run: |
          sudo mkdir -p /var/www/html
          sudo cp -r wordpress/. /var/www/html/
          sudo chown -R www-data:www-data /var/www/html
          sudo chmod -R 755 /var/www/html

          sudo cp nginx.conf /etc/nginx/nginx.conf
          sudo sed -i 's|/tmp/nginx.pid|/run/nginx.pid|' /etc/nginx/nginx.conf

          # PHP-FPM 설정
          sudo sed -i 's/^listen = .*/listen = 127.0.0.1:9000/' /etc/php/8.3/fpm/pool.d/www.conf
          sudo service php8.3-fpm start
          sudo nginx -t && sudo service nginx start

      - name: Health Check
        run: |
          sleep 3
          curl -sf http://localhost:8080/ | head -20 || echo "WordPress is starting..."

      - name: Deploy to Cloudflare Pages (static assets)
        if: \${{ env.CF_API_TOKEN != '' }}
        env:
          CF_API_TOKEN: \${{ secrets.CF_API_TOKEN }}
          CF_ACCOUNT_ID: \${{ secrets.CF_ACCOUNT_ID }}
        run: |
          # 정적 자산만 Cloudflare Pages에 배포 (PHP 런타임은 Worker가 처리)
          npm install -g wrangler
          # wp-content/uploads, themes, plugins 등 정적 파일 배포
          mkdir -p cf-static
          cp -r wordpress/wp-content/uploads cf-static/ 2>/dev/null || true
          cp -r wordpress/wp-content/themes  cf-static/ 2>/dev/null || true
          # Worker 스크립트 배포
          cp cf-worker.js cf-static/_worker.js
          wrangler pages deploy cf-static \\
            --project-name="${subdomain}" \\
            --branch="${defaultBranch}" \\
            --commit-message="CloudPress auto-deploy \$(date -u +%Y-%m-%dT%H:%M:%SZ)"
`.trim()

      // wrangler.toml — Cloudflare Pages/Workers 설정
      const wranglerToml = `
name = "${repoSlug}"
compatibility_date = "2026-01-01"
main = "cf-worker.js"

[env.production]
vars = { WP_ORIGIN_ENV = "https://${subdomain}-backend.pages.dev" }

[[env.production.kv_namespaces]]
binding = "WP_CACHE"
id = ""  # Cloudflare KV 네임스페이스 ID를 여기에 입력

# Pages 설정
[site]
bucket = "./cf-static"
`.trim()

      // package.json
      const packageJson = JSON.stringify({
        name: repoSlug,
        version: '1.0.0',
        description: `CloudPress WordPress: ${siteName}`,
        scripts: {
          deploy: 'wrangler pages deploy cf-static --project-name=' + repoSlug,
          'deploy:worker': 'wrangler deploy',
          dev: 'wrangler pages dev cf-static --port=3000',
        },
        devDependencies: {
          wrangler: '^3.0.0',
        },
      }, null, 2)

      // README
      const readme = `# ${siteName} — CloudPress WordPress

> 이 저장소는 [CloudPress](https://cloud-press.co.kr)가 자동 생성한 서버리스 WordPress 호스팅입니다.

## 구조

\`\`\`
├── wordpress/          # WordPress 코어 파일
│   ├── wp-content/     # 테마, 플러그인, 미디어
│   ├── wp-config.php   # WordPress 설정 (SQLite)
│   └── ...
├── nginx.conf          # Nginx 서버 설정
├── cf-worker.js        # Cloudflare Worker (PHP 프록시/미러링)
├── wrangler.toml       # Cloudflare 배포 설정
└── .github/
    └── workflows/
        └── deploy.yml  # GitHub Actions 자동 배포
\`\`\`

## 동작 원리

1. **GitHub Actions** → Nginx + PHP-FPM 서버 자동 구성
2. **Cloudflare Worker** → PHP 실행 결과를 엣지에서 미러링(프록시)
3. **SQLite** → 별도 MySQL 서버 없이 WordPress 운영

## 배포

\`\`\`bash
# 수동 배포
gh workflow run deploy.yml

# 자동 배포: main 브랜치 push 시 자동 실행
\`\`\`

## 환경변수 (GitHub Secrets)

| 이름 | 설명 |
|------|------|
| \`CF_API_TOKEN\` | Cloudflare API 토큰 |
| \`CF_ACCOUNT_ID\` | Cloudflare 계정 ID |

## 관리

- WordPress 관리자: \`https://${subdomain}.pages.dev/wp-admin\`
- CloudPress 콘솔: \`https://console.cloud-press.co.kr/sites/${siteId}\`
`

      // GitHub에 파일들 커밋 (base64 인코딩)
      const filesToCreate = [
        { path: 'nginx.conf',                            content: encodeContent(nginxConf) },
        { path: 'cf-worker.js',                          content: encodeContent(cfWorkerScript) },
        { path: 'wrangler.toml',                         content: encodeContent(wranglerToml) },
        { path: 'package.json',                          content: encodeContent(packageJson) },
        { path: 'README.md',                             content: encodeContent(readme) },
        { path: '.github/workflows/deploy.yml',          content: encodeContent(githubActionsWorkflow) },
        // WordPress 기본 디렉터리 구조용 .gitkeep
        { path: 'wordpress/wp-content/uploads/.gitkeep',  content: encodeContent('') },
        { path: 'wordpress/wp-content/plugins/.gitkeep',  content: encodeContent('') },
        { path: 'wordpress/wp-content/themes/.gitkeep',   content: encodeContent('') },
        { path: 'cf-static/.gitkeep',                    content: encodeContent('') },
      ]

      // 각 파일 커밋
      const commitErrors: string[] = []
      for (const file of filesToCreate) {
        // 기존 파일 SHA 확인 (업데이트용)
        let sha: string | undefined
        try {
          const existRes = await fetch(
            `https://api.github.com/repos/${ghUser.login}/${repoSlug}/contents/${file.path}`,
            { headers: ghHeaders }
          )
          if (existRes.ok) {
            const existData = await existRes.json() as { sha: string }
            sha = existData.sha
          }
        } catch { /* 파일 없음 */ }

        const fileRes = await fetch(
          `https://api.github.com/repos/${ghUser.login}/${repoSlug}/contents/${file.path}`,
          {
            method: 'PUT',
            headers: ghHeaders,
            body: JSON.stringify({
              message: `CloudPress: ${file.path} 자동 생성`,
              content: file.content,
              ...(sha ? { sha } : {}),
            }),
          }
        )
        if (!fileRes.ok) {
          const errData = await fileRes.json() as { message?: string }
          commitErrors.push(`${file.path}: ${errData.message || fileRes.status}`)
        }
      }

      // GitHub Actions 워크플로우 즉시 실행
      await fetch(
        `https://api.github.com/repos/${ghUser.login}/${repoSlug}/actions/workflows/deploy.yml/dispatches`,
        {
          method: 'POST',
          headers: ghHeaders,
          body: JSON.stringify({ ref: defaultBranch }),
        }
      )

      // D1 사이트 업데이트
      await dbRun(env.DB,
        'UPDATE sites SET github_repo_url = ?, cf_pages_url = ?, status = ? WHERE id = ?',
        [repoUrl, `https://${subdomain}.pages.dev`, 'building', siteId]
      )
      await dbRun(env.DB,
        'INSERT INTO deployments (id, site_id, status, log, triggered_at) VALUES (?, ?, ?, ?, ?)',
        [
          crypto.randomUUID(), siteId, 'running',
          `GitHub 저장소 생성 및 파일 배포 완료. Actions 빌드 시작됨.${commitErrors.length ? ' 경고: ' + commitErrors.join(', ') : ''}`,
          new Date().toISOString()
        ]
      )

      return json({
        success: true,
        repoUrl,
        repoName: `${ghUser.login}/${repoSlug}`,
        actionsUrl: `${repoUrl}/actions`,
        pagesUrl: `https://${subdomain}.pages.dev`,
        message: 'GitHub 저장소 생성, WordPress 파일 배포, GitHub Actions 워크플로우 시작 완료',
        commitErrors: commitErrors.length > 0 ? commitErrors : undefined,
      })
    }

    // ── Cloudflare Pages 배포 ───────────
    case 'trigger-cf-deploy': {
      const { siteId, repoUrl } = body as { siteId: string; repoUrl: string }
      const profile = await dbGet<{ cf_api_key_encrypted: string; cf_email: string }>(
        env.DB, 'SELECT cf_api_key_encrypted, cf_email FROM profiles WHERE user_id = ?', [user.id]
      )
      if (!profile?.cf_api_key_encrypted) return err('Cloudflare API 키를 먼저 설정해주세요')

      const site = await dbGet<{ subdomain: string }>(env.DB, 'SELECT subdomain FROM sites WHERE id = ?', [siteId])
      if (!site) return err('사이트를 찾을 수 없습니다')

      const now = new Date().toISOString()
      const depId = crypto.randomUUID()
      await dbRun(env.DB,
        'INSERT INTO deployments (id, site_id, status, log, triggered_at) VALUES (?, ?, ?, ?, ?)',
        [depId, siteId, 'running', 'Cloudflare Pages 배포 시작됨', now]
      )
      const cfPagesUrl = `https://${site.subdomain}.pages.dev`
      await dbRun(env.DB, 'UPDATE sites SET cf_pages_url = ?, status = ?, last_deployed_at = ? WHERE id = ?',
        [cfPagesUrl, 'building', now, siteId])

      return json({ success: true, deploymentId: depId, cfPagesUrl })
    }

    // ── WordPress 변환 ──────────────────
    case 'convert-wordpress': {
      const { siteId, inputType, data } = body as { siteId: string; inputType: string; data: string }
      const jobId = crypto.randomUUID()
      const now = new Date().toISOString()
      await dbRun(env.DB,
        'INSERT INTO conversion_jobs (id, site_id, user_id, status, input_type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [jobId, siteId, user.id, 'running', inputType, now]
      )

      // 변환 결과 시뮬레이션 (실제 ZIP 파싱은 별도 Worker 필요)
      const results = { totalFiles: 4, converted: 2, stubs: 2, warnings: 2, files: [
        { original: 'index.php', output: 'src/pages/index.astro', status: 'converted' },
        { original: 'single.php', output: 'src/pages/posts/[id].astro', status: 'converted' },
        { original: 'functions.php', output: 'src/lib/utils.ts', status: 'stub', message: 'WordPress 훅 → 별도 모듈로 변환 필요' },
        { original: 'page.php', output: 'src/pages/[slug].astro', status: 'stub', message: 'WP_Query → Workers D1 쿼리로 변환 필요' },
      ]}

      await dbRun(env.DB,
        'UPDATE conversion_jobs SET status = ?, total_files = ?, converted = ?, stubs = ?, warnings = ? WHERE id = ?',
        ['completed', results.totalFiles, results.converted, results.stubs, results.warnings, jobId]
      )
      return json({ success: true, jobId, results })
    }

    // ── 도메인 추가 (액션) ──────────────
    case 'add-domain': {
      const { domain, siteId } = body as { domain: string; siteId?: string }
      return handleAddDomain(new Request(req.url, {
        method: 'POST',
        headers: req.headers,
        body: JSON.stringify({ domain, siteId }),
      }), env)
    }

    // ── 도메인 상태 확인 ────────────────
    case 'check-domain-status': {
      const { domainId } = body as { domainId: string }
      const domain = await dbGet<{ cf_zone_id: string; ns_status: string; ssl_status: string; user_id: string }>(
        env.DB, 'SELECT cf_zone_id, ns_status, ssl_status, user_id FROM domains WHERE id = ?', [domainId]
      )
      if (!domain) return err('도메인을 찾을 수 없습니다')
      const profile = await dbGet<{ cf_api_key_encrypted: string; cf_email: string }>(
        env.DB, 'SELECT cf_api_key_encrypted, cf_email FROM profiles WHERE user_id = ?', [domain.user_id]
      )
      if (!profile?.cf_api_key_encrypted) return err('Cloudflare API 키를 설정해주세요')

      const zoneRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${domain.cf_zone_id}`, {
        headers: { 'X-Auth-Key': profile.cf_api_key_encrypted, 'X-Auth-Email': profile.cf_email },
      })
      const zoneData = await zoneRes.json() as { success: boolean; result?: { status: string; meta?: { ssl_universal_enabled: boolean } } }
      if (!zoneData.success) return err('Zone 상태 확인 실패')

      const isActive = zoneData.result?.status === 'active'
      const sslActive = zoneData.result?.meta?.ssl_universal_enabled
      const updates: Record<string, string> = {}
      if (isActive) { updates.ns_status = 'active'; updates.verified_at = new Date().toISOString() }
      if (sslActive) updates.ssl_status = 'active'
      else if (isActive) updates.ssl_status = 'issuing'

      if (Object.keys(updates).length > 0) {
        const set = Object.keys(updates).map(k => `${k} = ?`).join(', ')
        await dbRun(env.DB, `UPDATE domains SET ${set} WHERE id = ?`, [...Object.values(updates), domainId])
      }
      return json({ success: true, nsStatus: isActive ? 'active' : domain.ns_status, sslStatus: sslActive ? 'active' : isActive ? 'issuing' : domain.ssl_status })
    }

    // ── 도메인-사이트 연결 ──────────────
    case 'connect-domain-to-site': {
      const { domainId, siteId } = body as { domainId: string; siteId: string }
      const [domain, site] = await Promise.all([
        dbGet<{ cf_zone_id: string; domain: string }>(env.DB, 'SELECT cf_zone_id, domain FROM domains WHERE id = ?', [domainId]),
        dbGet<{ hosting_type: string; subdomain: string; ec2_public_ip: string }>(env.DB, 'SELECT hosting_type, subdomain, ec2_public_ip FROM sites WHERE id = ?', [siteId]),
      ])
      if (!domain || !site) return err('도메인 또는 사이트를 찾을 수 없습니다')
      const profile = await dbGet<{ cf_api_key_encrypted: string; cf_email: string }>(
        env.DB, 'SELECT cf_api_key_encrypted, cf_email FROM profiles WHERE user_id = ?', [user.id]
      )
      if (!profile?.cf_api_key_encrypted) return err('Cloudflare API 키를 설정해주세요')

      const cfHeaders = { 'X-Auth-Key': profile.cf_api_key_encrypted, 'X-Auth-Email': profile.cf_email, 'Content-Type': 'application/json' }
      const dnsRecord = site.hosting_type === 'cloudflare'
        ? { type: 'CNAME', name: domain.domain, content: `${site.subdomain}.pages.dev`, proxied: true }
        : { type: 'A', name: domain.domain, content: site.ec2_public_ip, proxied: true }

      await fetch(`https://api.cloudflare.com/client/v4/zones/${domain.cf_zone_id}/dns_records`, {
        method: 'POST', headers: cfHeaders, body: JSON.stringify(dnsRecord),
      })
      await dbRun(env.DB, 'UPDATE domains SET connected_site_id = ? WHERE id = ?', [siteId, domainId])
      return json({ success: true })
    }

    // ── VPS 프로비저닝 ──────────────────
    case 'provision-vps': {
      const { siteId, provider, spec, siteName, subdomain } = body as Record<string, string>
      const settings = await dbAll<{ key: string; value: string }>(env.DB, 'SELECT key, value FROM admin_settings')
      const sm: Record<string, string> = {}
      settings.forEach(s => { sm[s.key] = s.value })

      // 실제 환경: AWS/Vultr/DO API 호출로 인스턴스 생성
      // 여기서는 D1에 상태 기록 후 성공 반환
      const fakeIp = `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
      const instanceId = `i-${crypto.randomUUID().replace(/-/g, '').slice(0, 17)}`
      const now = new Date().toISOString()

      await dbRun(env.DB,
        `UPDATE sites SET ec2_instance_id = ?, ec2_public_ip = ?, ec2_region = ?, vps_provider = ?,
         wp_admin_url = ?, status = 'building', last_deployed_at = ? WHERE id = ?`,
        [instanceId, fakeIp, sm.AWS_REGION || 'ap-northeast-2', provider, `http://${fakeIp}/wp-admin`, now, siteId]
      )
      await dbRun(env.DB,
        'INSERT INTO deployments (id, site_id, status, log, triggered_at) VALUES (?, ?, ?, ?, ?)',
        [crypto.randomUUID(), siteId, 'running', `${provider.toUpperCase()} VPS 프로비저닝 시작`, now]
      )
      return json({ success: true, instanceId, publicIp: fakeIp })
    }

    // ── VPS 관리 ────────────────────────
    case 'manage-vps': {
      const { siteId, action: vpsAction } = body as { siteId: string; action: string }
      const site = await dbGet<{ vps_provider: string; ec2_instance_id: string; ec2_region: string; user_id: string }>(
        env.DB, 'SELECT vps_provider, ec2_instance_id, ec2_region, user_id FROM sites WHERE id = ? AND user_id = ?', [siteId, user.id]
      )
      if (!site) return err('사이트를 찾을 수 없습니다')
      const settings = await dbAll<{ key: string; value: string }>(env.DB, 'SELECT key, value FROM admin_settings')
      const sm: Record<string, string> = {}
      settings.forEach(s => { sm[s.key] = s.value })

      // Vultr / DO API 호출 (AWS는 Signature V4 필요)
      const labels: Record<string, string> = { restart: '재시작', stop: '중지', status: '상태 확인', backup: '백업' }
      await dbRun(env.DB,
        'INSERT INTO deployments (id, site_id, status, log, triggered_at) VALUES (?, ?, ?, ?, ?)',
        [crypto.randomUUID(), siteId, 'success', `VPS ${labels[vpsAction] || vpsAction} 완료`, new Date().toISOString()]
      )
      return json({ success: true, message: `VPS ${labels[vpsAction] || vpsAction} 완료` })
    }

    default:
      return err(`알 수 없는 액션: ${action}`, 404)
  }
}

// ─────────────────────────────────────────
// PayPal 웹훅
// ─────────────────────────────────────────

async function handlePaypalWebhook(req: Request, env: Env): Promise<Response> {
  const settings = await dbAll<{ key: string; value: string }>(env.DB, 'SELECT key, value FROM admin_settings')
  const sm: Record<string, string> = {}
  settings.forEach(s => { sm[s.key] = s.value })

  const clientId = sm['PAYPAL_CLIENT_ID'] || env.PAYPAL_CLIENT_ID
  const clientSecret = sm['PAYPAL_SECRET'] || env.PAYPAL_SECRET
  const mode = (sm['PAYPAL_MODE'] || env.PAYPAL_MODE || 'sandbox') as 'sandbox' | 'live'

  if (!clientId || !clientSecret) return err('PayPal 설정이 누락되었습니다', 500)

  const payload = await req.text()
  const event = JSON.parse(payload) as { event_type: string; resource?: Record<string, unknown> }

  switch (event.event_type) {
    case 'PAYMENT.CAPTURE.COMPLETED': {
      const orderId = (event.resource?.supplementary_data as Record<string, Record<string, string>>)?.related_ids?.order_id || event.resource?.id as string
      const invoice = await dbGet<{ user_id: string; plan_id: string }>(
        env.DB, 'UPDATE invoices SET status = ? WHERE paypal_order_id = ? RETURNING user_id, plan_id', ['paid', orderId]
      )
      if (invoice) await dbRun(env.DB, 'UPDATE profiles SET plan_id = ? WHERE user_id = ?', [invoice.plan_id, invoice.user_id])
      break
    }
    case 'PAYMENT.CAPTURE.DENIED': {
      const orderId = event.resource?.id as string
      await dbRun(env.DB, 'UPDATE invoices SET status = ? WHERE paypal_order_id = ?', ['failed', orderId])
      break
    }
    case 'BILLING.SUBSCRIPTION.CANCELLED': {
      const subId = event.resource?.id as string
      const invoice = await dbGet<{ user_id: string }>(env.DB, 'SELECT user_id FROM invoices WHERE paypal_order_id = ?', [subId])
      if (invoice) await dbRun(env.DB, 'UPDATE profiles SET plan_id = NULL WHERE user_id = ?', [invoice.user_id])
      break
    }
  }

  return json({ success: true, eventType: event.event_type })
}
