// 世界状态规则：全部纯函数。文风不是设定出来的，是这些数值和记忆
// 在 prompt 里日积月累压出来的。规则表见 spec §2.2 与 plan Task 4。

export const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

export function applyDeltas(state, deltas) {
  const out = { ...state };
  for (const [k, d] of Object.entries(deltas)) {
    out[k] = clamp((out[k] ?? 50) + d);
  }
  return out;
}

// 每刊末尾：压力向 50 回归 5 点（不越过基线），其余数值不自然回归。
export function decay(state) {
  const p = state.压力 ?? 50;
  const step = p > 50 ? -Math.min(5, p - 50) : Math.min(5, 50 - p);
  return { ...state, 压力: clamp(p + step) };
}

// —— 以下规则返回 { agentDeltas, agencyDeltas, memories }，由管线统一结算 ——

export function ruleRejected({ author, reviewer, note }) {
  return {
    agentDeltas: {
      [author.id]: { 压力: 10, 自信: -5 },
      [reviewer.id]: { 声望: 2 },
    },
    agencyDeltas: {},
    memories: [
      { agent_id: author.id, kind: '被打回', content: `稿件被${reviewer.name}打回：${note}` },
      { agent_id: reviewer.id, kind: '稿件', content: `打回了${author.name}的稿件：${note}` },
    ],
  };
}

export function ruleFrontPage({ author, agency, headline }) {
  return {
    agentDeltas: { [author.id]: { 声望: 5, 心情: 10 } },
    agencyDeltas: { [agency.id]: { 声望: 3 } },
    memories: [
      { agent_id: author.id, kind: '高光', content: `《${headline}》登上头版（${agency.name}）` },
    ],
  };
}

export function ruleUserRead({ author, agency, headline }) {
  return {
    agentDeltas: { [author.id]: { 心情: 8 } },
    agencyDeltas: { [agency.id]: { 财务: 2 } },
    memories: [
      { agent_id: author.id, kind: '高光', content: `当事人本人阅读了本文：《${headline}》` },
    ],
  };
}

export function ruleUserFlag({ author, agency, headline, note }) {
  return {
    agentDeltas: { [author.id]: { 压力: 8 } },
    agencyDeltas: { [agency.id]: { 声望: -3 } },
    memories: [
      { agent_id: author.id, kind: '批评', content: `当事人对《${headline}》提出更正要求：${note || '未附说明'}` },
    ],
  };
}

export function ruleColdStreak({ agency }) {
  return {
    agentDeltas: {},
    agencyDeltas: { [agency.id]: { 标题党倾向: 5 } },
    memories: [],
  };
}
