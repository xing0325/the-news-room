// LLM 客户端：DeepSeek 主力，StepFun step-3.7-flash 兜底（必须 api.stepfun.ai，
// max_tokens ≥ 1400——推理与正文共享额度）。带调用预算保险丝：不是省 token，
// 是防 bug 死循环刷爆账单。

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const STEPFUN_URL = 'https://api.stepfun.ai/v1/chat/completions';

export function makeLLM({ deepseekKey, stepfunKey, budget = 45, fetchImpl = fetch, log = () => {} } = {}) {
  let remaining = budget;
  let used = 0;

  async function callProvider({ url, key, model, system, user, temperature, maxTokens }) {
    const body = {
      model,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: user },
      ],
      temperature,
      max_tokens: maxTokens,
    };
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${model} HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error(`${model} 返回空内容`);
    return content;
  }

  async function chat({ system, user, temperature = 0.8, maxTokens = 1600 }) {
    if (remaining <= 0) throw new Error('LLM_BUDGET_EXCEEDED');
    remaining -= 1;
    used += 1;
    try {
      return await callProvider({
        url: DEEPSEEK_URL, key: deepseekKey, model: 'deepseek-chat',
        system, user, temperature, maxTokens,
      });
    } catch (e) {
      if (!stepfunKey) throw e;
      log(`DeepSeek 翻车（${e.message}），StepFun 顶上`);
      return await callProvider({
        url: STEPFUN_URL, key: stepfunKey, model: 'step-3.7-flash',
        system, user, temperature, maxTokens: Math.max(maxTokens, 1400),
      });
    }
  }

  function extractJSON(text) {
    let t = text.trim();
    const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    if (fenced) t = fenced[1].trim();
    try { return JSON.parse(t); } catch { /* 继续挖 */ }
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1));
    throw new Error('输出中没有可解析的 JSON');
  }

  async function chatJSON({ system, user, temperature = 0.5, maxTokens = 1600, schemaHint = '' }) {
    const sys = [
      system || '',
      '你只输出一个合法 JSON 对象，不要任何解释、前后缀或代码围栏之外的文字。',
      schemaHint ? `JSON 结构：${schemaHint}` : '',
    ].filter(Boolean).join('\n\n');
    const first = await chat({ system: sys, user, temperature, maxTokens });
    try {
      return extractJSON(first);
    } catch (e) {
      const retry = await chat({
        system: sys,
        user: `${user}\n\n【注意：你上一次的输出无法解析为 JSON（${e.message}）。这次只输出 JSON 对象本身。】`,
        temperature: 0.2,
        maxTokens,
      });
      return extractJSON(retry);
    }
  }

  return { chat, chatJSON, calls: () => used, remaining: () => remaining };
}
