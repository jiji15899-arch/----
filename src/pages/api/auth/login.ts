// src/pages/api/auth/login.ts
import type { APIRoute } from 'astro';
import { getUserByEmail, createSession } from '../../../lib/db/index.ts';
import { verifyPassword } from '../../../lib/utils/crypto.ts';
import { signJWT } from '../../../lib/utils/jwt.ts';
import type { Env } from '../../../types/index.ts';

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as { env: Env }).env;

  try {
    const body = await request.json() as { email?: string; password?: string };
    const { email, password } = body;

    if (!email || !password) {
      return Response.json({ success: false, error: '이메일과 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    const user = await getUserByEmail(env.DB, email.toLowerCase().trim());
    if (!user || !user.password_hash) {
      return Response.json({ success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return Response.json({ success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    if (user.is_suspended) {
      return Response.json({ success: false, error: '계정이 정지되었습니다. 고객센터에 문의해주세요.' }, { status: 403 });
    }

    // Create session (7 days)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const session = await createSession(env.DB, user.id, expiresAt);

    // Sign JWT
    const token = await signJWT({
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      sid: session.id,
    }, env.JWT_SECRET);

    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.append('Set-Cookie',
      `cp_token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 3600}`
    );

    return new Response(JSON.stringify({
      success: true,
      data: {
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role, plan_id: user.plan_id },
      },
    }), { status: 200, headers });
  } catch (err) {
    console.error('Login error:', err);
    return Response.json({ success: false, error: '로그인 중 오류가 발생했습니다.' }, { status: 500 });
  }
};