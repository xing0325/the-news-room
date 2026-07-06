// 刊期入口：GitHub Actions cron 调用。cron 即刊期。
// 23:30 UTC = 北京 07:30 → 早刊；11:30 UTC = 北京 19:30 → 晚刊。
import { worldStore } from './store.js';
import { makeLLM } from './llm.js';
import { runEdition } from './pipeline.js';

const utcHour = new Date().getUTCHours();
const label = process.env.EDITION_LABEL && process.env.EDITION_LABEL !== 'auto'
  ? process.env.EDITION_LABEL
  : utcHour >= 18 || utcHour < 6 ? '早刊' : '晚刊';

const store = worldStore();
const llm = makeLLM({
  deepseekKey: process.env.DEEPSEEK_API_KEY,
  stepfunKey: process.env.STEPFUN_API_KEY,
  budget: Number(process.env.LLM_BUDGET || 45),
  log: (m) => console.error(`[llm] ${m}`),
});

try {
  const s = await runEdition({ store, llm, label });
  console.log(`第 ${s.no} 期（${s.label}）出刊：${s.articles} 篇文章，${s.calls} 次 LLM 调用。`);
} catch (e) {
  console.error('出刊失败：', e.message);
  process.exit(1);
}
