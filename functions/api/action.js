import { eventKey, json, kvWorld, randomId, withAuth } from './_utils.js';

// POST /api/action — 用户行为也是事件：阅读 / 这不准 / 订阅。由下一刊 tick 结算。
export const onRequestPost = withAuth(async ({ request, env }) => {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, { status: 400 }); }
  const { type } = body || {};
  if (!['read', 'flag', 'subscribe'].includes(type)) return json({ error: 'bad type' }, { status: 400 });

  const id = randomId();
  const base = { id, type, processed: false, created_at: new Date().toISOString() };
  let event;
  if (type === 'subscribe') {
    event = { ...base, agency_id: body.agency_id, value: !!body.value };
  } else {
    event = {
      ...base,
      article_id: body.article_id,
      edition_no: body.edition_no,
      agency_id: body.agency_id,
      author_agent_id: body.author_agent_id,
      headline: body.headline || '',
      note: (body.note || '').slice(0, 500),
    };
    if (!event.article_id || !event.agency_id) return json({ error: 'missing fields' }, { status: 400 });
  }
  await kvWorld(env).set(eventKey(id), event);
  return json({ ok: true });
});
