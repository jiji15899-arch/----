// src/lib/api/wordpress.ts
// Fetches data from WordPress REST API with caching support

import type { WPPost, WPPage, WPCategory, WPTerm, WPComment, WPMenuItem, WPMedia, WPUser } from '../../types/index.ts';

export interface WPClientConfig {
  baseUrl: string;            // https://user.byethost.com
  username?: string;
  appPassword?: string;       // WP Application Password for write ops
  cacheTtl?: number;
}

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, '');
}

function buildAuthHeader(username: string, appPassword: string): string {
  return 'Basic ' + btoa(`${username}:${appPassword}`);
}

export class WordPressClient {
  private base: string;
  private authHeader?: string;
  private cacheTtl: number;

  constructor(config: WPClientConfig) {
    this.base = normalizeUrl(config.baseUrl) + '/wp-json/wp/v2';
    this.cacheTtl = config.cacheTtl ?? 60;
    if (config.username && config.appPassword) {
      this.authHeader = buildAuthHeader(config.username, config.appPassword);
    }
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'CloudPress/1.0',
    };
    if (this.authHeader) headers['Authorization'] = this.authHeader;

    const res = await fetch(`${this.base}${path}`, {
      ...options,
      headers: { ...headers, ...(options?.headers as Record<string, string> || {}) },
      // Use Cloudflare cache
      cf: { cacheTtl: this.cacheTtl, cacheEverything: true },
    } as RequestInit & { cf: unknown });

