// src/pages/api/profile/index.ts
import type { APIRoute } from 'astro';
import { updateUser, getUserById } from '../../../lib/db/index.ts';
import { encrypt, decrypt } from '../../../lib/utils/crypto.ts';
import { CloudflareClient } from '../../../lib/api/cloudflare.ts';
import { GitHubClient } from '../../../lib/api/github.ts';
import type { Env, User } from '../../../types/index.ts';

export const GET: APIRoute = async ({ locals }) => {
  const env = (locals as { env: Env }).env;
  const user = (locals as { user: User }).user;
  // Return safe user info (no encrypted fields)
  const safe = {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
    role: user.role,
    plan_id: user.plan_id,
    has_cf: !!user.cf_api_key_enc,
    has_gh: !!user.gh_token_enc,
    cf_email: user.cf_email,
    created_at: user.created_at,
  };
  return Response.json({ success: true, data: safe });
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  const env = (locals as { env: Env }).env;
  const user = (locals as { user: User }).user;

  try {
    const body = await request.json() as {
      name?: string;
      cf_api_key?: string;
      cf_email?: string;
      gh_token?: string;
      action?: 'validate_cf' | 'validate_gh' | 'update_profile';
    };

    const action = body.action || 'update_profile';

    // Validate Cloudflare credentials
    if (action === 'validate_cf') {
      if (!body.cf_api_key || !body.cf_email) {
        return Response.json({ success: false, error: 'API 키와 이메일을 모두 입력해주세요.' }, { status: 400 });
      }
      const cf = new CloudflareClient(body.cf_api_key, body.cf_email, '');
      const result = await cf.verifyCredentials();
      if (!result.valid) {
        return Response.json({ success: false, error: '유효하지 않은 Cloudflare API 키입니다.' }, { status: 422 });
      }
      // Save encrypted
      const enc = await encrypt(body.cf_api_key, env.ENCRYPTION_KEY);
      await updateUser(env.DB, user.id, { cf_api_key_enc: enc, cf_email: body.cf_email });
      return Response.json({ success: true, message: '✅ Cloudflare API 키가 검증되어 저장되었습니다.' });
    }

    // Validate GitHub token
    if (action === 'validate_gh') {
      if (!body.gh_token) {
        return Response.json({ success: false, error: 'GitHub 토큰을 입력해주세요.' }, { status: 400 });
      }
      const gh = new GitHubClient(body.gh_token);
      const result = await gh.verifyToken();
      if (!result.valid) {
        return Response.json({ success: false, error: '유효하지 않은 GitHub 토큰입니다. repo, workflow 권한이 있는지 확인해주세요.' }, { status: 422 });
      }
      const enc = await encrypt(body.gh_token, env.ENCRYPTION_KEY);
      await updateUser(env.DB, user.id, { gh_token_enc: enc });
      return Response.json({ success: true, message: `✅ GitHub 토큰이 검증되어 저장되었습니다. (계정: ${result.login})` });
    }

    // Update profile
    const updates: Record<string, unknown> = {};
    if (body.name?.trim()) updates.name = body.name.trim();
    if (Object.keys(updates).length) {
      await updateUser(env.DB, user.id, updates);
    }

    const updated = await getUserById(env.DB, user.id);
    return Response.json({ success: true, data: updated, message: '프로필이 업데이트되었습니다.' });
  } catch (err) {
    return Response.json({ success: false, error: '프로필 업데이트 중 오류가 발생했습니다.' }, { status: 500 });
  }
};