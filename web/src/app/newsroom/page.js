'use client';

import { useEffect, useState } from 'react';
import Masthead from '../../components/Masthead';
import { api } from '../../lib/api';
import { agencyName, agencyTone } from '../../lib/world';

const STATE_KEYS = ['心情', '压力', '自信', '声望', '野心'];
const TABS = ['选题会', '内部日志', '职员档案', '榜单'];

export default function Newsroom() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('选题会');

  useEffect(() => { api.get('/api/newsroom').then(setData); }, []);

  async function toggleSub(agency) {
    const next = !agency.subscribed;
    await api.post('/api/action', { type: 'subscribe', agency_id: agency.id, value: next });
    setData((d) => ({
      ...d,
      agencies: d.agencies.map((a) => (a.id === agency.id ? { ...a, subscribed: next, _pending: true } : a)),
    }));
  }

  return (
    <div className="sheet">
      <Masthead />
      <div className="classified">内部资料 · 注意保存 · 当事人特许查阅</div>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {!data && <p className="loading">潜入编辑部……</p>}

      {data && tab === '选题会' && (
        <div>
          {[...data.editions].reverse().map((ed) => (
            <div key={ed.no}>
              <div className="section-head">第 {ed.no} 期 · {ed.label}</div>
              {ed.meetings.map((m) => (
                <div key={m.agency_id}>
                  <div className="kicker" style={{ marginTop: 14 }}>{agencyName(m.agency_id)} 选题会</div>
                  <div className="transcript">{m.transcript}</div>
                </div>
              ))}
            </div>
          ))}
          {data.editions.length === 0 && <p className="loading">还没开过会。</p>}
        </div>
      )}

      {data && tab === '内部日志' && (
        <div>
          {[...data.editions].reverse().map((ed) => (
            <div key={ed.no}>
              <div className="section-head">第 {ed.no} 期 · {ed.label}</div>
              <div className="transcript">{ed.backstage}</div>
              {ed.world_log?.length > 0 && (
                <p className="desk-hint">状态流水：{ed.world_log.join('；')}</p>
              )}
            </div>
          ))}
          {data.editions.length === 0 && <p className="loading">日志本还是空的。</p>}
        </div>
      )}

      {data && tab === '职员档案' && (
        <div className="agent-grid">
          {data.agents.map((a) => (
            <div className="agent-card" key={a.id}>
              <div className="name">{a.name}</div>
              <div className="role">{agencyName(a.agency_id)} · {a.role}{a.status !== 'active' ? ' · 已离职' : ''}</div>
              <div className="motto">"{a.persona?.口头禅}"</div>
              {STATE_KEYS.map((k) => (
                <div className="bar-row" key={k}>
                  <span>{k}</span>
                  <div className={`bar ${k === '压力' ? 'hot' : ''}`}><i style={{ width: `${a.state?.[k] ?? 50}%` }} /></div>
                  <span>{a.state?.[k] ?? 50}</span>
                </div>
              ))}
              {(data.memories?.[a.id] || []).length > 0 && (
                <div className="mem">
                  {data.memories[a.id].slice(0, 3).map((m, i) => (
                    <div key={i}>「{m.kind}」{m.content}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {data && tab === '榜单' && (
        <div>
          <div className="section-head">报社行情</div>
          {data.agencies.map((a) => (
            <div className="board-row" key={a.id}>
              <span>
                <span className={`tag ${agencyTone(a.id)}`}>{a.name}</span>
                　<i style={{ color: 'var(--ink-60)', fontSize: 13 }}>{a.charter}</i>
              </span>
              <span className="nums">
                声望 {a.state?.声望 ?? 50} · 财务 {a.state?.财务 ?? 50} · 标题党 {a.state?.标题党倾向 ?? 0}
                　<button className="stamp" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => toggleSub(a)}>
                  {a.subscribed ? '退订' : '订阅'}
                </button>
                {a._pending && <span style={{ color: 'var(--sepia)', marginLeft: 8 }}>下期结算</span>}
              </span>
            </div>
          ))}
          <p className="desk-hint" style={{ marginTop: 14 }}>
            你的每一次阅读都是他们的财务与士气。退订一家报社，它真的会衰落。
          </p>
        </div>
      )}
    </div>
  );
}
