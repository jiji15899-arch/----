// src/pages/api/auth/logout.ts
import type { APIRoute } from 'astro';
import { deleteSession } from '../../../lib/db/index.ts';
import { getTokenFromRequest, verifyJWT } from '../../../lib/utils/jwt.ts';
import type { Env } from '../../../types/index.ts';

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as { env: Env }).env;
  const token = getTokenFromRequest(request);
  if (token && env?.JWT_SECRET) {
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (payload?.sid) await deleteSession(env.DB, payload.sid).catch(() => {});
  }
  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', 'cp_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
  return new Response(JSON.stringify({ success: true, message: '로그아웃되었습니다.' }), { status: 200, headers });
};