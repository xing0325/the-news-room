'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Masthead from '../../components/Masthead';
import { api } from '../../lib/api';
import { agencyName, agencyTone } from '../../lib/world';

function ArticleInner() {
  const params = useSearchParams();
  const no = params.get('no');
  const id = params.get('id');
  const [data, setData] = useState(null);
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagNote, setFlagNote] = useState('');
  const [flagged, setFlagged] = useState(false);
  const [justRead, setJustRead] = useState(false);

  useEffect(() => {
    if (!no) return;
    api.get(`/api/feed?no=${no}`).then((d) => setData(d));
  }, [no]);

  const article = data?.edition?.articles?.find((a) => a.id === id);

  // 打开即"当事人已阅"——记者职业生涯的高光时刻（每篇只记一次）
  useEffect(() => {
    if (!article) return;
    const key = `read:${article.id}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    setJustRead(true);
    api.post('/api/action', {
      type: 'read',
      article_id: article.id,
      edition_no: data.edition.no,
      agency_id: article.agency_id,
      author_agent_id: article.author_agent_id,
      headline: article.headline,
    }).catch(() => {});
  }, [article]);

  async function sendFlag() {
    await api.post('/api/action', {
      type: 'flag',
      article_id: article.id,
      edition_no: data.edition.no,
      agency_id: article.agency_id,
      author_agent_id: article.author_agent_id,
      headline: article.headline,
      note: flagNote,
    });
    setFlagged(true);
    setFlagOpen(false);
  }

  if (!data) return <p className="loading">检索档案……</p>;
  if (!article) {
    return (
      <div className="sheet">
        <Masthead edition={data?.edition} />
        <p className="loading">这篇文章不存在——也许被总编辑毙掉了。</p>
      </div>
    );
  }

  const paragraphs = article.body.split(/\n+/).filter(Boolean);

  return (
    <div className="sheet">
      <Masthead edition={data.edition} />
      <div className="article-page">
        <div className="kicker">{article.col} · {agencyName(article.agency_id)}</div>
        <h1>{article.headline}</h1>
        <div className="byline">
          <span className={`tag ${agencyTone(article.agency_id)}`}>{agencyName(article.agency_id)}</span>
          <span>{article.author_name} 撰稿</span>
          {(justRead || localStorage.getItem(`read:${article.id}`)) && <span className="read-seal">当事人已阅</span>}
        </div>

        <div className="article-body">
          {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        </div>

        {article.fact_refs?.length > 0 && (
          <div className="facts">
            <div className="facts-title">事实层 · 本文可溯源的全部事实</div>
            {article.fact_refs.map((rid) => (
              <blockquote key={rid}>{article.facts?.[rid] || rid}</blockquote>
            ))}
            <div className="note">事实层之外的一切表述，均为该报及其记者的阐释与立场。</div>
          </div>
        )}

        {article.review_note && <div className="review-note">审稿记录：{article.review_note}</div>}

        <div style={{ display: 'flex', gap: 12, margin: '30px 0', flexWrap: 'wrap' }}>
          {!flagged && !flagOpen && (
            <button className="stamp red" onClick={() => setFlagOpen(true)}>这不准</button>
          )}
          {flagged && <span className="read-seal">更正要求已递交，下期见报</span>}
          <Link href={`/edition/?no=${data.edition.no}`}><button className="stamp">回到本期</button></Link>
        </div>

        {flagOpen && (
          <div style={{ margin: '10px 0 40px' }}>
            <textarea
              placeholder="哪里不准？一句话即可——下一期该报将刊登更正声明，相关记者会挨骂。"
              value={flagNote}
              onChange={(e) => setFlagNote(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <button className="stamp red" onClick={sendFlag} disabled={!flagNote.trim()}>递交更正要求</button>
              <button className="stamp" onClick={() => setFlagOpen(false)}>算了</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ArticlePage() {
  return (
    <Suspense fallback={<p className="loading">检索档案……</p>}>
      <ArticleInner />
    </Suspense>
  );
}
