import { describe, it, expect } from 'vitest';
import {
  clamp, applyDeltas, decay,
  ruleRejected, ruleFrontPage, ruleUserRead, ruleUserFlag, ruleColdStreak,
} from '../src/world.js';

const 沈望 = { id: 'shenwang', name: '沈望' };
const 贺真 = { id: 'hezhen', name: '贺真' };
const 日报 = { id: 'daily', name: '用户日报' };

describe('数值工具', () => {
  it('clamp 限制在 0-100', () => {
    expect(clamp(120)).toBe(100);
    expect(clamp(-5)).toBe(0);
    expect(clamp(55)).toBe(55);
  });

  it('applyDeltas 叠加并 clamp', () => {
    const s = applyDeltas({ 压力: 95, 自信: 10 }, { 压力: 10, 自信: -20 });
    expect(s).toEqual({ 压力: 100, 自信: 0 });
  });

  it('decay 让压力向 50 回归 5 点，不越过', () => {
    expect(decay({ 压力: 80 }).压力).toBe(75);
    expect(decay({ 压力: 30 }).压力).toBe(35);
    expect(decay({ 压力: 52 }).压力).toBe(50);
    expect(decay({ 压力: 50 }).压力).toBe(50);
  });
});

describe('状态规则', () => {
  it('打回：作者压力+10 自信-5，核查员声望+2，双方记忆', () => {
    const r = ruleRejected({ author: 沈望, reviewer: 贺真, note: '无证据断言' });
    expect(r.agentDeltas.shenwang).toEqual({ 压力: 10, 自信: -5 });
    expect(r.agentDeltas.hezhen).toEqual({ 声望: 2 });
    expect(r.memories).toHaveLength(2);
    expect(r.memories[0]).toMatchObject({ agent_id: 'shenwang', kind: '被打回' });
    expect(r.memories[0].content).toContain('贺真');
  });

  it('头版：作者声望+5 心情+10，报社声望+3，高光记忆', () => {
    const r = ruleFrontPage({ author: 沈望, agency: 日报, headline: 'XX' });
    expect(r.agentDeltas.shenwang).toEqual({ 声望: 5, 心情: 10 });
    expect(r.agencyDeltas.daily).toEqual({ 声望: 3 });
    expect(r.memories[0].kind).toBe('高光');
  });

  it('当事人阅读：作者心情+8，报社财务+2，记忆写明当事人本人', () => {
    const r = ruleUserRead({ author: 沈望, agency: 日报, headline: 'XX' });
    expect(r.agentDeltas.shenwang).toEqual({ 心情: 8 });
    expect(r.agencyDeltas.daily).toEqual({ 财务: 2 });
    expect(r.memories[0].content).toContain('当事人本人阅读了本文');
  });

  it('这不准：报社声望-3，作者压力+8，批评记忆', () => {
    const r = ruleUserFlag({ author: 沈望, agency: 日报, headline: 'XX', note: '我没说过' });
    expect(r.agencyDeltas.daily).toEqual({ 声望: -3 });
    expect(r.agentDeltas.shenwang).toEqual({ 压力: 8 });
    expect(r.memories[0].kind).toBe('批评');
  });

  it('连续零阅读：标题党倾向+5', () => {
    const r = ruleColdStreak({ agency: 日报 });
    expect(r.agencyDeltas.daily).toEqual({ 标题党倾向: 5 });
  });
});
