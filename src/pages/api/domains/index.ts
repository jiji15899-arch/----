// src/pages/api/domains/index.ts
import type { APIRoute } from 'astro';
import { getDomainsByUser, createDomain, getDomainById, updateDomain, deleteDomain, getSiteById, updateSite } from '../../../lib/db/index.ts';
import { decrypt } from '../../../lib/utils/crypto.ts';
import { CloudflareClient } from '../../../lib/api/cloudflare.ts';
import type { Env, User } from '../../../types/index.ts';

export const GET: APIRoute = async ({ locals }) => {
  const env = (locals as { env: Env }).env;
  const user = (locals as { user: User }).user;
  const domains = await getDomainsByUser(env.DB, user.id);
  return Response.json({ success: true, data: domains });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as { env: Env }).env;
  const user = (locals as { user: User }).user;

  try {
    const body = await request.json() as { domain?: string; action?: string; domain_id?: string; site_id?: string };
    const action = body.action || 'add';

    // ── Add new domain ──────────────────────────────────────────────
    if (action === 'add') {
      const { domain } = body;
      if (!domain) return Response.json({ success: false, error: '도메인을 입력해주세요.' }, { status: 400 });

      // Basic domain validation
      const domainRe = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
      if (!domainRe.test(domain)) {
        return Response.json({ success: false, error: '올바른 도메인 형식이 아닙니다.' }, { status: 400 });
      }

      if (!user.cf_api_key_enc || !user.cf_email) {
        return Response.json({ success: false, error: 'Cloudflare API 키를 먼저 설정해주세요.' }, { status: 422 });
      }

      const cfApiKey = await decrypt(user.cf_api_key_enc, env.ENCRYPTION_KEY);
      const cf = new CloudflareClient(cfApiKey, user.cf_email, '');
      const acct = await cf.verifyCredentials();
      if (!acct.valid || !acct.accountId) {
        return Response.json({ success: false, error: 'Cloudflare 인증에 실패했습니다.' }, { status: 422 });
      }

      const cfFull = new CloudflareClient(cfApiKey, user.cf_email, acct.accountId);

      // Check if zone already exists
      let zone = await cfFull.getZone(domain);
      let zoneId: string;
      let nameservers: string[];

      if (zone) {
        zoneId = zone.id;
        nameservers = zone.name_servers;
      } else {
        const created = await cfFull.createZone(domain);
        zoneId = created.id;
        nameservers = created.nameservers;
      }

      const existing = await env.DB.prepare('SELECT id FROM domains WHERE domain = ?').bind(domain).first();
      if (existing) {
        return Response.json({ success: false, error: '이미 등록된 도메인입니다.' }, { status: 409 });
      }

      const newDomain = await createDomain(env.DB, {
        user_id: user.id,
        domain,
        cf_zone_id: zoneId,
        nameserver_1: nameservers[0],
        nameserver_2: nameservers[1],
        ns_status: 'pending',
        ssl_status: 'pending',
      });

      return Response.json({
        success: true,
        data: newDomain,
        message: `도메인이 추가되었습니다. 네임서버를 ${nameservers.join(', ')} 으로 변경해주세요.`,
      }, { status: 201 });
    }

    // ── Check domain NS status ──────────────────────────────────────
    if (action === 'check_ns') {
      const { domain_id } = body;
      if (!domain_id) return Response.json({ success: false, error: 'domain_id가 필요합니다.' }, { status: 400 });

      const domain = await getDomainById(env.DB, domain_id);
      if (!domain || domain.user_id !== user.id) {
        return Response.json({ success: false, error: '도메인을 찾을 수 없습니다.' }, { status: 404 });
      }
      if (!domain.cf_zone_id) return Response.json({ success: false, error: 'Zone ID가 없습니다.' }, { status: 400 });

      const cfApiKey = await decrypt(user.cf_api_key_enc!, env.ENCRYPTION_KEY);
      const cf = new CloudflareClient(cfApiKey, user.cf_email!, '');
      const acct = await cf.verifyCredentials();
      const cfFull = new CloudflareClient(cfApiKey, user.cf_email!, acct.accountId || '');

      const status = await cfFull.checkZoneStatus(domain.cf_zone_id);
      const sslStatus = status.active ? await cfFull.getSslStatus(domain.cf_zone_id) : 'pending';

      await updateDomain(env.DB, domain_id, {
        ns_status: status.active ? 'active' : 'pending',
        ssl_status: sslStatus,
        ...(status.active ? { verified_at: new Date().toISOString() } : {}),
      });

      return Response.json({
        success: true,
        data: { active: status.active, ns_status: status.active ? 'active' : 'pending', ssl_status: sslStatus },
        message: status.active ? `🎉 ${domain.domain} 도메인이 활성화되었습니다!` : '아직 네임서버가 전파되지 않았습니다. 최대 48시간 소요됩니다.',
      });
    }

    // ── Connect domain to site ──────────────────────────────────────
    if (action === 'connect') {
      const { domain_id, site_id } = body;
      if (!domain_id || !site_id) {
        return Response.json({ success: false, error: 'domain_id와 site_id가 필요합니다.' }, { status: 400 });
      }

      const domain = await getDomainById(env.DB, domain_id);
      if (!domain || domain.user_id !== user.id) {
        return Response.json({ success: false, error: '도메인을 찾을 수 없습니다.' }, { status: 404 });
      }

      const site = await getSiteById(env.DB, site_id);
      if (!site || site.user_id !== user.id) {
        return Response.json({ success: false, error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
      }

      if (!domain.cf_zone_id) {
        return Response.json({ success: false, error: '도메인 Zone ID가 없습니다.' }, { status: 400 });
      }

      const cfApiKey = await decrypt(user.cf_api_key_enc!, env.ENCRYPTION_KEY);
      const cf = new CloudflareClient(cfApiKey, user.cf_email!, '');
      const acct = await cf.verifyCredentials();
      const cfFull = new CloudflareClient(cfApiKey, user.cf_email!, acct.accountId || '');

      // Create DNS record pointing to worker
      if (site.cf_worker_name) {
        // Add custom domain to worker
        await cfFull.addCustomDomainToWorker(site.cf_worker_name, domain.domain, domain.cf_zone_id)
          .catch(() => {
            // Fallback: CNAME record
            return cfFull.createDnsRecord(domain.cf_zone_id!, {
              type: 'CNAME',
              name: domain.domain,
              content: `${site.cf_worker_name}.workers.dev`,
              proxied: true,
            });
          });
      }

      await updateDomain(env.DB, domain_id, { connected_site_id: site_id });
      await updateSite(env.DB, site_id, {
        custom_domain: domain.domain,
        custom_domain_status: 'active',
      });

      return Response.json({
        success: true,
        message: `✅ ${domain.domain}이(가) ${site.name}에 연결되었습니다.`,
      });
    }

    return Response.json({ success: false, error: '알 수 없는 action입니다.' }, { status: 400 });
  } catch (err) {
    console.error('Domain API error:', err);
    return Response.json({ success: false, error: '도메인 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const env = (locals as { env: Env }).env;
  const user = (locals as { user: User }).user;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return Response.json({ success: false, error: 'id가 필요합니다.' }, { status: 400 });

  const domain = await getDomainById(env.DB, id);
  if (!domain || domain.user_id !== user.id) {
    return Response.json({ success: false, error: '도메인을 찾을 수 없습니다.' }, { status: 404 });
  }

  await deleteDomain(env.DB, id);
  return Response.json({ success: true, message: '도메인이 삭제되었습니다.' });
};