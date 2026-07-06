'use client';

import { useEffect, useState } from 'react';
import EditionView from '../components/EditionView';
import { api } from '../lib/api';

export default function Home() {
  const [state, setState] = useState({ loading: true, edition: null });

  useEffect(() => {
    api.get('/api/feed?no=latest')
      .then((d) => setState({ loading: false, edition: d.edition }))
      .catch(() => setState({ loading: false, edition: null }));
  }, []);

  if (state.loading) return <p className="loading">正在送报……</p>;
  return <EditionView edition={state.edition} />;
}
