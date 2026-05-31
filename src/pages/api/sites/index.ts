// src/pages/api/sites/index.ts
import type { APIRoute } from 'astro';
import { getSitesByUser, createSite, getSiteBySubdomain } from '../../../lib/db/index.ts';
import { decrypt, encrypt, generateSecret } from '../../../lib/utils/crypto.ts';
import { CloudflareClient, buildHeadlessWorkerScript } from '../../../lib/api/cloudflare.ts';
import { GitHubClient } from '../../../lib/api/github.ts';
import { WordPressClient } from '../../../lib/api/wordpress.ts';
import { createDeployment, updateDeployment, updateSite } from '../../../lib/db/index.ts';
import type { Env, User } from '../../../types/index.ts';

export const GET: APIRoute = async ({ locals }) => {
  const env = (locals as { env: Env }).env;
  const user = (locals as { user: User }).user;
  try {
    const sites = await getSitesByUser(env.DB, user.id);
    return Response.json({ success: true, data: sites });
  } catch (err) {
    return Response.json({ success: false, error: '사이트 목록을 불러오는 중 오류가 발생했습니다.' }, { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as { env: Env }).env;
  const user = (locals as { user: User }).user;

  try {
    const body = await request.json() as {
      name?: string;
      subdomain?: string;
      wp_url?: string;
      wp_username?: string;
      wp_app_password?: string;
      wp_site_title?: string;
    };

    const { name, subdomain, wp_url, wp_username, wp_app_password } = body;

    // Validation
    if (!name || !subdomain || !wp_url || !wp_username || !wp_app_password) {
      return Response.json({ success: false, error: '모든 필수 항목을 입력해주세요.' }, { status: 400 });
    }

    const subRe = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
    if (!subRe.test(subdomain)) {
      return Response.json({ success: false, error: '서브도메인은 영문 소문자, 숫자, 하이픈만 사용 가능하며 3~32자여야 합니다.' }, { status: 400 });
    }

    const existing = await getSiteBySubdomain(env.DB, subdomain);
    if (existing) {
      return Response.json({ success: false, error: '이미 사용 중인 서브도메인입니다.' }, { status: 409 });
    }

    // Check user has CF and GH credentials
    if (!user.cf_api_key_enc || !user.cf_email || !user.gh_token_enc) {
      return Response.json({
        success: false,
        error: '사이트를 만들려면 먼저 [내 정보 관리]에서 Cloudflare API 키와 GitHub 토큰을 설정해주세요.',
      }, { status: 422 });
    }

    // Decrypt credentials
    const cfApiKey = await decrypt(user.cf_api_key_enc, env.ENCRYPTION_KEY);
    const ghToken = await decrypt(user.gh_token_enc, env.ENCRYPTION_KEY);

    // Verify WordPress credentials
    const wpClient = new WordPressClient({ baseUrl: wp_url, username: wp_username, appPassword: wp_app_password });
    const wpVerify = await wpClient.verifyCredentials();
    if (!wpVerify.valid) {
      return Response.json({
        success: false,
        error: `WordPress 연결에 실패했습니다: ${wpVerify.error}. WordPress URL과 애플리케이션 비밀번호를 확인해주세요.`,
      }, { status: 422 });
    }

    const wp_site_title = body.wp_site_title || wpVerify.siteTitle || name;
    const webhookSecret = generateSecret(32);

    // Encrypt WP app password
    const wp_app_password_enc = await encrypt(wp_app_password, env.ENCRYPTION_KEY);

    // Create site record (pending)
    const repoName = `cp-${subdomain}`;
    const site = await createSite(env.DB, {
      user_id: user.id,
      name,
      subdomain,
      product_type: 'wordpress_headless',
      wp_url: wp_url.replace(/\/$/, ''),
      wp_username,
      wp_app_password_enc,
      wp_site_title,
      gh_repo_name: repoName,
      webhook_secret: webhookSecret,
      status: 'building',
    });

    // Start async provisioning
    const deployment = await createDeployment(env.DB, {
      site_id: site.id,
      user_id: user.id,
      trigger_type: 'manual',
    });

    // Return immediately, provision in background
    (async () => {
      const logs: string[] = [];
      try {
        logs.push('GitHub 저장소를 생성하는 중...');
        const ghClient = new GitHubClient(ghToken);
        const repo = await ghClient.createRepo(repoName, {
          description: `CloudPress 헤드리스 사이트: ${name}`,
          private: false,
          auto_init: true,
        });
        logs.push(`✅ GitHub 저장소 생성: ${repo.full_name}`);

        await ghClient.initSiteRepo(repo.full_name, site.id, name, wp_url);
        logs.push('✅ 저장소 초기화 완료');

        // Update site with repo info
        await updateSite(env.DB, site.id, {
          gh_repo_full_name: repo.full_name,
          gh_repo_url: repo.html_url,
        });

        logs.push('Cloudflare Worker를 생성하는 중...');
        // Get CF account ID
        const cfClient = new CloudflareClient(cfApiKey, user.cf_email!, '');
        const cfVerify = await cfClient.verifyCredentials();
        if (!cfVerify.valid) throw new Error('Cloudflare 인증 실패');

        // Re-init with real account ID
        const cfAccountId = cfVerify.accountId!;
        const cfFull = new CloudflareClient(cfApiKey, user.cf_email!, cfAccountId);

        const workerName = `cp-${subdomain}`;
        const workerScript = buildHeadlessWorkerScript({
          siteId: site.id,
          wpUrl: wp_url,
          ghRepoFullName: repo.full_name,
          ghToken,
          webhookSecret,
          siteName: name,
          siteDescription: wp_site_title,
          cacheTtl: 60,
        });

        await cfFull.createWorker(workerName, workerScript);
        logs.push(`✅ Cloudflare Worker 배포: ${workerName}`);

        // Get worker subdomain URL
        const workerSubdomain = await cfFull.getWorkerSubdomain().catch(() => 'workers.dev');
        const workerUrl = `https://${workerName}.${workerSubdomain}.workers.dev`;

        await updateSite(env.DB, site.id, {
          cf_worker_name: workerName,
          cf_worker_url: workerUrl,
          status: 'active',
          last_deployed_at: new Date().toISOString(),
          wp_detection_status: 'detected',
        });

        logs.push(`✅ 사이트 활성화 완료! URL: ${workerUrl}`);

        await updateDeployment(env.DB, deployment.id, {
          status: 'success',
          log: logs.join('\n'),
          completed_at: new Date().toISOString(),
        });
      } catch (err) {
        logs.push(`❌ 오류: ${String(err)}`);
        await updateSite(env.DB, site.id, { status: 'error' });
        await updateDeployment(env.DB, deployment.id, {
          status: 'error',
          log: logs.join('\n'),
          completed_at: new Date().toISOString(),
        });
      }
    })();

    return Response.json({
      success: true,
      data: { site, deployment_id: deployment.id },
      message: '사이트 생성이 시작되었습니다. 잠시 후 완료됩니다.',
    }, { status: 201 });

  } catch (err) {
    console.error('Site creation error:', err);
    return Response.json({ success: false, error: '사이트 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
};