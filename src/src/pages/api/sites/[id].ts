// src/pages/api/sites/[id].ts
import type { APIRoute } from 'astro';
import { getSiteById, updateSite, deleteSite, createDeployment, updateDeployment } from '../../../lib/db/index.ts';
import { decrypt } from '../../../lib/utils/crypto.ts';
import { CloudflareClient, buildHeadlessWorkerScript } from '../../../lib/api/cloudflare.ts';
import { GitHubClient } from '../../../lib/api/github.ts';
import type { Env, User } from '../../../types/index.ts';

export const GET: APIRoute = async ({ params, locals }) => {
  const env = (locals as { env: Env }).env;
  const user = (locals as { user: User }).user;
  const { id } = params;

  const site = await getSiteById(env.DB, id!);
  if (!site || (site.user_id !== user.id && user.role !== 'admin')) {
    return Response.json({ success: false, error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
  }
  return Response.json({ success: true, data: site });
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const env = (locals as { env: Env }).env;
  const user = (locals as { user: User }).user;
  const { id } = params;

  const site = await getSiteById(env.DB, id!);
  if (!site || (site.user_id !== user.id && user.role !== 'admin')) {
    return Response.json({ success: false, error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const allowed = ['name', 'isr_enabled', 'cache_ttl', 'custom_domain', 'status'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }
    if (Object.keys(updates).length) {
      await updateSite(env.DB, id!, updates);
    }
    const updated = await getSiteById(env.DB, id!);
    return Response.json({ success: true, data: updated });
  } catch {
    return Response.json({ success: false, error: '사이트 업데이트 중 오류가 발생했습니다.' }, { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const env = (locals as { env: Env }).env;
  const user = (locals as { user: User }).user;
  const { id } = params;

  const site = await getSiteById(env.DB, id!);
  if (!site || (site.user_id !== user.id && user.role !== 'admin')) {
    return Response.json({ success: false, error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
  }

  try {
    // Clean up Cloudflare Worker and GitHub repo in background
    if (user.cf_api_key_enc && user.cf_email && site.cf_worker_name) {
      const cfApiKey = await decrypt(user.cf_api_key_enc, env.ENCRYPTION_KEY).catch(() => '');
      if (cfApiKey) {
        const cfClient = new CloudflareClient(cfApiKey, user.cf_email, '');
        const acct = await cfClient.verifyCredentials().catch(() => ({ valid: false }));
        if (acct.valid && acct.accountId) {
          const cf = new CloudflareClient(cfApiKey, user.cf_email, acct.accountId);
          await cf.deleteWorker(site.cf_worker_name).catch(() => {});
        }
      }
    }

    if (user.gh_token_enc && site.gh_repo_full_name) {
      const ghToken = await decrypt(user.gh_token_enc, env.ENCRYPTION_KEY).catch(() => '');
      if (ghToken) {
        const gh = new GitHubClient(ghToken);
        await gh.deleteRepo(site.gh_repo_full_name).catch(() => {});
      }
    }

    await deleteSite(env.DB, id!);
    return Response.json({ success: true, message: '사이트가 삭제되었습니다.' });
  } catch (err) {
    return Response.json({ success: false, error: '사이트 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
};

// POST /api/sites/[id]/redeploy
export const POST: APIRoute = async ({ params, request, locals }) => {
  const env = (locals as { env: Env }).env;
  const user = (locals as { user: User }).user;
  const { id } = params;

  const url = new URL(request.url);
  if (!url.pathname.endsWith('/redeploy')) {
    return Response.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const site = await getSiteById(env.DB, id!);
  if (!site || (site.user_id !== user.id && user.role !== 'admin')) {
    return Response.json({ success: false, error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
  }

  if (!user.cf_api_key_enc || !user.cf_email || !user.gh_token_enc) {
    return Response.json({ success: false, error: 'Cloudflare 및 GitHub 자격증명을 먼저 설정해주세요.' }, { status: 422 });
  }

  try {
    const cfApiKey = await decrypt(user.cf_api_key_enc, env.ENCRYPTION_KEY);
    const ghToken = await decrypt(user.gh_token_enc, env.ENCRYPTION_KEY);

    const cfClient = new CloudflareClient(cfApiKey, user.cf_email, '');
    const acct = await cfClient.verifyCredentials();
    if (!acct.valid || !acct.accountId) {
      return Response.json({ success: false, error: 'Cloudflare 인증에 실패했습니다.' }, { status: 422 });
    }

    const deployment = await createDeployment(env.DB, { site_id: site.id, user_id: user.id, trigger_type: 'manual' });

    (async () => {
      const logs: string[] = ['워커 재배포를 시작합니다...'];
      try {
        const cf = new CloudflareClient(cfApiKey, user.cf_email!, acct.accountId!);
        const workerName = site.cf_worker_name || `cp-${site.subdomain}`;
        const workerScript = buildHeadlessWorkerScript({
          siteId: site.id,
          wpUrl: site.wp_url!,
          ghRepoFullName: site.gh_repo_full_name!,
          ghToken,
          webhookSecret: site.webhook_secret!,
          siteName: site.name,
          siteDescription: site.wp_site_title,
          cacheTtl: site.cache_ttl || 60,
        });

        await cf.createWorker(workerName, workerScript);
        logs.push('✅ Cloudflare Worker 재배포 완료');

        await updateSite(env.DB, site.id, {
          status: 'active',
          last_deployed_at: new Date().toISOString(),
        });

        await updateDeployment(env.DB, deployment.id, {
          status: 'success',
          log: logs.join('\n'),
          completed_at: new Date().toISOString(),
        });
      } catch (err) {
        logs.push(`❌ ${String(err)}`);
        await updateDeployment(env.DB, deployment.id, {
          status: 'error',
          log: logs.join('\n'),
          completed_at: new Date().toISOString(),
        });
      }
    })();

    return Response.json({ success: true, data: { deployment_id: deployment.id }, message: '재배포가 시작되었습니다.' });
  } catch {
    return Response.json({ success: false, error: '재배포 중 오류가 발생했습니다.' }, { status: 500 });
  }
};