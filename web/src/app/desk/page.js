'use client';

import { useEffect, useState } from 'react';
import Masthead from '../../components/Masthead';
import { api } from '../../lib/api';

export default function Desk() {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [answers, setAnswers] = useState({});

  const load = () => api.get('/api/desk').then(setData).catch(() => setData({ interviews: [], events: [] }));
  useEffect(() => { load(); }, []);

  async function submitDiary() {
    setBusy(true);
    try {
      await api.post('/api/submit', { type: 'diary', raw_text: draft });
      setDraft('');
      setSent(true);
      setTimeout(() => setSent(false), 4000);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function answer(q) {
    const text = (answers[q.id] || '').trim();
    if (!text) return;
    await api.post('/api/submit', {
      type: 'interview_answer',
      raw_text: text,
      question_id: q.id,
      question_text: q.question,
      asked_by_name: q.asked_by_name,
    });
    setAnswers((s) => ({ ...s, [q.id]: '' }));
    load();
  }

  return (
    <div className="sheet">
      <Masthead />
      <div className="desk-block">
        <h2>递线索</h2>
        <p className="desk-hint">写下任何事——一顿外卖、一个念头、一次崩溃。截稿前递交的线索进下一期；三家报社会抢它。</p>
        <textarea
          placeholder="今天……"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '12px 0 8px' }}>
          <button className="stamp red" onClick={submitDiary} disabled={busy || !draft.trim()}>
            {busy ? '递交中……' : '递交线索'}
          </button>
          {sent && <span className="read-seal">已进通稿池，下期见报</span>}
        </div>

        <div className="section-head" style={{ marginTop: 40 }}>记者来访</div>
        <p className="desk-hint">他们带着问题来敲门。回答会成为下一期的专访素材；不理他们，他们会写「多次联系当事人未获回应」。</p>
        {!data && <p className="loading">看看门口有没有记者……</p>}
        {data && data.interviews.length === 0 && (
          <p className="desk-hint" style={{ padding: '10px 0' }}>门口暂时没有记者蹲守。出一期报纸后会有人来约稿。</p>
        )}
        {data && data.interviews.map((q) => (
          <div className="interview-card" key={q.id}>
            <div className="asker">{q.asked_by_name} · 采访邀请 · 第 {q.edition_no} 期发出</div>
            <div className="q">{q.question}</div>
            <textarea
              style={{ minHeight: 90 }}
              placeholder="答（也可以不答，让他们等着）"
              value={answers[q.id] || ''}
              onChange={(e) => setAnswers((s) => ({ ...s, [q.id]: e.target.value }))}
            />
            <div style={{ marginTop: 10 }}>
              <button className="stamp" onClick={() => answer(q)} disabled={!(answers[q.id] || '').trim()}>接受采访</button>
            </div>
          </div>
        ))}

        <div className="section-head" style={{ marginTop: 40 }}>我的事件流</div>
        {data && data.events.length === 0 && <p className="desk-hint">还没有任何线索。上面那个框在等你。</p>}
        {data && data.events.map((e) => (
          <div className="event-row" key={e.id}>
            <div className="raw">{e.raw_text}</div>
            {e.legacy_note && <div className="legacy">{e.legacy_note}</div>}
            <div className="meta">
              {new Date(e.created_at).toLocaleString('zh-CN')} · {e.processed ? `第 ${e.processed} 期已报道` : '待下期处理'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
