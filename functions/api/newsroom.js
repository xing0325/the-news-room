import { json, kvWorld, withAuth } from './_utils.js';

// GET /api/newsroom → 编辑部后台全量：职员/报社/近两期选题会与内部日志/履历高光
export const onRequestGet = withAuth(async ({ env }) => {
  const world = kvWorld(env);
  const [agencies, agents, index] = await Promise.all([
    world.get('state/agencies.json', []),
    world.get('state/agents.json', []),
    world.get('editions/index.json', []),
  ]);

  const recent = index.slice(-2);
  const editions = [];
  for (const e of recent) {
    const ed = await world.get(`editions/${e.no}.json`);
    if (ed) editions.push({ no: ed.no, label: ed.label, meetings: ed.meetings, backstage: ed.backstage, world_log: ed.world_log });
  }

  const memories = {};
  for (const a of agents) {
    memories[a.id] = (await world.get(`memories/${a.id}.json`, [])).slice(-6).reverse();
  }

  return json({ agencies, agents, editions, memories });
});
