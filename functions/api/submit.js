import { eventKey, json, kvWorld, randomId, withAuth } from './_utils.js';

// POST /api/submit — 内容输入：日记 / 采访回答 / 发布会。只追加事件，绝不改共享文档。
export const onRequestPost = withAuth(async ({ request, env }) => {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, { status: 400 }); }
  const type = ['diary', 'interview_answer', 'presser'].includes(body?.type) ? body.type : 'diary';
  const raw = (body?.raw_text || '').trim();
  if (!raw) return json({ error: '空稿子connot上版' }, { status: 400 });
  if (raw.length > 4000) return json({ error: '单条别超过 4000 字，长文拆几条发' }, { status: 400 });

  const id = randomId();
  const event = {
    id, type,
    raw_text: type === 'interview_answer' && body.question_text
      ? `【回应${body.asked_by_name || '记者'}的提问「${body.question_text}」】${raw}`
      : raw,
    question_id: body?.question_id || null,
    processed: false,
    created_at: new Date().toISOString(),
  };
  await kvWorld(env).set(eventKey(id), event);
  return json({ ok: true, id });
});
