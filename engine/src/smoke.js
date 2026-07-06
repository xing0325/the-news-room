// 实弹冒烟：内存 store + 真实 DeepSeek，本地出一期完整报纸，
// 把结果渲染成 markdown 供人工审稿（prompt 调优的工作台）。
// 用法：node --env-file=.env src/smoke.js [输出md路径] ["日记内容"...]
import { writeFileSync } from 'node:fs';
import { makeLLM } from './llm.js';
import { runEdition } from './pipeline.js';
import { seed } from './seed.js';

function memStore() {
  const data = new Map();
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

const outPath = process.argv[2] || 'smoke-edition.md';
const diaries = process.argv.slice(3).length
  ? process.argv.slice(3)
  : ['今天把《the news room》的设计稿定稿了，决定用三家报社互相竞争的方式来模拟一个只报道我的新闻世界。顺便发现 Supabase 在国内被墙，折腾了一下午换了方案。'];

const store = memStore();
await seed(store, { force: true });
diaries.forEach((raw, i) => {
  store.data.set(`events/smoke-${i}.json`, {
    id: `smoke-${i}`, type: 'diary', raw_text: raw,
    processed: false, created_at: new Date().toISOString(),
  });
});

const llm = makeLLM({
  deepseekKey: process.env.DEEPSEEK_API_KEY,
  stepfunKey: process.env.STEPFUN_API_KEY,
  budget: 45,
  log: (m) => console.error(`[llm] ${m}`),
});

console.error('开始出刊（真实 LLM，约 1-3 分钟）……');
const t0 = Date.now();
const summary = await runEdition({ store, llm, label: '冒烟特刊' });
const edition = await store.get(`editions/${summary.no}.json`);
const agents = await store.get('state/agents.json');
const interviews = await store.get('state/interviews.json');
const events = [];
for (const k of await store.list('events/')) events.push(await store.get(k));

let md = `# the news room · 冒烟特刊（第 ${edition.no} 期）\n\n`;
md += `> ${summary.calls} 次 LLM 调用 · ${((Date.now() - t0) / 1000).toFixed(0)}s\n\n`;
const front = edition.articles.find((a) => a.id === edition.front_article_id);
if (front) md += `## 【头版】${front.headline}\n\n_${front.author_name}（${front.agency_id}）· ${front.col}_\n\n${front.body}\n\n---\n\n`;
for (const a of edition.articles) {
  if (a.id === edition.front_article_id) continue;
  md += `## ${a.headline}\n\n_${a.author_name}（${a.agency_id}）· ${a.col}_${a.review_note ? ` · 审稿：${a.review_note}` : ''}\n\n${a.body}\n\n---\n\n`;
}
md += `# 编辑部后台\n\n`;
for (const m of edition.meetings) md += `## 选题会 · ${m.agency_id}\n\n${m.transcript}\n\n`;
md += `## 编辑部内部日志\n\n${edition.backstage}\n\n`;
md += `## 世界状态流水\n\n${edition.world_log.map((l) => `- ${l}`).join('\n')}\n\n`;
md += `## 职员状态\n\n${agents.map((a) => `- ${a.name}：${JSON.stringify(a.state).replaceAll('"', '')}`).join('\n')}\n\n`;
md += `## 待答采访\n\n${interviews.map((q) => `- ${q.asked_by_name}：${q.question}`).join('\n')}\n\n`;
md += `## 传记预览\n\n${events.filter((e) => e.legacy_note).map((e) => `- ${e.legacy_note}`).join('\n')}\n`;

writeFileSync(outPath, md, 'utf-8');
console.log(`冒烟完成：第 ${summary.no} 期，${summary.articles} 篇，${summary.calls} 次调用 → ${outPath}`);
