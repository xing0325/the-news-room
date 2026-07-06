// Cloudflare Pages Functions 公共件：会话 cookie（HMAC）、KV 包装、响应助手。

const COOKIE_NAME = 'tnr_session';
const NINETY_DAYS = 60 * 60 * 24 * 90;

const enc = new TextEncoder();

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function makeSessionCookie(secret) {
  const exp = Math.floor(Date.now() / 1000) + NINETY_DAYS;
  const sig = await hmac(secret, String(exp));
  return `${COOKIE_NAME}=${exp}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${NINETY_DAYS}`;
}

export async function isAuthed(request, secret) {
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!m) return false;
  const [expStr, sig] = m[1].split('.');
  const exp = Number(expStr);
  if (!exp || !sig || exp < Date.now() / 1000) return false;
  return (await hmac(secret, String(exp))) === sig;
}

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', ...(init.headers || {}) },
  });
}

export const unauthorized = () => json({ error: 'unauthorized' }, { status: 401 });

// 鉴权守卫：包住需要登录的 handler
export function withAuth(handler) {
  return async (context) => {
    if (!(await isAuthed(context.request, context.env.SESSION_SECRET))) return unauthorized();
    return handler(context);
  };
}

// —— KV 包装：与 engine 的世界布局同键 ——
export function kvWorld(env) {
  const kv = env.WORLD;
  return {
    async get(key, fallback = null) {
      const v = await kv.get(key, { type: 'json' });
      return v ?? fallback;
    },
    async set(key, value) { await kv.put(key, JSON.stringify(value)); },
    async list(prefix) {
      const keys = [];
      let cursor;
      do {
        const r = await kv.list({ prefix, cursor });
        keys.push(...r.keys.map((k) => k.name));
        cursor = r.list_complete ? null : r.cursor;
      } while (cursor);
      return keys;
    },
    async delete(key) { await kv.delete(key); },
  };
}

export function eventKey(id) {
  const ts = new Date().toISOString().replaceAll(':', '-');
  return `events/${ts}-${id}.json`;
}

export function randomId() {
  return crypto.randomUUID().slice(0, 8);
}