    if (!res.ok) {
      throw new Error(`WordPress API error: ${res.status} ${res.statusText} for ${path}`);
    }
    return res.json() as Promise<T>;
  }

  // Site info
  async getSiteInfo(): Promise<{ name: string; description: string; url: string; gmt_offset: number; timezone_string: string; language: string }> {
    const base = this.base.replace('/wp/v2', '');
    const res = await fetch(`${base}/`, {
      headers: { 'User-Agent': 'CloudPress/1.0' },
      cf: { cacheTtl: 300 },
    } as RequestInit & { cf: unknown });
    return res.json();
  }

  // Posts
  async getPosts(params: { page?: number; per_page?: number; slug?: string; categories?: number[]; tags?: number[]; search?: string; status?: string; _embed?: boolean } = {}): Promise<{ posts: WPPost[]; total: number; totalPages: number }> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    query.set('per_page', String(params.per_page ?? 10));
    if (params.slug) query.set('slug', params.slug);
    if (params.categories?.length) query.set('categories', params.categories.join(','));
    if (params.tags?.length) query.set('tags', params.tags.join(','));
    if (params.search) query.set('search', params.search);
    query.set('status', params.status ?? 'publish');
    if (params._embed !== false) query.set('_embed', '1');

    const res = await fetch(`${this.base}/posts?${query}`, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CloudPress/1.0',
        ...(this.authHeader ? { Authorization: this.authHeader } : {}),
      },
      cf: { cacheTtl: this.cacheTtl },
    } as RequestInit & { cf: unknown });

    if (!res.ok) throw new Error(`WordPress posts fetch failed: ${res.status}`);

    const posts = await res.json() as WPPost[];
    const total = parseInt(res.headers.get('X-WP-Total') || '0');
    const totalPages = parseInt(res.headers.get('X-WP-TotalPages') || '1');
    return { posts, total, totalPages };
  }

  async getPost(slugOrId: string | number): Promise<WPPost | null> {
    try {
      if (typeof slugOrId === 'number') {
        return await this.fetch<WPPost>(`/posts/${slugOrId}?_embed=1`);
      }
      const { posts } = await this.getPosts({ slug: slugOrId, _embed: true });
      return posts[0] ?? null;
    } catch {
      return null;
    }
  }

  // Pages
  async getPages(params: { slug?: string; parent?: number; per_page?: number } = {}): Promise<WPPage[]> {
    const query = new URLSearchParams({ status: 'publish', per_page: String(params.per_page ?? 100) });
    if (params.slug) query.set('slug', params.slug);
    if (params.parent !== undefined) query.set('parent', String(params.parent));
    return this.fetch<WPPage[]>(`/pages?${query}`);
  }

  async getPage(slugOrId: string | number): Promise<WPPage | null> {
    try {
      if (typeof slugOrId === 'number') {
        return await this.fetch<WPPage>(`/pages/${slugOrId}`);
      }
      const pages = await this.getPages({ slug: slugOrId });
      return pages[0] ?? null;
    } catch {
      return null;
    }
  }

  // Categories
  async getCategories(params: { per_page?: number; hide_empty?: boolean } = {}): Promise<WPCategory[]> {
    const query = new URLSearchParams({
      per_page: String(params.per_page ?? 100),
      hide_empty: params.hide_empty !== false ? '1' : '0',
    });
    return this.fetch<WPCategory[]>(`/categories?${query}`);
  }

  // Tags
  async getTags(params: { per_page?: number } = {}): Promise<WPTerm[]> {
    const query = new URLSearchParams({ per_page: String(params.per_page ?? 100), hide_empty: '1' });
    return this.fetch<WPTerm[]>(`/tags?${query}`);
  }

  // Media
  async getMedia(id: number): Promise<WPMedia | null> {
    try {
      return await this.fetch<WPMedia>(`/media/${id}`);
    } catch {
      return null;
    }
  }

  // Comments
  async getComments(postId: number, params: { page?: number; per_page?: number } = {}): Promise<WPComment[]> {
    const query = new URLSearchParams({
      post: String(postId),
      status: 'approve',
      per_page: String(params.per_page ?? 50),
      page: String(params.page ?? 1),
    });
    return this.fetch<WPComment[]>(`/comments?${query}`);
  }

  async submitComment(data: { post: number; author_name: string; author_email: string; content: string; parent?: number }): Promise<WPComment> {
    return this.fetch<WPComment>('/comments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Users (authors)
  async getUsers(): Promise<WPUser[]> {
    return this.fetch<WPUser[]>('/users?per_page=100');
  }

  // Menus (requires WP REST API Menus plugin or similar)
  async getMenus(): Promise<Record<string, WPMenuItem[]>> {
    try {
      const base = this.base.replace('/wp/v2', '');
      const res = await fetch(`${base}/wp/v2/menus`, {
        headers: { 'User-Agent': 'CloudPress/1.0' },
        cf: { cacheTtl: 300 },
      } as RequestInit & { cf: unknown });
      if (!res.ok) return {};
      return res.json();
    } catch {
      return {};
    }
  }

  // Search
  async search(query: string, type?: 'post' | 'page'): Promise<Array<{ id: number; title: string; url: string; type: string; subtype: string }>> {
    const params = new URLSearchParams({ search: query, per_page: '20' });
    if (type) params.set('type', type);
    try {
      return await this.fetch<Array<{ id: number; title: string; url: string; type: string; subtype: string }>>(`/search?${params}`);
    } catch {
      return [];
    }
  }

  // Verify credentials (for setup wizard)
  async verifyCredentials(): Promise<{ valid: boolean; siteTitle?: string; error?: string }> {
    try {
      const base = this.base.replace('/wp/v2', '');
      const res = await fetch(`${base}/wp-json/`, {
        headers: {
          'User-Agent': 'CloudPress/1.0',
          ...(this.authHeader ? { Authorization: this.authHeader } : {}),
        },
      });
      if (!res.ok) return { valid: false, error: `HTTP ${res.status}` };
      const data = await res.json() as { name?: string };
      return { valid: true, siteTitle: data.name };
    } catch (e) {
      return { valid: false, error: String(e) };
    }
  }

  // Trigger ISR by calling cloudpress webhook
  static async pingCloudflarePurge(cfWorkerUrl: string, secret: string, paths: string[]): Promise<void> {
    await fetch(`${cfWorkerUrl}/__cp/purge`, {
      method: 'POST',
      headers: { 'X-CP-Secret': secret, 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    });
  }
}