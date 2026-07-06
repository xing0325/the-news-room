'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Masthead from '../../components/Masthead';
import { api } from '../../lib/api';
import { fmtDate } from '../../lib/world';

export default function Archive() {
  const [index, setIndex] = useState(null);

  useEffect(() => {
    api.get('/api/feed?no=latest').then((d) => setIndex(d.index || []));
  }, []);

  return (
    <div className="sheet">
      <Masthead />
      <div className="desk-block">
        <h2>往期合订本</h2>
        <p className="desk-hint">每一期都进档案馆，一期都不会少。</p>
        {!index && <p className="loading">搬合订本……</p>}
        {index && index.length === 0 && <p className="loading">还没有任何一期。</p>}
        {index && [...index].reverse().map((e) => (
          <div className="board-row" key={e.no}>
            <Link href={`/edition/?no=${e.no}`}>
              <b>第 {e.no} 期 · {e.label}</b>　{e.front_headline}
            </Link>
            <span className="nums">{fmtDate(e.published_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
