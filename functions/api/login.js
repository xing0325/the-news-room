import { json, makeSessionCookie, sha256hex } from './_utils.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, { status: 400 }); }
  const hash = await sha256hex(body?.password || '');
  if (!env.APP_PASSWORD_HASH || hash !== env.APP_PASSWORD_HASH) {
    return json({ error: '口令不对。本报只认一位当事人。' }, { status: 401 });
  }
  return json({ ok: true }, { headers: { 'set-cookie': await makeSessionCookie(env.SESSION_SECRET) } });
}
