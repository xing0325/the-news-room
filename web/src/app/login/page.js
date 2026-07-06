'use client';

import { useState } from 'react';
import { api } from '../../lib/api';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/api/login', { password });
      window.location.href = '/';
    } catch (err) {
      setError(err.message === 'unauthorized' ? '口令不对。' : err.message);
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <h1>the news room</h1>
        <div className="sub">本报只对一位读者发行</div>
        <form onSubmit={submit}>
          <input
            type="password"
            placeholder="读者口令"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {error && <div className="gate-error">{error}</div>}
          <button className="stamp red" disabled={busy || !password}>
            {busy ? '核验中……' : '亮明身份'}
          </button>
        </form>
      </div>
    </div>
  );
}
