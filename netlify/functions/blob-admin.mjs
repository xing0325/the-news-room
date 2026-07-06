// 世界状态的唯一后门：engine（GitHub Actions）经它批量读写 Blobs。
// 运行时对站点 Blobs 有原生权限，外部只需 ADMIN_SECRET，不需要 Netlify PAT。
import { getStore } from '@netlify/blobs';

export default async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers.get('x-admin-key') !== secret) {
    return new Response('unauthorized', { status: 401 });
  }
  let body;
  try { body = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  const ops = body?.ops;
  if (!Array.isArray(ops) || ops.length === 0 || ops.length > 24) {
    return new Response('ops must be 1-24 items', { status: 400 });
  }
  const store = getStore('world');
  const results = [];
  for (const o of ops) {
    if (o.op === 'get') {
      results.push(await store.get(o.key, { type: 'json' }));
    } else if (o.op === 'set') {
      await store.setJSON(o.key, o.value);
      results.push(true);
    } else if (o.op === 'list') {
      const { blobs } = await store.list({ prefix: o.prefix || '' });
      results.push(blobs.map((b) => b.key));
    } else if (o.op === 'delete') {
      await store.delete(o.key);
      results.push(true);
    } else {
      results.push(null);
    }
  }
  return Response.json({ results });
};

export const config = { path: '/api/blob-admin' };
