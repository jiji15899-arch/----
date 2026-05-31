// src/pages/api/auth/register.ts
import type { APIRoute } from 'astro';
import { getUserByEmail, createUser, createSession } from '../../../lib/db/index.ts';
import { hashPassword } from '../../../lib/utils/crypto.ts';
import { signJWT } from '../../../lib/utils/jwt.ts';
import type { Env } from '../../../types/index.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as { env: Env }).env;

  try {
    const body = await request.json() as { email?: string; password?: string; name?: string };
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return Response.json({ success: false, error: '모든 항목을 입력해주세요.' }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return Response.json({ success: false, error: '올바른 이메일 주소를 입력해주세요.' }, { status: 400 });
    }
    if (password.length < 8) {
      return Response.json({ success: false, error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 });
    }
    if (name.trim().length < 2) {
      return Response.json({ success: false, error: '이름은 2자 이상이어야 합니다.' }, { status: 400 });
    }

    const existing = await getUserByEmail(env.DB, email.toLowerCase().trim());
    if (existing) {
      return Response.json({ success: false, error: '이미 가입된 이메일입니다.' }, { status: 409 });
    }

    const password_hash = await hashPassword(password);
    const user = await createUser(env.DB, {
      email: email.toLowerCase().trim(),
      password_hash,
      name: name.trim(),
    });

    // Auto-login after register
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const session = await createSession(env.DB, user.id, expiresAt);
    const token = await signJWT({
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      sid: session.id,
    }, env.JWT_SECRET);

    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append('Set-Cookie',
      `cp_token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 3600}`
    );

    return new Response(JSON.stringify({
      success: true,
      data: {
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role, plan_id: user.plan_id },
      },
      message: '회원가입이 완료되었습니다. 클라우드프레스에 오신 것을 환영합니다! 🎉',
    }), { status: 201, headers });
  } catch (err) {
    console.error('Register error:', err);
    return Response.json({ success: false, error: '회원가입 중 오류가 발생했습니다.' }, { status: 500 });
  }
};