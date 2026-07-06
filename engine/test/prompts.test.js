import { describe, it, expect } from 'vitest';
import {
  agentCard, memoryDigest, wirePrompt, meetingPrompt, draftPrompt,
  reviewHezhenPrompt, reviewMidnightPrompt, rewritePrompt,
  backstagePrompt, legacyPrompt, interviewPrompt,
} from '../src/prompts.js';
import { AGENTS, AGENCIES } from '../src/seed.js';

const byId = (id) => AGENTS.find((a) => a.id === id);
const agencyById = (id) => AGENCIES.find((a) => a.id === id);

describe('agentCard', () => {
  it('人格与状态数值显式进 prompt', () => {
    const card = agentCard(byId('zhouxiaoman'), '深夜头条');
    expect(card).toContain('周小满');
    expect(card).toContain('实习记者');
    expect(card).toContain('这次一定上头条！');
    expect(card).toContain('野心85');
    expect(card).toContain('压力>70');
  });
});

describe('memoryDigest', () => {
  it('空履历有新人文案，非空取最近条目', () => {
    expect(memoryDigest([])).toContain('新面孔');
    const d = memoryDigest([
      { kind: '被打回', content: 'A' },
      { kind: '高光', content: 'B' },
    ]);
    expect(d).toContain('[被打回] A');
    expect(d).toContain('[高光] B');
  });
});

describe('构造器要素齐全', () => {
  const event = { raw_text: '今天把 spec 定稿了', type: 'diary', created_at: '2026-07-06' };

  it('wirePrompt 带六维评分口径与敏感判定', () => {
    const p = wirePrompt(event, ['AI', '工具']);
    expect(p.system).toContain('中央通讯社');
    expect(p.system).toContain('sensitive');
    expect(p.user).toContain('今天把 spec 定稿了');
    expect(p.schemaHint).toContain('wire_copy');
  });

  it('meetingPrompt 含行规（敏感线索只归日报）与全员状态', () => {
    const roster = AGENTS.filter((a) => a.agency_id === 'midnight');
    const p = meetingPrompt({
      agency: agencyById('midnight'), roster,
      wires: [{ event_id: 'e1', wire_copy: '本社讯，……', scores: { news: 70 }, sensitive: false }],
    });
    expect(p.system).toContain('用户日报');
    expect(p.system).toContain('敏感');
    expect(p.system).toContain('麦浪');
    expect(p.user).toContain('e1');
    expect(p.schemaHint).toContain('decisions');
  });

  it('draftPrompt 含事实层纪律与履历', () => {
    const p = draftPrompt({
      agent: byId('shenwang'), agency: agencyById('daily'),
      assignment: { column: '深度', angle: '工具与命运', headline_hint: '' },
      factLayer: [{ event_id: 'e1', raw_text: '今天把 spec 定稿了' }],
      memories: [{ kind: '被打回', content: '上次被贺真批了' }],
    });
    expect(p.system).toContain('只能引用【事实层】');
    expect(p.system).toContain('上次被贺真批了');
    expect(p.user).toContain('[e1]');
    expect(p.system).toContain('500-800字');
  });

  it('贺真审稿带手术刀标准', () => {
    const p = reviewHezhenPrompt({
      reviewer: byId('hezhen'),
      article: { headline: 'X', body: 'Y' },
      factLayer: [],
    });
    expect(p.system).toContain('内部人士');
    expect(p.schemaHint).toContain('verdict');
  });

  it('深夜头条定版按标题党倾向改标题', () => {
    const p = reviewMidnightPrompt({
      titleEditor: byId('wuzhenjing'), chief: byId('mailang'),
      agency: agencyById('midnight'), article: { headline: 'X', body: 'Y'.repeat(200) },
    });
    expect(p.system).toContain('标题党倾向');
    expect(p.system).toContain('75/100');
  });

  it('rewritePrompt 把打回理由贴在桌上', () => {
    const p = rewritePrompt({
      agent: byId('zhouxiaoman'), agency: agencyById('midnight'),
      original: { headline: 'X', body: 'Y' }, reviewNote: '形容词失控',
    });
    expect(p.system).toContain('形容词失控');
    expect(p.system).toContain('被打回');
  });

  it('内部日志只许改写真实事件', () => {
    const p = backstagePrompt({ facts: ['武震惊标题被打回'] });
    expect(p.system).toContain('只能改写');
    expect(p.user).toContain('武震惊标题被打回');
  });

  it('legacyPrompt 回答三问', () => {
    const p = legacyPrompt({ agent: byId('linzhou'), event, related: ['三个月前也提过'] });
    expect(p.schemaHint).toContain('legacy_note');
    expect(p.schemaHint).toContain('into_biography');
    expect(p.user).toContain('三个月前也提过');
  });

  it('interviewPrompt 名人访谈腔锚定近况', () => {
    const p = interviewPrompt({
      asker: byId('shenwang'), agency: agencyById('daily'),
      recentWires: ['本社讯，用户定稿了 spec'], archiveThemes: ['AI'],
    });
    expect(p.system).toContain('名人访谈腔');
    expect(p.user).toContain('定稿了 spec');
  });
});
