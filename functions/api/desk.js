import { json, kvWorld, withAuth } from './_utils.js';

// GET /api/desk → 待答采访 + 我的事件流（含传记预览）
export const onRequestGet = withAuth(async ({ env }) => {
  const world = kvWorld(env);
  const interviews = await world.get('state/interviews.json', []);

  const keys = (await world.list('events/')).sort().slice(-30);
  const events = [];
  for (const k of keys) {
    const e = await world.get(k);
    if (e) events.push(e);
  }
  const contentEvents = events
    .filter((e) => ['diary', 'interview_answer', 'presser'].includes(e.type))
    .reverse();

  // 已提交回答但 tick 还没消化的问题：前端视作已答，避免重复回答
  const answeredIds = new Set(
    events.filter((e) => e.type === 'interview_answer' && e.question_id).map((e) => e.question_id),
  );
  const open = interviews.filter((q) => q.status === 'open' && !answeredIds.has(q.id));

  return json({ interviews: open, events: contentEvents });
});
