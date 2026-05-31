// src/pages/api/webhook/[siteId].ts
// WordPress sends webhooks here → CloudPress purges KV cache on the Worker

import type { APIRoute } from 'astro';
import { getSiteById, createDeployment, updateDeployment } from '../../../lib/db/index.ts';
import type { Env } from '../../../types/index.ts';

export const POST: APIRoute = async ({ params, request, locals }) => {
  const env = (locals as { env: Env }).env;
  const { siteId } = params;

  try {
    const site = await getSiteById(env.DB, siteId!);
    if (!site) {
      return Response.json({ success: false, error: 'Site not found' }, { status: 404 });
    }

    // Verify webhook secret
    const secret = request.headers.get('X-CP-Secret') ||
                   request.headers.get('X-WP-Nonce') ||
                   new URL(request.url).searchParams.get('secret');

    if (secret !== site.webhook_secret) {
      return Response.json({ success: false, error: 'Invalid secret' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as {
      event?: string;
      post_id?: number;
      post_slug?: string;
      post_status?: string;
      post_type?: string;
    };

    const event = body.event || 'publish';
    const slug = body.post_slug;
    const postId = body.post_id;

    // Purge cache on the Cloudflare Worker via its internal endpoint
    if (site.cf_worker_url && site.webhook_secret) {
      const pathsToPurge: string[] = ['/'];
      if (slug) {
        pathsToPurge.push(`/${slug}/`);
        // Also purge category/tag archive pages
        pathsToPurge.push('/category/');
        pathsToPurge.push('/tag/');
      }

      await fetch(`${site.cf_worker_url}/__cp/purge`, {
        method: 'POST',
        headers: {
          'X-CP-Secret': site.webhook_secret,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paths: pathsToPurge }),
      }).catch(() => {});
    }

    // Also purge KV cache for WP API responses
    const kvPrefix = `wpapi:${site.id}:`;
    // KV list + delete is handled by the worker's internal purge

    // Log the webhook event
    await createDeployment(env.DB, {
      site_id: site.id,
      user_id: site.user_id,
      trigger_type: 'webhook',
      log: `Webhook received: event=${event}, post_id=${postId}, slug=${slug}`,
    }).then(dep => 
      updateDeployment(env.DB, dep.id, {
        status: 'success',
        log: `✅ 캐시 퍼지 완료: ${event} (${slug || postId})`,
        completed_at: new Date().toISOString(),
      })
    ).catch(() => {});

    return Response.json({
      success: true,
      message: '캐시가 갱신되었습니다.',
      purged: slug ? `/${slug}/` : '/',
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return Response.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
};

// Allow GET for health check / WordPress ping
export const GET: APIRoute = async ({ params, locals }) => {
  const env = (locals as { env: Env }).env;
  const site = await getSiteById(env.DB, params.siteId!).catch(() => null);
  return Response.json({
    success: true,
    active: !!site,
    site_id: params.siteId,
  });
};