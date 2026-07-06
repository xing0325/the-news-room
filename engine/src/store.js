// 世界状态适配层。engine 不直连 Netlify Blobs（外部写需要 PAT），
// 而是走站点自己的 /api/blob-admin（ADMIN_SECRET 鉴权，批量 op）。
// 世界的一切修改都从报社自己的大门进出。

const MAX_OPS_PER_CALL = 20;

export function worldStore(env = process.env) {
  const base = (env.SITE_URL || '').replace(/\/$/, '');
  const key = env.ADMIN_SECRET;
  if (!base || !key) throw new Error('engine 需要 SITE_URL / ADMIN_SECRET');

  async function call(ops, attempt = 1) {
    const res = await fetch(`${base}/api/blob-admin`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-key': key },
      body: JSON.stringify({ ops }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status >= 500 && attempt < 3) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        return call(ops, attempt + 1);
      }
      throw new Error(`blob-admin ${res.status}: ${text.slice(0, 200)}`);
    }
    const { results } = await res.json();
    return results;
  }

  async function batch(ops) {
    const results = [];
    for (let i = 0; i < ops.length; i += MAX_OPS_PER_CALL) {
      results.push(...(await call(ops.slice(i, i + MAX_OPS_PER_CALL))));
    }
    return results;
  }

  return {
    async get(key) { return (await call([{ op: 'get', key }]))[0]; },
    async setJSON(key, value) { await call([{ op: 'set', key, value }]); },
    async list(prefix) { return (await call([{ op: 'list', prefix }]))[0]; },
    async delete(key) { await call([{ op: 'delete', key }]); },
    batch,
  };
}

export async function getJSON(store, key, fallback = null) {
  return (await store.get(key)) ?? fallback;
}

export async function setJSON(store, key, value) {
  await store.setJSON(key, value);
}

export async function listKeys(store, prefix) {
  return store.list(prefix);
}
