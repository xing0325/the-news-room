'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import EditionView from '../../components/EditionView';
import { api } from '../../lib/api';

function EditionInner() {
  const params = useSearchParams();
  const no = params.get('no') || 'latest';
  const [state, setState] = useState({ loading: true, edition: null });

  useEffect(() => {
    api.get(`/api/feed?no=${no}`)
      .then((d) => setState({ loading: false, edition: d.edition }))
      .catch(() => setState({ loading: false, edition: null }));
  }, [no]);

  if (state.loading) return <p className="loading">翻找合订本……</p>;
  return <EditionView edition={state.edition} emptyHint="没有这一期。" />;
}

export default function EditionPage() {
  return (
    <Suspense fallback={<p className="loading">翻找合订本……</p>}>
      <EditionInner />
    </Suspense>
  );
}
