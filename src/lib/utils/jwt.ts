// src/lib/utils/jwt.ts

export interface JWTPayload {
    sub: string;       // user id
    email: string;
    role: string;
    name: string;
    sid: string;       // session id
    iat: number;
    exp: number;
  }
  
  export async function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>, secret: string, expiresInSeconds = 604800): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: JWTPayload = { ...payload, iat: now, exp: now + expiresInSeconds };
  
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const body = btoa(JSON.stringify(fullPayload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const message = `${header}.${body}`;
  
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    const sigStr = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
    return `${message}.${sigStr}`;
  }
  
  export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
  
      const [header, body, sig] = parts;
      const message = `${header}.${body}`;
  
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
      const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
      const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(message));
      if (!valid) return null;
  
      const payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/'))) as JWTPayload;
      if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  
      return payload;
    } catch {
      return null;
    }
  }
  
  export function getTokenFromRequest(request: Request): string | null {
    // Cookie first
    const cookie = request.headers.get('cookie') || '';
    const match = cookie.match(/cp_token=([^;]+)/);
    if (match) return match[1];
  
    // Authorization header
    const auth = request.headers.get('authorization') || '';
    if (auth.startsWith('Bearer ')) return auth.slice(7);
  
    return null;
  }