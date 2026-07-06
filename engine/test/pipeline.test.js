import { describe, it, expect } from 'vitest';
import { runEdition } from '../src/pipeline.js';
import { AGENCIES, AGENTS } from '../src/seed.js';

// —— 内存版 store：与 engine/src/store.js 同接口 ——
function memStore(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    async get(key) { return data.has(key) ? structuredClone(data.get(key)) : null; },
    async setJSON(key, value) { data.set(key, structuredClone(value)); },
    async list(prefix) { return [...data.keys()].filter((k) => k.startsWith(prefix)); },
    async delete(key) { data.delete(key); },
    async batch(ops) {
      const out = [];
      for (const o of ops) {
        if (o.op === 'get') out.push(await this.get(o.key));
        else if (o.op === 'set') { await this.setJSON(o.key, o.value); out.push(true); }
        else if (o.op === 'list') out.push(await this.list(o.prefix || ''));
      }
      return out;
    },
  };
}

// —— 按 schemaHint/内容分发的假 LLM ——
function mockLLM() {
  let used = 0;
  const seen = { rewrites: 0, meetings: [], drafts: 0 };
  async function chatJSON({ system = '', user = '', schemaHint = '' }) {
    used += 1;
    if (schemaHint.includes('wire_copy')) {
      return {
        wire_copy: '本社讯，用户完成了一件测试事件。',
        scores: { news: 80, bio: 60, emotion: 40, theme: 50, turning: 30, repeat: 10 },
        entities: { 人物: [], 作品: ['the news room'], 地点: [], 主题: ['AI', '工具'] },
        sensitive: false,
      };
    }
    if (schemaHint.includes('decisions')) {
      const isDaily = system.includes('模拟《用户日报》');
      const isMidnight = system.includes('模拟《深夜头条》');
      seen.meetings.push(isDaily ? 'daily' : isMidnight ? 'midnight' : 'biography');
      const hasWire = !user.includes('今天没有新通稿');
      const eid = hasWire ? user.match(/\[([^\]]+)\]/)?.[1] ?? null : null;
      if (isDaily) {
        return { transcript: '老周：开会。\n沈望：我来写。', decisions: [{ event_id: eid, column: hasWire ? '深度' : '专栏', angle: '角度', author: hasWire ? '沈望' : '秦刀', headline_hint: '' }] };
      }
      if (isMidnight) {
        return { transcript: '麦浪：能爆吗？\n周小满：能！', decisions: [{ event_id: eid, column: '快讯', angle: '爆点', author: '周小满', headline_hint: '' }] };
      }
      return { transcript: '林舟：值得入档。', decisions: [{ event_id: eid, column: '传记', angle: '章节感', author: '林舟', headline_hint: '' }] };
    }
    if (schemaHint.includes('verdict')) {
      return { verdict: 'revise', note: '无证据断言，打回。' };
    }
    if (schemaHint.includes('改造后的标题')) {
      return { headline: '震惊！测试事件背后竟是这样', note: '这个能爆。' };
    }
    if (schemaHint.includes('定稿正文')) {
      return { body: '定稿正文：十年后读也站得住。', note: '删了一个廉价煽情。' };
    }
    if (schemaHint.includes('legacy_note')) {
      return { legacy_note: '那一天，他把玩笑当成了工程。', meaning: '玩笑变工程', themes: ['AI'], into_biography: true };
    }
    if (schemaHint.includes('questions')) {
      return { questions: ['如果未来有人给你写传记，这一章你希望叫什么？'] };
    }
    if (schemaHint.includes('transcript')) {
      return { transcript: '09:12，编辑部日常运转。' };
    }
    if (schemaHint.includes('headline')) {
      if (user.includes('被打回')) seen.rewrites += 1;
      else seen.drafts += 1;
      return { headline: '测试标题', body: '这是一段足够长的正文。'.repeat(10) };
    }
    throw new Error(`mock 不认识的 prompt: ${schemaHint.slice(0, 40)}`);
  }
  return { chatJSON, chat: async () => 'text', calls: () => used, seen };
}

function seededStore(extra = {}) {
  return memStore({
    'state/agencies.json': AGENCIES,
    'state/agents.json': AGENTS,
    'state/interviews.json': [],
    'archive/cards.json': [],
    'editions/index.json': [],
    ...extra,
  });
}

