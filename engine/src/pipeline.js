// 刊期管线：spec §3 的七步流程。一次 runEdition = 出一期报纸 + 结算世界。
// 世界"活着"的全部机制都在这里穿针引线；文字本身由 prompts.js + llm 生产。

import {
  wirePrompt, meetingPrompt, draftPrompt,
  reviewHezhenPrompt, reviewMidnightPrompt, reviewLinzhouPrompt,
  rewritePrompt, backstagePrompt, legacyPrompt, interviewPrompt,
} from './prompts.js';
import {
  applyDeltas, decay,
  ruleRejected, ruleFrontPage, ruleUserRead, ruleUserFlag, ruleColdStreak,
} from './world.js';

const CONTENT_TYPES = new Set(['diary', 'interview_answer', 'presser']);
const EDITOR_ROLES = new Set(['总编辑', '主编', '事实核查员', '标题编辑']);
const INTERVIEW_ROTATION = ['shenwang', 'qindao', 'linzhou', 'zhouxiaoman'];
const INTERVIEW_EXPIRE_EDITIONS = 3;

export async function runEdition({ store, llm, label, nowISO = () => new Date().toISOString() }) {
  // ---------- 载入世界 ----------
  const [agencies, agents, interviews, cards, index] = await store.batch([
    { op: 'get', key: 'state/agencies.json' },
    { op: 'get', key: 'state/agents.json' },
    { op: 'get', key: 'state/interviews.json' },
    { op: 'get', key: 'archive/cards.json' },
    { op: 'get', key: 'editions/index.json' },
  ]);
  if (!agencies || !agents) throw new Error('世界尚未创世（state/* 缺失），先跑 seed');

  const eventKeys = await store.list('events/');
  const eventBlobs = eventKeys.length
    ? await store.batch(eventKeys.map((k) => ({ op: 'get', key: k })))
    : [];
  const allEvents = eventBlobs.map((e, i) => ({ ...e, _key: eventKeys[i] })).filter(Boolean);
  const pending = allEvents.filter((e) => !e.processed);
  const contentEvents = pending.filter((e) => CONTENT_TYPES.has(e.type));
  const behaviorEvents = pending.filter((e) => !CONTENT_TYPES.has(e.type));

  const memoriesByAgent = {};
  const memKeys = agents.map((a) => `memories/${a.id}.json`);
  const memBlobs = await store.batch(memKeys.map((k) => ({ op: 'get', key: k })));
  agents.forEach((a, i) => { memoriesByAgent[a.id] = memBlobs[i] || []; });

  const no = (index?.at(-1)?.no ?? 0) + 1;
  const agentById = Object.fromEntries(agents.map((a) => [a.id]).map(([id]) => [id, agents.find((a) => a.id === id)]));
  const agencyById = Object.fromEntries(agencies.map((a) => [a.id, a]));
  const facts = [];           // 后台日志的真实素材
  const worldLog = [];        // 状态流水
  const pendingDeltas = [];   // {agentDeltas, agencyDeltas, memories}

  const settle = (r) => { if (r) pendingDeltas.push(r); };
  const themesInArchive = () => cards.filter((c) => c.kind === '主题').sort((a, b) => b.mentions - a.mentions).map((c) => c.name);

  // ---------- ① 通讯社：通稿 + 评分 ----------
  for (const ev of contentEvents) {
    const p = wirePrompt(ev, themesInArchive().slice(0, 8));
    const wire = await llm.chatJSON(p);
    ev.wire_copy = wire.wire_copy;
    ev.scores = wire.scores || {};
    ev.entities = wire.entities || {};
    ev.sensitive = !!wire.sensitive;
  }

  // ---------- ② 顾卷归档 + 重复模式 ----------
  const archiveHints = [];
  for (const ev of contentEvents) {
    for (const [kind, names] of Object.entries(ev.entities || {})) {
      for (const name of names || []) {
        let card = cards.find((c) => c.kind === kind && c.name === name);
        if (card) card.mentions += 1;
        else { card = { kind, name, first_seen: nowISO(), mentions: 1, bio_note: '' }; cards.push(card); }
        if (card.mentions >= 5) {
          archiveHints.push(`「${name}」已第 ${card.mentions} 次出现——顾卷建议按长期模式处理（可做纵向回顾/长期调查）。`);
        }
      }
    }
  }

  // ---------- ③ 各社选题会 ----------
  const meetings = [];
  const decisions = [];
  const openInterviewCount = interviews.filter((q) => q.status === 'open').length;
  for (const agency of agencies) {
    const roster = agents.filter((a) => a.agency_id === agency.id && a.status === 'active');
    // 伦理委员会硬闸：敏感通稿只让《用户日报》看见
    const visibleWires = contentEvents
      .filter((e) => (agency.id === 'daily' ? true : !e.sensitive))
      .map((e) => ({ event_id: e.id, wire_copy: e.wire_copy, scores: e.scores, sensitive: e.sensitive }));
    const p = meetingPrompt({
      agency, roster, wires: visibleWires,
      archiveHints: archiveHints.slice(0, 5),
      lastPerf: agency.state?.近况 || '',
      openInterviewCount,
    });
    const m = await llm.chatJSON(p);
    meetings.push({ agency_id: agency.id, transcript: m.transcript || '' });

    const writers = roster.filter((a) => !EDITOR_ROLES.has(a.role));
    const visibleIds = new Set(visibleWires.map((w) => w.event_id));
    for (const d of (m.decisions || []).slice(0, 3)) {
      const author = writers.find((w) => w.name === d.author) || writers[0];
      if (!author) continue;
      // 伦理硬闸第二道：报社只能报道它有资格看见的事件
      const event = d.event_id && visibleIds.has(d.event_id)
        ? contentEvents.find((e) => e.id === d.event_id) || null
        : null;
      decisions.push({
        agency, author,
        column: d.column || (event ? '快讯' : '专栏'),
        angle: d.angle || '',
        headline_hint: d.headline_hint || '',
        event,
      });
    }
  }

  // ---------- ④⑤ 写稿 + 审稿 ----------
  const articles = [];
  let artSeq = 0;
  const pushArticle = (a) => { articles.push(a); return a; };

  for (const d of decisions) {
    const factLayer = d.event
      ? [{ event_id: d.event.id, raw_text: d.event.raw_text }]
      : [];
    const mem = memoriesByAgent[d.author.id] || [];
    let draft = await llm.chatJSON(draftPrompt({
      agent: d.author, agency: d.agency,
      assignment: { column: d.column, angle: d.angle, headline_hint: d.headline_hint },
      factLayer, memories: mem,
    }));
    let reviewNote = '';

    if (d.agency.id === 'daily') {
      const hezhen = agents.find((a) => a.id === 'hezhen');
      const verdictRes = await llm.chatJSON(reviewHezhenPrompt({
        reviewer: hezhen, article: draft, factLayer,
      }));
      if (verdictRes.verdict === 'revise') {
        facts.push(`《用户日报》：${d.author.name}的稿件《${draft.headline}》被贺真打回（理由：${verdictRes.note}），重写一稿后过审。`);
        settle(ruleRejected({ author: d.author, reviewer: hezhen, note: verdictRes.note }));
        draft = await llm.chatJSON(rewritePrompt({
          agent: d.author, agency: d.agency, original: draft,
          reviewNote: verdictRes.note, factLayer,
        }));
        reviewNote = `初稿被贺真打回：${verdictRes.note}`;
      } else {
        reviewNote = `贺真放行：${verdictRes.note || ''}`;
      }
    } else if (d.agency.id === 'midnight') {
      const wu = agents.find((a) => a.id === 'wuzhenjing');
      const mai = agents.find((a) => a.id === 'mailang');
      const r = await llm.chatJSON(reviewMidnightPrompt({
        titleEditor: wu, chief: mai, agency: d.agency, article: draft,
      }));
      if (r.headline && r.headline !== draft.headline) {
        reviewNote = `原标题《${draft.headline}》；武震惊改造后麦浪拍板："${r.note || ''}"`;
        facts.push(`《深夜头条》：武震惊把《${draft.headline}》改成《${r.headline}》，麦浪拍板："${r.note || '能爆'}"`);
        draft.headline = r.headline;
      }
    } else if (d.agency.id === 'biography' && d.author.id === 'linzhou') {
      const r = await llm.chatJSON(reviewLinzhouPrompt({ agent: d.author, article: draft }));
      if (r.body) draft.body = r.body;
      reviewNote = `林舟自审：${r.note || ''}`;
    }

    pushArticle({
      id: `a${no}-${artSeq++}`,
      agency_id: d.agency.id,
      author_agent_id: d.author.id,
      author_name: d.author.name,
      col: d.column,
      headline: draft.headline,
      body: draft.body,
      fact_refs: factLayer.map((f) => f.event_id),
      facts: Object.fromEntries(factLayer.map((f) => [f.event_id, f.raw_text])),
      review_note: reviewNote,
      status: 'published',
    });
    settle({ agentDeltas: {}, agencyDeltas: {}, memories: [{ agent_id: d.author.id, kind: '稿件', content: `为《${d.agency.name}》交稿《${draft.headline}》（${d.column}）` }] });
  }

  // ---------- 用户行为结算（阅读/更正/订阅） ----------
  let midnightGotRead = false;
  for (const b of behaviorEvents) {
    const author = agents.find((a) => a.id === b.author_agent_id);
    const agency = agencyById[b.agency_id];
    if (b.type === 'read' && author && agency) {
      settle(ruleUserRead({ author, agency, headline: b.headline || '' }));
      if (agency.id === 'midnight') midnightGotRead = true;
      facts.push(`当事人本人阅读了《${agency.name}》的《${b.headline || '某文'}》——${author.name}今天走路带风。`);
    } else if (b.type === 'flag' && author && agency) {
      settle(ruleUserFlag({ author, agency, headline: b.headline || '', note: b.note }));
      facts.push(`当事人对《${agency.name}》的《${b.headline || '某文'}》提出更正要求："${b.note || ''}"，下期须刊更正声明。`);
      const correction = await llm.chatJSON(draftPrompt({
        agent: author, agency,
        assignment: {
          column: '更正',
          angle: `本报此前刊发《${b.headline}》，当事人指出报道不实（"${b.note || '未附说明'}"）。以更正声明体面地承认失误，说明将提高证据标准。`,
          headline_hint: '更正声明',
        },
        factLayer: [{ event_id: b.id, raw_text: `当事人回应：${b.note || '此前报道与事实不符'}` }],
        memories: memoriesByAgent[author.id] || [],
      }));
      pushArticle({
        id: `a${no}-${artSeq++}`,
        agency_id: agency.id, author_agent_id: author.id, author_name: author.name,
        col: '更正', headline: correction.headline, body: correction.body,
        fact_refs: [b.id], facts: { [b.id]: `当事人回应：${b.note || ''}` },
        review_note: `由当事人更正请求触发（原文《${b.headline || ''}》）`, status: 'published',
      });
    } else if (b.type === 'subscribe' && agency) {
      agency.subscribed = !!b.value;
      settle({ agentDeltas: {}, agencyDeltas: { [agency.id]: { 财务: b.value ? 5 : -8, 声望: b.value ? 2 : -2 } }, memories: [] });
      facts.push(`当事人${b.value ? '订阅' : '退订'}了《${agency.name}》——发行部${b.value ? '开了香槟' : '一片死寂'}。`);
    }
  }

  // 深夜头条连续零阅读 → 标题党倾向上浮
  const midnight = agencyById['midnight'];
  if (midnight) {
    midnight.state.连续零阅读 = midnightGotRead ? 0 : (midnight.state.连续零阅读 ?? 0) + 1;
    if (midnight.state.连续零阅读 >= 2) {
      settle(ruleColdStreak({ agency: midnight }));
      facts.push('《深夜头条》连续两刊无人问津，麦浪在走廊里说"标题还不够炸"。');
      midnight.state.连续零阅读 = 0;
    }
  }

  // ---------- ⑥ 定版：头版 + 内部日志 ----------
  const frontCandidates = articles.filter((a) => a.status === 'published' && a.col !== '更正');
  const newsScore = (a) => {
    const ev = contentEvents.find((e) => a.fact_refs.includes(e.id));
    const base = ev?.scores?.news ?? 20;
    return a.agency_id === 'daily' ? base + 10 : base; // 大报头版加权
  };
  const front = frontCandidates.sort((a, b) => newsScore(b) - newsScore(a))[0] || articles[0] || null;
  if (front) {
    const author = agents.find((a) => a.id === front.author_agent_id);
    const agency = agencyById[front.agency_id];
    settle(ruleFrontPage({ author, agency, headline: front.headline }));
    facts.push(`本期头版：《${front.headline}》（${agency.name}·${author.name}）。`);
  }
  if (!contentEvents.length) facts.push('慢新闻日：没有新线索，各版靠专栏与档案回顾撑住了版面。');

  const backstage = (await llm.chatJSON(backstagePrompt({ facts }))).transcript || '';

  // ---------- ⑦ 沉淀：传记预览 + 采访 + 状态结算 ----------
  const linzhou = agents.find((a) => a.id === 'linzhou');
  for (const ev of contentEvents) {
    const related = cards
      .filter((c) => (ev.entities?.主题 || []).includes(c.name) && c.mentions > 1)
      .map((c) => `「${c.name}」此前已出现 ${c.mentions - 1} 次`);
    const legacy = await llm.chatJSON(legacyPrompt({ agent: linzhou, event: ev, related }));
    ev.legacy_note = legacy.legacy_note || '';
    for (const t of legacy.themes || []) {
      if (!cards.find((c) => c.kind === '主题' && c.name === t)) {
        cards.push({ kind: '主题', name: t, first_seen: nowISO(), mentions: 1, bio_note: '' });
      }
    }
  }

  // 采访：过期清理 + 本期新问题
  for (const q of interviews) {
    if (q.status === 'open' && no - (q.edition_no ?? no) >= INTERVIEW_EXPIRE_EDITIONS) q.status = 'expired';
  }
  const asker = agents.find((a) => a.id === INTERVIEW_ROTATION[no % INTERVIEW_ROTATION.length]);
  const iv = await llm.chatJSON(interviewPrompt({
    asker, agency: agencyById[asker.agency_id],
    recentWires: contentEvents.map((e) => e.wire_copy).filter(Boolean).slice(0, 5),
    archiveThemes: themesInArchive().slice(0, 6),
  }));
  for (const q of (iv.questions || []).slice(0, 3)) {
    interviews.push({
      id: `q${no}-${interviews.length}`, asked_by: asker.id, asked_by_name: asker.name,
      agency_id: asker.agency_id, question: q, status: 'open', edition_no: no, answer_event_id: null,
    });
  }

  // 状态结算：先规则后衰减
  for (const r of pendingDeltas) {
    for (const [id, deltas] of Object.entries(r.agentDeltas || {})) {
      const agent = agents.find((a) => a.id === id);
      if (!agent) continue;
      agent.state = applyDeltas(agent.state, deltas);
      worldLog.push(`${agent.name} ${Object.entries(deltas).map(([k, v]) => `${k}${v > 0 ? '+' : ''}${v}`).join(' ')}`);
    }
    for (const [id, deltas] of Object.entries(r.agencyDeltas || {})) {
      const agency = agencyById[id];
      if (!agency) continue;
      agency.state = applyDeltas(agency.state, deltas);
      worldLog.push(`《${agency.name}》 ${Object.entries(deltas).map(([k, v]) => `${k}${v > 0 ? '+' : ''}${v}`).join(' ')}`);
    }
    for (const m of r.memories || []) {
      memoriesByAgent[m.agent_id] = [...(memoriesByAgent[m.agent_id] || []), { ...m, edition_no: no, at: nowISO() }].slice(-100);
    }
  }
  for (const a of agents) a.state = decay(a.state);

  // ---------- 持久化 ----------
  const publishedAt = nowISO();
  const edition = {
    no, label, published_at: publishedAt,
    front_article_id: front?.id || null,
    articles, meetings, backstage,
    world_log: worldLog,
  };
  const newIndex = [...(index || []), { no, label, published_at: publishedAt, front_headline: front?.headline || '' }];

  const writes = [
    { op: 'set', key: `editions/${no}.json`, value: edition },
    { op: 'set', key: 'editions/index.json', value: newIndex },
    { op: 'set', key: 'state/agencies.json', value: agencies },
    { op: 'set', key: 'state/agents.json', value: agents },
    { op: 'set', key: 'state/interviews.json', value: interviews },
    { op: 'set', key: 'archive/cards.json', value: cards },
    ...agents.map((a) => ({ op: 'set', key: `memories/${a.id}.json`, value: memoriesByAgent[a.id] || [] })),
    ...pending.map((ev) => {
      const { _key, ...clean } = ev;
      return { op: 'set', key: _key, value: { ...clean, processed: no } };
    }),
  ];
  await store.batch(writes);

  return { no, label, articles: articles.length, calls: llm.calls(), backstageLines: backstage.split('\n').length };
}
