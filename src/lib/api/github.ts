// src/lib/api/github.ts
// GitHub REST API wrapper for repo management and file storage

const GH_API = 'https://api.github.com';

export class GitHubClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'CloudPress/1.0',
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${GH_API}${path}`, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(`GitHub API ${method} ${path} failed: ${res.status} ${err.message || ''}`);
    }
    if (res.status === 204) return {} as T;
    return res.json() as Promise<T>;
  }

  // Verify token
  async verifyToken(): Promise<{ valid: boolean; login?: string; email?: string }> {
    try {
      const user = await this.request<{ login: string; email: string }>('GET', '/user');
      return { valid: true, login: user.login, email: user.email };
    } catch {
      return { valid: false };
    }
  }

  // Get authenticated user
  async getUser(): Promise<{ login: string; name: string; email: string; avatar_url: string }> {
    return this.request('GET', '/user');
  }

  // Create repository
  async createRepo(name: string, options: {
    description?: string;
    private?: boolean;
    auto_init?: boolean;
  } = {}): Promise<{ id: number; name: string; full_name: string; html_url: string; clone_url: string; default_branch: string }> {
    return this.request('POST', '/user/repos', {
      name,
      description: options.description || 'CloudPress headless WordPress site',
      private: options.private ?? false,
      auto_init: options.auto_init ?? true,
      has_issues: false,
      has_projects: false,
      has_wiki: false,
    });
  }

  // Check if repo exists
  async repoExists(fullName: string): Promise<boolean> {
    try {
      await this.request('GET', `/repos/${fullName}`);
      return true;
    } catch {
      return false;
    }
  }

  // Get file from repo
  async getFile(fullName: string, path: string, ref = 'main'): Promise<{ content: string; sha: string; encoding: string } | null> {
    try {
      return await this.request('GET', `/repos/${fullName}/contents/${path}?ref=${ref}`);
    } catch {
      return null;
    }
  }

  // Create or update file
  async upsertFile(fullName: string, path: string, content: string, message: string, sha?: string): Promise<void> {
    const base64Content = btoa(unescape(encodeURIComponent(content)));
    await this.request('PUT', `/repos/${fullName}/contents/${path}`, {
      message,
      content: base64Content,
      sha,
    });
  }

  // Upload binary file (base64 encoded)
  async uploadFile(fullName: string, path: string, base64Content: string, message: string, sha?: string): Promise<void> {
    await this.request('PUT', `/repos/${fullName}/contents/${path}`, {
      message,
      content: base64Content,
      sha,
    });
  }

  // Delete file
  async deleteFile(fullName: string, path: string, message: string, sha: string): Promise<void> {
    await this.request('DELETE', `/repos/${fullName}/contents/${path}`, { message, sha });
  }

  // List files in directory
  async listDir(fullName: string, path: string, ref = 'main'): Promise<Array<{ name: string; path: string; type: string; sha: string; size: number }>> {
    try {
      return await this.request('GET', `/repos/${fullName}/contents/${path}?ref=${ref}`);
    } catch {
      return [];
    }
  }

  // Initialize CloudPress site repo structure
  async initSiteRepo(fullName: string, siteId: string, siteName: string, wpUrl: string): Promise<void> {
    const readme = `# ${siteName}

CloudPress 헤드리스 워드프레스 사이트

- **Site ID**: ${siteId}
- **WordPress**: ${wpUrl}
- **Powered by**: [CloudPress](https://cloudpress.io)

## 구조

\`\`\`
public/          # 정적 자산 (미디어, CSS, JS)
  wp-content/    # WordPress 미디어 파일
dist/            # 빌드된 HTML (자동 생성)
cloudpress.json  # 사이트 설정
\`\`\`

> 이 저장소는 CloudPress에 의해 자동으로 관리됩니다.
`;

    const config = JSON.stringify({
      siteId,
      siteName,
      wpUrl,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
    }, null, 2);

    const gitignore = `node_modules/
.env
.env.local
*.log
`;

    // Create initial files
    await this.upsertFile(fullName, 'README.md', readme, 'Initial CloudPress setup');
    await this.upsertFile(fullName, 'cloudpress.json', config, 'Add CloudPress configuration');
    await this.upsertFile(fullName, '.gitignore', gitignore, 'Add .gitignore');
    await this.upsertFile(fullName, 'public/.gitkeep', '', 'Initialize public directory');
    await this.upsertFile(fullName, 'dist/.gitkeep', '', 'Initialize dist directory');
  }

  // Store media file reference (URL → path mapping)
  async syncMediaManifest(fullName: string, manifest: Record<string, string>): Promise<void> {
    const existing = await this.getFile(fullName, 'cloudpress-media.json');
    const currentManifest = existing ? JSON.parse(decodeURIComponent(escape(atob(existing.content.replace(/\n/g, ''))))) : {};
    const merged = { ...currentManifest, ...manifest };
    await this.upsertFile(
      fullName,
      'cloudpress-media.json',
      JSON.stringify(merged, null, 2),
      'Sync media manifest',
      existing?.sha
    );
  }

  // Delete repo
  async deleteRepo(fullName: string): Promise<void> {
    await this.request('DELETE', `/repos/${fullName}`);
  }

  // Add webhook to repo
  async addWebhook(fullName: string, url: string, secret: string): Promise<void> {
    await this.request('POST', `/repos/${fullName}/hooks`, {
      name: 'web',
      active: true,
      events: ['push'],
      config: { url, content_type: 'json', secret, insecure_ssl: '0' },
    });
  }
}