import { describe, it, expect, vi } from 'vitest';
import { makeLLM } from '../src/llm.js';

const ok = (content) => ({ status: 200, body: { choices: [{ message: { content } }] } });

function mockFetch(responses) {
  const calls = [];
  const fn = vi.fn(async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) });
    const r = responses[Math.min(calls.length - 1, responses.length - 1)];
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      text: async () => (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)),
      json: async () => r.body,
    };
  });
  fn.mem = calls;
  return fn;
}

describe('makeLLM', () => {
  it('预算耗尽时抛 LLM_BUDGET_EXCEEDED', async () => {
    const f = mockFetch([ok('hi')]);
    const llm = makeLLM({ deepseekKey: 'k', budget: 1, fetchImpl: f });
    await llm.chat({ user: 'a' });
    await expect(llm.chat({ user: 'b' })).rejects.toThrow('LLM_BUDGET_EXCEEDED');
  });

  it('DeepSeek 5xx 时兜底到 StepFun，max_tokens 至少 1400', async () => {
    const f = mockFetch([{ status: 500, body: 'boom' }, ok('rescued')]);
    const llm = makeLLM({ deepseekKey: 'k1', stepfunKey: 'k2', fetchImpl: f });
    const out = await llm.chat({ user: 'x', maxTokens: 800 });
    expect(out).toBe('rescued');
    expect(f.mem[1].url).toContain('api.stepfun.ai');
    expect(f.mem[1].body.max_tokens).toBeGreaterThanOrEqual(1400);
    expect(f.mem[1].body.model).toBe('step-3.7-flash');
  });

  it('chatJSON 剥掉 ```json 围栏并解析', async () => {
    const f = mockFetch([ok('```json\n{"a":1}\n```')]);
    const llm = makeLLM({ deepseekKey: 'k', fetchImpl: f });
    const out = await llm.chatJSON({ user: 'x' });
    expect(out).toEqual({ a: 1 });
  });

  it('首次坏 JSON 时带错误提示重试一次', async () => {
    const f = mockFetch([ok('我觉得这个问题很好，让我想想'), ok('{"b":2}')]);
    const llm = makeLLM({ deepseekKey: 'k', fetchImpl: f });
    const out = await llm.chatJSON({ user: 'x' });
    expect(out).toEqual({ b: 2 });
    expect(f.mem).toHaveLength(2);
    expect(f.mem[1].body.messages.at(-1).content).toContain('JSON');
  });

  it('calls() 记录用量', async () => {
    const f = mockFetch([ok('1')]);
    const llm = makeLLM({ deepseekKey: 'k', budget: 10, fetchImpl: f });
    await llm.chat({ user: 'a' });
    expect(llm.calls()).toBe(1);
  });
});
