// src/pages/api/admin/index.ts
import type { APIRoute } from 'astro';
import {
  listUsers, updateUser, deleteUser,
  getAllProducts, updateProductActive,
  getAllAdminSettings, setAdminSetting,
  listAllSites, listAllDomains,
  createAuditLog, getAuditLogs,
} from '../../../lib/db/index.ts';
import type { Env, User } from '../../../types/index.ts';

function requireAdmin(locals: Record<string, unknown>): User | null {
  const user = locals.user as User;
  return user?.role === 'admin' ? user : null;
}

// GET /api/admin?resource=...
export const GET: APIRoute = async ({ request, locals }) => {
  const env = (locals as { env: Env }).env;
  const admin = requireAdmin(locals as Record<string, unknown>);
  if (!admin) return Response.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });

  const url = new URL(request.url);
  const resource = url.searchParams.get('resource') || 'stats';

  try {
    if (resource === 'users') {
      const search = url.searchParams.get('search') || undefined;
      const page = parseInt(url.searchParams.get('page') || '1');
      const { users, total } = await listUsers(env.DB, { limit: 50, offset: (page - 1) * 50, search });
      // Remove sensitive fields
      const safe = users.map(u => ({
        id: u.id, email: u.email, name: u.name, role: u.role,
        plan_id: u.plan_id, is_suspended: u.is_suspended,
        has_cf: !!u.cf_api_key_enc, has_gh: !!u.gh_token_enc,
        created_at: u.created_at,
      }));
      return Response.json({ success: true, data: safe, total, page });
    }

    if (resource === 'products') {
      const products = await getAllProducts(env.DB);
      return Response.json({ success: true, data: products });
    }

    if (resource === 'settings') {
      const settings = await getAllAdminSettings(env.DB);
      // Mask sensitive values
      const safe = { ...settings };
      for (const k of ['PAYPAL_SECRET']) {
        if (safe[k]) safe[k] = safe[k].slice(0, 6) + '••••••';
      }
      return Response.json({ success: true, data: safe });
    }

    if (resource === 'sites') {
      const page = parseInt(url.searchParams.get('page') || '1');
      const { sites, total } = await listAllSites(env.DB, { limit: 50, offset: (page - 1) * 50 });
      return Response.json({ success: true, data: sites, total, page });
    }

    if (resource === 'domains') {
      const domains = await listAllDomains(env.DB);
      return Response.json({ success: true, data: domains });
    }

    if (resource === 'audit_logs') {
      const page = parseInt(url.searchParams.get('page') || '1');
      const logs = await getAuditLogs(env.DB, 100, (page - 1) * 100);
      return Response.json({ success: true, data: logs, page });
    }

    if (resource === 'stats') {
      const [userCount, siteCount, domainCount] = await Promise.all([
        env.DB.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>(),
        env.DB.prepare('SELECT COUNT(*) as c FROM sites').first<{ c: number }>(),
        env.DB.prepare('SELECT COUNT(*) as c FROM domains').first<{ c: number }>(),
      ]);
      const todayDeploys = await env.DB.prepare(
        "SELECT COUNT(*) as c FROM deployments WHERE date(triggered_at) = date('now')"
      ).first<{ c: number }>();
      return Response.json({
        success: true,
        data: {
          total_users: userCount?.c ?? 0,
          total_sites: siteCount?.c ?? 0,
          total_domains: domainCount?.c ?? 0,
          today_deploys: todayDeploys?.c ?? 0,
        },
      });
    }

    return Response.json({ success: false, error: '알 수 없는 resource입니다.' }, { status: 400 });
  } catch (err) {
    console.error('Admin GET error:', err);
    return Response.json({ success: false, error: '관리자 데이터를 불러오는 중 오류가 발생했습니다.' }, { status: 500 });
  }
};

// POST /api/admin
export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as { env: Env }).env;
  const admin = requireAdmin(locals as Record<string, unknown>);
  if (!admin) return Response.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });

  try {
    const body = await request.json() as {
      action: string;
      user_id?: string;
      role?: string;
      is_suspended?: boolean;
      product_id?: string;
      is_active?: boolean;
      settings?: Record<string, string>;
    };

    const { action } = body;

    // ── User management ──────────────────────────────────────────
    if (action === 'update_user') {
      if (!body.user_id) return Response.json({ success: false, error: 'user_id가 필요합니다.' }, { status: 400 });
      const updates: Record<string, unknown> = {};
      if (body.role !== undefined) updates.role = body.role;
      if (body.is_suspended !== undefined) updates.is_suspended = body.is_suspended ? 1 : 0;
      await updateUser(env.DB, body.user_id, updates);
      await createAuditLog(env.DB, {
        admin_id: admin.id,
        action: `사용자 정보 수정: ${JSON.stringify(updates)}`,
        target_type: 'user',
        target_id: body.user_id,
      });
      return Response.json({ success: true, message: '사용자 정보가 업데이트되었습니다.' });
    }

    if (action === 'delete_user') {
      if (!body.user_id) return Response.json({ success: false, error: 'user_id가 필요합니다.' }, { status: 400 });
      await deleteUser(env.DB, body.user_id);
      await createAuditLog(env.DB, {
        admin_id: admin.id,
        action: '사용자 삭제',
        target_type: 'user',
        target_id: body.user_id,
      });
      return Response.json({ success: true, message: '사용자가 삭제되었습니다.' });
    }

    // ── Product management ───────────────────────────────────────
    if (action === 'toggle_product') {
      if (!body.product_id || body.is_active === undefined) {
        return Response.json({ success: false, error: 'product_id와 is_active가 필요합니다.' }, { status: 400 });
      }
      await updateProductActive(env.DB, body.product_id, body.is_active);
      const actionText = body.is_active
        ? `상품 활성화: ${body.product_id}`
        : `상품 비활성화: ${body.product_id}`;
      await createAuditLog(env.DB, {
        admin_id: admin.id,
        action: actionText,
        target_type: 'product',
        target_id: body.product_id,
      });
      return Response.json({
        success: true,
        message: body.is_active ? '상품이 활성화되었습니다.' : '상품이 비활성화되었습니다.',
      });
    }

    // ── Settings management ──────────────────────────────────────
    if (action === 'update_settings') {
      if (!body.settings || typeof body.settings !== 'object') {
        return Response.json({ success: false, error: 'settings 객체가 필요합니다.' }, { status: 400 });
      }
      const allowedKeys = [
        'PAYPAL_MODE', 'PAYPAL_CLIENT_ID', 'PAYPAL_SECRET',
        'MAINTENANCE_MODE', 'ANNOUNCEMENT_BANNER', 'ANNOUNCEMENT_ACTIVE',
        'CF_WORKER_TEMPLATE_VERSION',
      ];
      for (const [key, value] of Object.entries(body.settings)) {
        if (allowedKeys.includes(key)) {
          await setAdminSetting(env.DB, key, value);
        }
      }
      await createAuditLog(env.DB, {
        admin_id: admin.id,
        action: '관리자 설정 업데이트',
        detail: Object.keys(body.settings).join(', '),
      });
      return Response.json({ success: true, message: '설정이 저장되었습니다.' });
    }

    return Response.json({ success: false, error: '알 수 없는 action입니다.' }, { status: 400 });
  } catch (err) {
    console.error('Admin POST error:', err);
    return Response.json({ success: false, error: '관리자 작업 중 오류가 발생했습니다.' }, { status: 500 });
  }
};