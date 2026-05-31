// src/types/index.ts

export interface Env {
    DB: D1Database;
    KV: KVNamespace;
    SITE_MANAGER: DurableObjectNamespace;
    WEBHOOK_HANDLER: DurableObjectNamespace;
    CACHE_MANAGER: DurableObjectNamespace;
    JWT_SECRET: string;
    ENCRYPTION_KEY: string;
    ENVIRONMENT: string;
  }
  
  export interface User {
    id: string;
    email: string;
    name: string;
    avatar_url?: string;
    role: 'user' | 'admin';
    cf_api_key_enc?: string;
    cf_email?: string;
    gh_token_enc?: string;
    plan_id: string;
    email_verified: number;
    is_suspended: number;
    created_at: string;
    updated_at: string;
  }
  
  export interface Session {
    id: string;
    user_id: string;
    expires_at: string;
    created_at: string;
  }
  
  export interface Site {
    id: string;
    user_id: string;
    name: string;
    subdomain: string;
    product_type: string;
    wp_url?: string;
    wp_username?: string;
    wp_app_password_enc?: string;
    wp_site_title?: string;
    gh_repo_name?: string;
    gh_repo_url?: string;
    gh_repo_full_name?: string;
    cf_worker_name?: string;
    cf_worker_url?: string;
    cf_zone_id?: string;
    custom_domain?: string;
    custom_domain_status: 'none' | 'pending' | 'active' | 'error';
    status: 'pending' | 'active' | 'building' | 'error' | 'suspended';
    wp_detection_status: 'waiting' | 'detected' | 'failed';
    isr_enabled: number;
    cache_ttl: number;
    webhook_secret?: string;
    created_at: string;
    last_deployed_at?: string;
  }
  
  export interface Domain {
    id: string;
    user_id: string;
    domain: string;
    cf_zone_id?: string;
    nameserver_1?: string;
    nameserver_2?: string;
    ns_status: 'pending' | 'active' | 'error';
    ssl_status: 'pending' | 'active' | 'error';
    connected_site_id?: string;
    created_at: string;
    verified_at?: string;
  }
  
  export interface Deployment {
    id: string;
    site_id: string;
    user_id: string;
    status: 'pending' | 'running' | 'success' | 'error';
    trigger_type: 'manual' | 'webhook' | 'scheduled' | 'isr';
    log?: string;
    triggered_at: string;
    completed_at?: string;
  }
  
  export interface Plan {
    id: string;
    name: string;
    price_usd: number;
    max_sites: number;
    max_domains: number;
    storage_gb: number;
    features: Record<string, unknown>;
    is_active: number;
  }
  
  export interface Product {
    id: string;
    name: string;
    slug: string;
    description: string;
    category: string;
    icon: string;
    tags: string[];
    is_active: number;
    hosting_type: string;
    sort_order: number;
  }
  
  export interface AdminSetting {
    key: string;
    value: string;
  }
  
  export interface AuditLog {
    id: string;
    admin_id: string;
    action: string;
    target_type?: string;
    target_id?: string;
    detail?: string;
    created_at: string;
  }
  
  // WordPress REST API types
  export interface WPPost {
    id: number;
    slug: string;
    status: string;
    title: { rendered: string };
    content: { rendered: string; protected: boolean };
    excerpt: { rendered: string };
    author: number;
    featured_media: number;
    categories: number[];
    tags: number[];
    date: string;
    modified: string;
    link: string;
    _embedded?: {
      author?: WPUser[];
      'wp:featuredmedia'?: WPMedia[];
      'wp:term'?: WPTerm[][];
    };
  }
  
  export interface WPPage {
    id: number;
    slug: string;
    status: string;
    title: { rendered: string };
    content: { rendered: string };
    date: string;
    modified: string;
    parent: number;
    menu_order: number;
    link: string;
  }
  
  export interface WPUser {
    id: number;
    name: string;
    slug: string;
    avatar_urls: Record<string, string>;
    description: string;
  }
  
  export interface WPMedia {
    id: number;
    source_url: string;
    alt_text: string;
    media_details: {
      width: number;
      height: number;
      sizes?: Record<string, { source_url: string; width: number; height: number }>;
    };
  }
  
  export interface WPTerm {
    id: number;
    name: string;
    slug: string;
    taxonomy: string;
    count: number;
    link: string;
  }
  
  export interface WPCategory extends WPTerm {
    parent: number;
    description: string;
  }
  
  export interface WPComment {
    id: number;
    post: number;
    parent: number;
    author_name: string;
    author_email?: string;
    author_url?: string;
    date: string;
    content: { rendered: string };
    status: string;
  }
  
  export interface WPMenuItem {
    id: number;
    title: string;
    url: string;
    order: number;
    parent: number;
    children?: WPMenuItem[];
  }
  
  // API Response types
  export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
  }
  
  export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    total: number;
    page: number;
    per_page: number;
  }
  
  // Site creation wizard
  export interface SiteCreationPayload {
    name: string;
    subdomain: string;
    wp_url: string;
    wp_username: string;
    wp_app_password: string;
    wp_site_title?: string;
  }
  
  // Cached WP content structure
  export interface CachedSiteContent {
    posts: WPPost[];
    pages: WPPage[];
    categories: WPCategory[];
    tags: WPTerm[];
    menus: Record<string, WPMenuItem[]>;
    siteInfo: {
      name: string;
      description: string;
      url: string;
      language: string;
    };
    lastSynced: string;
  }