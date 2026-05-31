// src/middleware/index.ts
import type { MiddlewareHandler } from 'astro';
import { getTokenFromRequest, verifyJWT } from '../lib/utils/jwt.ts';
import { getUserById, getSession } from '../lib/db/index.ts';
import type { Env } from '../types/index.ts';

const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/refresh',
]);

export const onRequest: MiddlewareHandler = async ({ request, locals, url, redirect }, next) => {
  const runtime = (locals as { runtime?: { env: Env } }).runtime;
  const env = runtime?.env;

  if (!env) return next();

  // Attach env to locals
  (locals as Record<string, unknown>).env = env;

  // Skip auth for public paths and static assets
  const pathname = url.pathname;
  const isPublic = PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith('/api/public/') ||
    pathname.startsWith('/_astro/') ||
    pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|webp|ico|woff2?)$/);

  if (isPublic) return next();

  // Authenticate
  const token = getTokenFromRequest(request);
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ success: false, error: '인증이 필요합니다.' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }
    return redirect('/login?redirect=' + encodeURIComponent(pathname));
  }

  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ success: false, error: '유효하지 않은 토큰입니다.' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }
    return redirect('/login?reason=expired');
  }

  // Validate session still exists in D1
  const session = await getSession(env.DB, payload.sid);
  if (!session) {
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ success: false, error: '세션이 만료되었습니다.' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }
    return redirect('/login?reason=session_expired');
  }

  // Load user
  const user = await getUserById(env.DB, payload.sub);
  if (!user || user.is_suspended) {
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ success: false, error: '계정이 정지되었습니다.' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      });
    }
    return redirect('/login?reason=suspended');
  }

  // Attach user to locals
  (locals as Record<string, unknown>).user = user;
  (locals as Record<string, unknown>).sessionId = payload.sid;

  // Admin-only paths
  if ((pathname.startsWith('/admin') || pathname.startsWith('/api/admin/')) && user.role !== 'admin') {
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ success: false, error: '관리자 권한이 필요합니다.' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      });
    }
    return redirect('/dashboard');
  }

  return next();
};