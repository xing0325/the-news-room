import { json, kvWorld } from './_utils.js';

// 世界状态的机务门：engine（GitHub Actions）经它批量读写 KV。
// 与 engine/src/store.js 的协议一致：{ops:[{op:get|set|list|delete,...}]} → {results:[...]}
export async function onRequestPost({ request, env }) {
  const secret = env.ADMIN_SECRET;
  if (!secret || request.headers.get('x-admin-key') !== secret) {
    return json({ error: 'unauthorized' }, { status: 401 });
  }
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, { status: 400 }); }
  const ops = body?.ops;
  if (!Array.isArray(ops) || ops.length === 0 || ops.length > 24) {
    return json({ error: 'ops must be 1-24 items' }, { status: 400 });
  }
  const world = kvWorld(env);
  const results = [];
  for (const o of ops) {
    if (o.op === 'get') results.push(await world.get(o.key));
    else if (o.op === 'set') { await world.set(o.key, o.value); results.push(true); }
    else if (o.op === 'list') results.push(await world.list(o.prefix || ''));
    else if (o.op === 'delete') { await world.delete(o.key); results.push(true); }
    else results.push(null);
  }
  return json({ results });
}
