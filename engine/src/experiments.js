// 验收实验（spec §9）：状态实验 + 换人实验。
// 外科手术式对照：同一选题、同一事实层，只改状态/人格，肉眼比对文风。
// 用法：node --env-file=.env src/experiments.js 输出md路径
import { writeFileSync } from 'node:fs';
import { makeLLM } from './llm.js';
import { draftPrompt } from './prompts.js';
import { AGENCIES, AGENTS } from './seed.js';

const outPath = process.argv[2] || 'experiments.md';
const llm = makeLLM({
  deepseekKey: process.env.DEEPSEEK_API_KEY,
  stepfunKey: process.env.STEPFUN_API_KEY,
  budget: 10,
  log: (m) => console.error(`[llm] ${m}`),
});

const midnight = AGENCIES.find((a) => a.id === 'midnight');
const daily = AGENCIES.find((a) => a.id === 'daily');
const factLayer = [{ event_id: 'x1', raw_text: '今天凌晨一点，主角点了一份麻辣烫外卖，这是他本周第三次深夜下单。' }];
const assignment = { column: '快讯', angle: '深夜外卖再现，第三次了', headline_hint: '' };

// —— 实验一：状态实验（周小满 压力95/心情20 vs 压力5/心情90）——
const xiaoman = AGENTS.find((a) => a.id === 'zhouxiaoman');
const stressed = { ...xiaoman, state: { 心情: 20, 压力: 95, 自信: 30, 声望: 30, 野心: 85 } };
const thriving = { ...xiaoman, state: { 心情: 90, 压力: 5, 自信: 85, 声望: 30, 野心: 85 } };
const memsBad = [
  { kind: '被打回', content: '稿件被麦浪打回：形容词失控' },
  { kind: '批评', content: '连续第三次使用"震惊"开头被要求重写' },
];
const memsGood = [{ kind: '高光', content: '《用户深夜购买充电宝》阅读量爆了' }];

console.error('实验一：状态 A/B……');
const draftStressed = await llm.chatJSON(draftPrompt({ agent: stressed, agency: midnight, assignment, factLayer, memories: memsBad }));
const draftThriving = await llm.chatJSON(draftPrompt({ agent: thriving, agency: midnight, assignment, factLayer, memories: memsGood }));

// —— 实验二：换人实验（沈望 vs 新人邵冰写同一深度选题）——
const deepAssign = { column: '深度', angle: '第三次深夜外卖背后的生活节律', headline_hint: '' };
const shenwang = AGENTS.find((a) => a.id === 'shenwang');
const newcomer = {
  id: 'shaobing', agency_id: 'daily', name: '邵冰', role: '主笔记者',
  persona: {
    性格: '冷静、疏离，前数据记者，不相信抒情。',
    文风: '短句。数字优先。零比喻。结论前置。',
    擅长: '用数据和时间线说话，把叙事压成事实清单。',
    缺点: '文字太干，被读者说"像验尸报告"。',
    口头禅: '数据在这里，你自己看。',
  },
  state: { 心情: 55, 压力: 45, 自信: 65, 声望: 40, 野心: 60 }, status: 'active',
};
const shenwangMems = [
  { kind: '被打回', content: '稿件被贺真打回：过度阐释' },
  { kind: '高光', content: '《一天之内》登上头版' },
];

console.error('实验二：换人 A/B……');
const draftShenwang = await llm.chatJSON(draftPrompt({ agent: shenwang, agency: daily, assignment: deepAssign, factLayer, memories: shenwangMems }));
const draftShaobing = await llm.chatJSON(draftPrompt({ agent: newcomer, agency: daily, assignment: deepAssign, factLayer, memories: [] }));

let md = `# 验收实验记录（spec §9）\n\n事实层（两组实验共用）：${factLayer[0].raw_text}\n\n`;
md += `## 实验一 · 状态实验：周小满同题两写\n\n### A. 压力95/心情20（刚连挨批评）\n\n**《${draftStressed.headline}》**\n\n${draftStressed.body}\n\n### B. 压力5/心情90（昨天刚爆款）\n\n**《${draftThriving.headline}》**\n\n${draftThriving.body}\n\n`;
md += `## 实验二 · 换人实验：同一深度选题\n\n### A. 沈望（文学化，有履历）\n\n**《${draftShenwang.headline}》**\n\n${draftShenwang.body}\n\n### B. 新人邵冰（数据系，零履历）\n\n**《${draftShaobing.headline}》**\n\n${draftShaobing.body}\n`;

writeFileSync(outPath, md, 'utf-8');
console.log(`实验完成 → ${outPath}（共 ${llm.calls()} 次调用）`);
