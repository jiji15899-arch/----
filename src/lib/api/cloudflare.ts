// src/lib/api/cloudflare.ts
// Cloudflare API wrapper for managing Workers, DNS, and zones

const CF_API = 'https://api.cloudflare.com/client/v4';

export class CloudflareClient {
  private apiKey: string;
  private email: string;
  private accountId: string;

  constructor(apiKey: string, email: string, accountId: string) {
    this.apiKey = apiKey;
    this.email = email;
    this.accountId = accountId;
  }

  private get headers() {
    return {
      'X-Auth-Key': this.apiKey,
      'X-Auth-Email': this.email,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${CF_API}${path}`, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json() as { success: boolean; result: T; errors: Array<{ message: string }> };
    if (!data.success) {
      throw new Error(data.errors?.[0]?.message || 'Cloudflare API error');
    }
    return data.result;
  }

  // Verify credentials
  async verifyCredentials(): Promise<{ valid: boolean; accountId?: string; email?: string }> {
    try {
      const result = await this.request<{ id: string; email: string }>('GET', '/user');
      return { valid: true, accountId: result.id, email: result.email };
    } catch {
      return { valid: false };
    }
  }

  // Get account ID
  async getAccountId(): Promise<string> {
    const accounts = await this.request<Array<{ id: string }>>('GET', '/accounts');
    return (accounts as Array<{ id: string }>)[0]?.id || this.accountId;
  }

  // ============ WORKERS ============

  async createWorker(workerName: string, script: string, bindings?: unknown[]): Promise<{ id: string; name: string }> {
    const formData = new FormData();
    formData.append('metadata', JSON.stringify({
      main_module: 'worker.js',
      bindings: bindings || [],
      compatibility_date: '2024-09-25',
      compatibility_flags: ['nodejs_compat'],
    }));
    formData.append('worker.js', new Blob([script], { type: 'application/javascript+module' }), 'worker.js');

    const res = await fetch(`${CF_API}/accounts/${this.accountId}/workers/scripts/${workerName}`, {
      method: 'PUT',
      headers: { 'X-Auth-Key': this.apiKey, 'X-Auth-Email': this.email },
      body: formData,
    });
    const data = await res.json() as { success: boolean; result: { id: string; name: string }; errors: Array<{ message: string }> };
    if (!data.success) throw new Error(data.errors?.[0]?.message || 'Worker creation failed');
    return data.result;
  }

  async deleteWorker(workerName: string): Promise<void> {
    await this.request('DELETE', `/accounts/${this.accountId}/workers/scripts/${workerName}`);
  }

  async getWorkerSubdomain(): Promise<string> {
    const result = await this.request<{ subdomain: string }>('GET', `/accounts/${this.accountId}/workers/subdomain`);
    return result.subdomain;
  }

  // Worker route on zone
  async createWorkerRoute(zoneId: string, pattern: string, workerName: string): Promise<string> {
    const result = await this.request<{ id: string }>('POST', `/zones/${zoneId}/workers/routes`, {
      pattern,
      script: workerName,
    });
    return result.id;
  }

  // ============ ZONES (Domain) ============

  async createZone(domain: string): Promise<{ id: string; nameservers: string[] }> {
    const result = await this.request<{ id: string; name_servers: string[] }>('POST', '/zones', {
      name: domain,
      account: { id: this.accountId },
      jump_start: false,
    });
    return { id: result.id, nameservers: result.name_servers };
  }

  async getZone(domain: string): Promise<{ id: string; status: string; name_servers: string[] } | null> {
    try {
      const result = await this.request<Array<{ id: string; status: string; name_servers: string[] }>>('GET', `/zones?name=${encodeURIComponent(domain)}`);
      return (result as Array<{ id: string; status: string; name_servers: string[] }>)[0] || null;
    } catch {
      return null;
    }
  }

  async checkZoneStatus(zoneId: string): Promise<{ active: boolean; status: string }> {
    const result = await this.request<{ status: string }>('GET', `/zones/${zoneId}`);
    return { active: result.status === 'active', status: result.status };
  }

  // ============ DNS ============

  async createDnsRecord(zoneId: string, record: { type: string; name: string; content: string; proxied?: boolean; ttl?: number }): Promise<string> {
    const result = await this.request<{ id: string }>('POST', `/zones/${zoneId}/dns_records`, {
      type: record.type,
      name: record.name,
      content: record.content,
      proxied: record.proxied ?? true,
      ttl: record.ttl ?? 1,
    });
    return result.id;
  }

  async listDnsRecords(zoneId: string, type?: string): Promise<Array<{ id: string; type: string; name: string; content: string; proxied: boolean }>> {
    const path = type ? `/zones/${zoneId}/dns_records?type=${type}` : `/zones/${zoneId}/dns_records`;
    return this.request('GET', path) as Promise<Array<{ id: string; type: string; name: string; content: string; proxied: boolean }>>;
  }

  async deleteDnsRecord(zoneId: string, recordId: string): Promise<void> {
    await this.request('DELETE', `/zones/${zoneId}/dns_records/${recordId}`);
  }

  async updateDnsRecord(zoneId: string, recordId: string, record: { type: string; name: string; content: string; proxied?: boolean }): Promise<void> {
    await this.request('PUT', `/zones/${zoneId}/dns_records/${recordId}`, record);
  }

  // ============ SSL ============

  async getSslStatus(zoneId: string): Promise<'active' | 'pending' | 'error'> {
    try {
      const result = await this.request<{ status: string }>('GET', `/zones/${zoneId}/ssl/certificate_packs`);
      const packs = result as unknown as Array<{ status: string }>;
      if (!Array.isArray(packs) || packs.length === 0) return 'pending';
      return packs[0].status === 'active' ? 'active' : 'pending';
    } catch {
      return 'error';
    }
  }

  // ============ Worker Custom Domain ============

  async addCustomDomainToWorker(workerName: string, hostname: string, zoneId: string): Promise<void> {
    await this.request('PUT', `/accounts/${this.accountId}/workers/domains`, {
      environment: 'production',
      hostname,
      service: workerName,
      zone_id: zoneId,
    });
  }

  // ============ Cache Purge ============

  async purgeCache(zoneId: string, urls?: string[]): Promise<void> {
    if (urls?.length) {
      await this.request('POST', `/zones/${zoneId}/purge_cache`, { files: urls });
    } else {
      await this.request('POST', `/zones/${zoneId}/purge_cache`, { purge_everything: true });
    }
  }
}

// Build the headless worker script for a site
export function buildHeadlessWorkerScript(params: {
  siteId: string;
  wpUrl: string;
  ghRepoFullName: string;
  ghToken: string;
  webhookSecret: string;
  siteName: string;
  siteDescription?: string;
  cacheTtl?: number;
}): string {
  const { siteId, wpUrl, ghRepoFullName, ghToken, webhookSecret, siteName, siteDescription, cacheTtl = 60 } = params;

  return `
// CloudPress Headless Worker — generated for site: ${siteId}
// WordPress: ${wpUrl} | GitHub: ${ghRepoFullName}

const WP_URL = "${wpUrl.replace(/\/$/, '')}";
const GH_REPO = "${ghRepoFullName}";
const GH_TOKEN = "${ghToken}";
const WEBHOOK_SECRET = "${webhookSecret}";
const SITE_NAME = "${siteName}";
const SITE_DESC = "${siteDescription || ''}";
const CACHE_TTL = ${cacheTtl};
const SITE_ID = "${siteId}";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ── Internal CloudPress endpoints ──────────────────────────────
    if (url.pathname.startsWith('/__cp/')) {
      return handleInternal(request, url, env, ctx);
    }

    // ── API routes ─────────────────────────────────────────────────
    if (url.pathname.startsWith('/api/wp/')) {
      return handleWpProxy(request, url, env, ctx);
    }

    // ── Static assets from GitHub ──────────────────────────────────
    if (url.pathname.startsWith('/wp-content/') || url.pathname.match(/\\.(css|js|png|jpg|jpeg|gif|svg|webp|woff2?|ico|pdf)$/i)) {
      return handleStaticAsset(request, url, env, ctx);
    }

    // ── Page routing ───────────────────────────────────────────────
    return handlePage(request, url, env, ctx);
  }
};

// ── Internal endpoints (purge, webhook, health) ──────────────────────

async function handleInternal(request, url, env, ctx) {
  const path = url.pathname.replace('/__cp/', '');

  if (path === 'health') {
    return json({ ok: true, site: SITE_ID, ts: Date.now() });
  }

  // Verify secret
  const secret = request.headers.get('X-CP-Secret') || request.headers.get('X-WP-Nonce');
  if (secret !== WEBHOOK_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (path === 'purge' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const keys = body.paths?.map(p => 'page:' + p) || [];
    if (keys.length === 0) {
      // Purge all — list keys with prefix
      const listed = await env.CACHE?.list({ prefix: 'page:' }).catch(() => ({ keys: [] }));
      for (const k of listed?.keys || []) {
        ctx.waitUntil(env.CACHE?.delete(k.name).catch(() => {}));
      }
    } else {
      for (const k of keys) {
        ctx.waitUntil(env.CACHE?.delete(k).catch(() => {}));
      }
    }
    return json({ purged: true });
  }

  if (path === 'webhook' && request.method === 'POST') {
    // WordPress webhook: post published/updated/deleted
    const body = await request.json().catch(() => ({}));
    const postId = body.post_id;
    const slug = body.post_slug;
    if (slug) {
      ctx.waitUntil(env.CACHE?.delete('page:/' + slug + '/').catch(() => {}));
      ctx.waitUntil(env.CACHE?.delete('page:/').catch(() => {}));
    }
    if (postId) {
      ctx.waitUntil(env.CACHE?.delete('wp:post:' + postId).catch(() => {}));
    }
    return json({ received: true });
  }

  return json({ error: 'Not found' }, 404);
}

// ── WordPress REST API proxy (for dynamic data like comments) ─────────

async function handleWpProxy(request, url, env, ctx) {
  const wpPath = url.pathname.replace('/api/wp', '/wp-json/wp/v2');
  const wpFull = WP_URL + wpPath + url.search;

  // Allow only GET + comment POST
  if (request.method === 'POST' && url.pathname === '/api/wp/comments') {
    const body = await request.json();
    const res = await fetch(WP_URL + '/wp-json/wp/v2/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'CloudPress/1.0' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return json(data, res.status);
  }

  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  // Cache WP API responses in KV
  const cacheKey = 'wpapi:' + wpPath + url.search;
  const cached = await env.CACHE?.get(cacheKey).catch(() => null);
  if (cached) {
    return new Response(cached, { headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', 'Access-Control-Allow-Origin': '*' } });
  }

  const res = await fetch(wpFull, {
    headers: { 'User-Agent': 'CloudPress/1.0', 'Accept': 'application/json' },
  });
  const text = await res.text();

  ctx.waitUntil(env.CACHE?.put(cacheKey, text, { expirationTtl: CACHE_TTL }).catch(() => {}));

  return new Response(text, {
    status: res.status,
    headers: {
      'Content-Type': 'application/json',
      'X-Cache': 'MISS',
      'Cache-Control': 'public, max-age=' + CACHE_TTL,
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// ── Static asset proxy from GitHub raw ───────────────────────────────

async function handleStaticAsset(request, url, env, ctx) {
  const assetPath = url.pathname;
  const cacheKey = 'asset:' + assetPath;

  const cached = await env.CACHE?.get(cacheKey, 'arrayBuffer').catch(() => null);
  if (cached) {
    const mime = getMime(assetPath);
    return new Response(cached, { headers: { 'Content-Type': mime, 'Cache-Control': 'public, max-age=86400', 'X-Cache': 'HIT' } });
  }

  // Try GitHub first
  const ghUrl = \`https://raw.githubusercontent.com/\${GH_REPO}/main/public\${assetPath}\`;
  const ghRes = await fetch(ghUrl, {
    headers: { 'Authorization': \`token \${GH_TOKEN}\`, 'User-Agent': 'CloudPress/1.0' },
  });

  if (ghRes.ok) {
    const buf = await ghRes.arrayBuffer();
    ctx.waitUntil(env.CACHE?.put(cacheKey, buf, { expirationTtl: 86400 }).catch(() => {}));
    return new Response(buf, {
      headers: {
        'Content-Type': getMime(assetPath),
        'Cache-Control': 'public, max-age=86400',
        'X-Cache': 'MISS',
      },
    });
  }

  // Fallback: proxy directly from WordPress origin
  const wpAsset = WP_URL + assetPath;
  const wpRes = await fetch(wpAsset, { headers: { 'User-Agent': 'CloudPress/1.0' } });
  if (wpRes.ok) {
    const buf = await wpRes.arrayBuffer();
    ctx.waitUntil(env.CACHE?.put(cacheKey, buf, { expirationTtl: 3600 }).catch(() => {}));
    return new Response(buf, {
      headers: { 'Content-Type': getMime(assetPath), 'Cache-Control': 'public, max-age=3600' },
    });
  }

  return new Response('Not found', { status: 404 });
}

// ── Page rendering ────────────────────────────────────────────────────

async function handlePage(request, url, env, ctx) {
  const pathname = url.pathname;

  // ISR: check KV cache
  const cacheKey = 'page:' + pathname;
  const cached = await env.CACHE?.get(cacheKey).catch(() => null);
  if (cached) {
    return new Response(cached, {
      headers: { 'Content-Type': 'text/html;charset=UTF-8', 'X-Cache': 'HIT', 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
    });
  }

  // Fetch from GitHub (pre-built HTML or SSR)
  const ghHtmlUrl = \`https://raw.githubusercontent.com/\${GH_REPO}/main/dist\${pathname === '/' ? '/index.html' : pathname.replace(/\\/$/, '') + '/index.html'}\`;
  const ghRes = await fetch(ghHtmlUrl, {
    headers: { 'Authorization': \`token \${GH_TOKEN}\`, 'User-Agent': 'CloudPress/1.0' },
  });

  if (ghRes.ok) {
    const html = await ghRes.text();
    ctx.waitUntil(env.CACHE?.put(cacheKey, html, { expirationTtl: CACHE_TTL }).catch(() => {}));
    return new Response(html, {
      headers: { 'Content-Type': 'text/html;charset=UTF-8', 'X-Cache': 'MISS', 'Cache-Control': 'public, max-age=' + CACHE_TTL },
    });
  }

  // Dynamic render: fetch WP data and generate HTML
  const html = await renderDynamic(pathname, url.searchParams, env);
  ctx.waitUntil(env.CACHE?.put(cacheKey, html, { expirationTtl: CACHE_TTL }).catch(() => {}));

  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public, max-age=' + CACHE_TTL },
  });
}

// ── Dynamic HTML rendering from WP REST API ───────────────────────────

async function renderDynamic(pathname, searchParams, env) {
  // Homepage
  if (pathname === '/' || pathname === '') {
    const posts = await wpFetch('/wp/v2/posts?per_page=10&status=publish&_embed=1');
    const pages = await wpFetch('/wp/v2/pages?per_page=5&status=publish');
    return renderHomepage(posts || [], pages || []);
  }

  // Post: /YYYY/MM/DD/slug/ or just /slug/
  const slugMatch = pathname.match(/\\/([\\w-]+)\\/?$/);
  if (slugMatch) {
    const slug = slugMatch[1];

    // Try post
    const posts = await wpFetch(\`/wp/v2/posts?slug=\${slug}&status=publish&_embed=1\`);
    if (posts?.length) return renderPost(posts[0]);

    // Try page
    const pages = await wpFetch(\`/wp/v2/pages?slug=\${slug}&status=publish\`);
    if (pages?.length) return renderPage(pages[0]);
  }

  // Category: /category/slug/
  const catMatch = pathname.match(/\\/category\\/([\\w-]+)\\/?/);
  if (catMatch) {
    const cats = await wpFetch(\`/wp/v2/categories?slug=\${catMatch[1]}\`);
    if (cats?.length) {
      const posts = await wpFetch(\`/wp/v2/posts?categories=\${cats[0].id}&per_page=10&_embed=1\`);
      return renderArchive(cats[0].name, posts || []);
    }
  }

  // Tag: /tag/slug/
  const tagMatch = pathname.match(/\\/tag\\/([\\w-]+)\\/?/);
  if (tagMatch) {
    const tags = await wpFetch(\`/wp/v2/tags?slug=\${tagMatch[1]}\`);
    if (tags?.length) {
      const posts = await wpFetch(\`/wp/v2/posts?tags=\${tags[0].id}&per_page=10&_embed=1\`);
      return renderArchive(tags[0].name, posts || []);
    }
  }

  // Search: /?s=query
  const q = searchParams.get('s');
  if (q) {
    const results = await wpFetch(\`/wp/v2/search?search=\${encodeURIComponent(q)}&per_page=20\`);
    return renderSearch(q, results || []);
  }

  return render404();
}

async function wpFetch(path) {
  try {
    const res = await fetch(WP_URL + '/wp-json' + path, {
      headers: { 'User-Agent': 'CloudPress/1.0' },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ── HTML render helpers ───────────────────────────────────────────────

function baseHtml(title, bodyContent, head = '') {
  return \`<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>\${esc(title)} | \${esc(SITE_NAME)}</title>
<meta name="description" content="\${esc(SITE_DESC)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap">
\${head}
<style>
*,::before,::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans KR',sans-serif;color:#1e293b;background:#fff;line-height:1.7}
a{color:#0070f3;text-decoration:none}a:hover{text-decoration:underline}
img{max-width:100%;height:auto}
.container{max-width:1100px;margin:0 auto;padding:0 1.5rem}
header{background:#fff;border-bottom:1px solid #e2e8f0;padding:1rem 0;position:sticky;top:0;z-index:100}
header .inner{display:flex;align-items:center;justify-content:space-between}
.site-title{font-size:1.4rem;font-weight:700;color:#0f172a}
nav a{margin-left:1.5rem;color:#475569;font-size:.95rem}
main{padding:3rem 0}
.posts-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:2rem}
.post-card{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;transition:box-shadow .2s}
.post-card:hover{box-shadow:0 8px 24px rgba(0,0,0,.08)}
.post-card img{width:100%;height:200px;object-fit:cover}
.post-card-body{padding:1.25rem}
.post-title{font-size:1.1rem;font-weight:600;color:#0f172a;margin-bottom:.5rem}
.post-excerpt{font-size:.9rem;color:#64748b;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.post-meta{font-size:.8rem;color:#94a3b8;margin-top:.75rem}
.post-content{max-width:720px;margin:0 auto;font-size:1.05rem}
.post-content h1,.post-content h2,.post-content h3{color:#0f172a;margin:2rem 0 1rem;font-weight:700}
.post-content p{margin-bottom:1.25rem}
.post-content img{border-radius:8px;margin:1.5rem 0}
.post-content pre{background:#f1f5f9;border-radius:8px;padding:1rem;overflow-x:auto;font-size:.875rem}
.post-content code{background:#f1f5f9;padding:.2em .4em;border-radius:4px;font-size:.875em}
.tag{display:inline-block;background:#eff6ff;color:#2563eb;padding:.2rem .6rem;border-radius:9999px;font-size:.75rem;margin:.25rem .15rem}
footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:2rem 0;text-align:center;color:#64748b;font-size:.875rem}
.search-box{display:flex;gap:.5rem;margin-bottom:2rem}
.search-box input{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:.6rem 1rem;font-size:1rem}
.search-box button{background:#0070f3;color:#fff;border:none;border-radius:8px;padding:.6rem 1.25rem;cursor:pointer;font-size:1rem}
.not-found{text-align:center;padding:5rem 1rem}
.not-found h1{font-size:3rem;color:#cbd5e1}
</style>
</head>
<body>
<header><div class="container"><div class="inner">
<a href="/" class="site-title">\${esc(SITE_NAME)}</a>
<nav>
  <form action="/" method="get" style="display:inline">
    <input name="s" placeholder="검색..." style="border:1px solid #e2e8f0;border-radius:6px;padding:.3rem .7rem;font-size:.9rem">
  </form>
</nav>
</div></div></header>
<main><div class="container">\${bodyContent}</div></main>
<footer><div class="container"><p>© \${new Date().getFullYear()} \${esc(SITE_NAME)} — Powered by CloudPress</p></div></footer>
</body></html>\`;
}

function renderHomepage(posts, pages) {
  const postsHtml = posts.map(p => {
    const thumb = p._embedded?.['wp:featuredmedia']?.[0]?.source_url || '';
    const excerpt = p.excerpt?.rendered?.replace(/<[^>]+>/g, '').slice(0, 120) || '';
    const date = new Date(p.date).toLocaleDateString('ko-KR');
    return \`<article class="post-card"><a href="/\${p.slug}/">
      \${thumb ? \`<img src="\${esc(thumb)}" alt="\${esc(p.title.rendered)}" loading="lazy">\` : ''}
      <div class="post-card-body">
        <h2 class="post-title">\${p.title.rendered}</h2>
        <p class="post-excerpt">\${esc(excerpt)}</p>
        <p class="post-meta">\${date}</p>
      </div>
    </a></article>\`;
  }).join('');
  return baseHtml(SITE_NAME, \`<div class="posts-grid">\${postsHtml || '<p>아직 게시물이 없습니다.</p>'}</div>\`);
}

function renderPost(post) {
  const thumb = post._embedded?.['wp:featuredmedia']?.[0]?.source_url || '';
  const author = post._embedded?.author?.[0]?.name || '';
  const cats = (post._embedded?.['wp:term']?.[0] || []).map(t => \`<a href="/category/\${t.slug}/" class="tag">\${esc(t.name)}</a>\`).join('');
  const date = new Date(post.date).toLocaleDateString('ko-KR');
  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title.rendered,
    datePublished: post.date,
    dateModified: post.modified,
    author: { '@type': 'Person', name: author },
  });
  return baseHtml(post.title.rendered,
    \`<div class="post-content">
      <h1 style="font-size:2rem;margin-bottom:1rem">\${post.title.rendered}</h1>
      <p style="color:#64748b;margin-bottom:1.5rem">\${date} • \${esc(author)} \${cats}</p>
      \${thumb ? \`<img src="\${esc(thumb)}" alt="\${esc(post.title.rendered)}" style="width:100%;border-radius:12px;margin-bottom:2rem">\` : ''}
      \${post.content.rendered}
      <div id="cp-comments" style="margin-top:3rem"></div>
    </div>\`,
    \`<script type="application/ld+json">\${schema}</script>\`
  );
}

function renderPage(page) {
  return baseHtml(page.title.rendered,
    \`<div class="post-content"><h1 style="font-size:2rem;margin-bottom:2rem">\${page.title.rendered}</h1>\${page.content.rendered}</div>\`
  );
}

function renderArchive(title, posts) {
  const postsHtml = posts.map(p => {
    const date = new Date(p.date).toLocaleDateString('ko-KR');
    const excerpt = p.excerpt?.rendered?.replace(/<[^>]+>/g, '').slice(0, 100) || '';
    return \`<article class="post-card"><a href="/\${p.slug}/"><div class="post-card-body">
      <h2 class="post-title">\${p.title.rendered}</h2>
      <p class="post-excerpt">\${esc(excerpt)}</p>
      <p class="post-meta">\${date}</p>
    </div></a></article>\`;
  }).join('');
  return baseHtml(title, \`<h1 style="margin-bottom:2rem">\${esc(title)}</h1><div class="posts-grid">\${postsHtml || '<p>게시물이 없습니다.</p>'}</div>\`);
}

function renderSearch(q, results) {
  const items = results.map(r => \`<li><a href="\${esc(r.url)}">\${esc(r.title)}</a></li>\`).join('');
  return baseHtml(\`"\${q}" 검색 결과\`,
    \`<h1 style="margin-bottom:1.5rem">"<em>\${esc(q)}</em>" 검색 결과 (\${results.length}개)</h1>
    \${results.length ? \`<ul style="list-style:none">\${items}</ul>\` : '<p>검색 결과가 없습니다.</p>'}\`
  );
}

function render404() {
  return baseHtml('페이지를 찾을 수 없습니다',
    \`<div class="not-found"><h1>404</h1><p>요청하신 페이지를 찾을 수 없습니다.</p><a href="/">홈으로 돌아가기</a></div>\`
  );
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getMime(path) {
  const ext = path.split('.').pop()?.toLowerCase();
  const map = { js:'application/javascript', css:'text/css', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg',
    gif:'image/gif', svg:'image/svg+xml', webp:'image/webp', woff:'font/woff', woff2:'font/woff2',
    ico:'image/x-icon', pdf:'application/pdf', json:'application/json' };
  return map[ext || ''] || 'application/octet-stream';
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
`;
}