describe('runEdition 正常日', () => {
  it('一条日记产出整期报纸并结算世界状态', async () => {
    const store = seededStore({
      'events/2026-07-06T10-00-00-abc.json': {
        id: 'abc', type: 'diary', raw_text: '今天把 the news room 的 spec 定稿了。',
        processed: false, created_at: '2026-07-06T10:00:00Z',
      },
    });
    const llm = mockLLM();
    const summary = await runEdition({ store, llm, label: '晚刊', nowISO: () => '2026-07-06T11:30:00Z' });

    expect(summary.no).toBe(1);
    const edition = await store.get('editions/1.json');
    expect(edition.articles.length).toBeGreaterThanOrEqual(3);
    expect(edition.meetings).toHaveLength(3);
    expect(edition.backstage).toContain('09:12');
    expect(edition.front_article_id).toBeTruthy();

    // 事实层快照内嵌
    const withFacts = edition.articles.find((a) => a.fact_refs.includes('abc'));
    expect(withFacts.facts.abc).toContain('spec 定稿');

    // 贺真打回 → 重写发生 → 沈望压力上升（+10 打回，-5 decay 后仍高于初始 50）
    expect(llm.seen.rewrites).toBeGreaterThanOrEqual(1);
    const agents = await store.get('state/agents.json');
    const shenwang = agents.find((a) => a.id === 'shenwang');
    expect(shenwang.state.压力).toBeGreaterThan(50);

    // 履历落盘
    const mem = await store.get('memories/shenwang.json');
    expect(mem.some((m) => m.kind === '被打回')).toBe(true);

    // 事件被标记处理 + 传记预览
    const ev = await store.get('events/2026-07-06T10-00-00-abc.json');
    expect(ev.processed).toBe(1);
    expect(ev.legacy_note).toContain('那一天');

    // 档案卡长了
    const cards = await store.get('archive/cards.json');
    expect(cards.some((c) => c.name === 'AI')).toBe(true);

    // 采访问题产生
    const interviews = await store.get('state/interviews.json');
    expect(interviews.length).toBeGreaterThanOrEqual(1);

    // 期号索引
    const index = await store.get('editions/index.json');
    expect(index).toHaveLength(1);
    expect(index[0]).toMatchObject({ no: 1, label: '晚刊' });
  });
});

describe('runEdition 慢新闻日', () => {
  it('零输入照样出刊不炸', async () => {
    const store = seededStore();
    const llm = mockLLM();
    const summary = await runEdition({ store, llm, label: '早刊', nowISO: () => '2026-07-07T00:00:00Z' });
    expect(summary.no).toBe(1);
    const edition = await store.get('editions/1.json');
    expect(edition.articles.length).toBeGreaterThanOrEqual(1);
    expect(edition.meetings.length).toBe(3);
  });
});

describe('runEdition 用户行为结算', () => {
  it('阅读事件加心情加财务，更正事件出更正声明', async () => {
    const store = seededStore({
      'editions/index.json': [{ no: 1, label: '早刊', published_at: 'x', front_headline: 'y' }],
      'events/2026-07-06T12-00-00-r1.json': {
        id: 'r1', type: 'read', article_id: 'a1-0', edition_no: 1,
        author_agent_id: 'shenwang', agency_id: 'daily', headline: '旧文', processed: false,
        created_at: '2026-07-06T12:00:00Z',
      },
      'events/2026-07-06T12-01-00-f1.json': {
        id: 'f1', type: 'flag', article_id: 'a1-1', edition_no: 1,
        author_agent_id: 'zhouxiaoman', agency_id: 'midnight', headline: '夸大稿', note: '我没说过这话',
        processed: false, created_at: '2026-07-06T12:01:00Z',
      },
    });
    const llm = mockLLM();
    await runEdition({ store, llm, label: '晚刊', nowISO: () => '2026-07-06T11:30:00Z' });

    const agents = await store.get('state/agents.json');
    const shenwang = agents.find((a) => a.id === 'shenwang');
    const mem = await store.get('memories/shenwang.json');
    expect(mem.some((m) => m.content.includes('当事人本人阅读了本文'))).toBe(true);

    const agencies = await store.get('state/agencies.json');
    const daily = agencies.find((a) => a.id === 'daily');
    expect(daily.state.财务).toBe(57); // 55 + 2

    const edition = await store.get('editions/2.json');
    const corrections = edition.articles.filter((a) => a.col === '更正');
    expect(corrections.length).toBe(1);
    expect(corrections[0].agency_id).toBe('midnight');
  });
});
