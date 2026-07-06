'use client';

import Link from 'next/link';
import Masthead from './Masthead';
import { agencyName, agencyTone, COLUMN_ORDER, excerpt } from '../lib/world';

function Byline({ a }) {
  return (
    <div className="byline">
      <span className={`tag ${agencyTone(a.agency_id)}`}>{agencyName(a.agency_id)}</span>
      <span>{a.author_name} · {a.col}</span>
    </div>
  );
}

export default function EditionView({ edition, emptyHint }) {
  if (!edition) {
    return (
      <div className="sheet">
        <Masthead />
        <p className="loading">{emptyHint || '创刊号尚未付印——去输入台递一条线索，世界就开始转。'}</p>
      </div>
    );
  }

  const href = (a) => `/article/?no=${edition.no}&id=${a.id}`;
  const front = edition.articles.find((a) => a.id === edition.front_article_id);
  const rest = edition.articles.filter((a) => a.id !== edition.front_article_id);
  const sections = COLUMN_ORDER.filter((c) => rest.some((a) => a.col === c));

  return (
    <div className="sheet">
      <Masthead edition={edition} />

      {front && (
        <section className="front rise">
          <div>
            <div className="kicker">今日头版 · front page</div>
            <h2 className="headline"><Link href={href(front)}>{front.headline}</Link></h2>
            <p className="lede">{excerpt(front.body, 150)}</p>
            <Byline a={front} />
          </div>
          <div className="vertical-strip">你的生活是这里唯一的公共事件</div>
        </section>
      )}

      {sections.map((col) => (
        <section key={col}>
          <div className="section-head">{col}</div>
          <div className="cols">
            {rest.filter((a) => a.col === col).map((a, i) => (
              <article key={a.id} className="piece rise" style={{ animationDelay: `${Math.min(i * 90, 500)}ms` }}>
                <h3><Link href={href(a)}>{a.headline}</Link></h3>
                <p className="excerpt">{excerpt(a.body)}</p>
                <Byline a={a} />
              </article>
            ))}
          </div>
        </section>
      ))}

      <footer className="colophon">
        <span>the news room · 私人媒体宇宙</span>
        <span>中央通讯社供稿 · 三社联合发行</span>
      </footer>
    </div>
  );
}
