'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (r.ok) {
        router.push('/');
        router.refresh();
      } else {
        const d = await r.json().catch(() => ({}));
        setError(d.error || 'Incorrect password');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="container" style={{ maxWidth: 380, paddingTop: 120 }}>
      <h1 style={{ fontSize: 26, letterSpacing: '-0.5px' }}>mehdi</h1>
      <p className="muted">Enter your password to continue.</p>
      <form onSubmit={submit} className="card" style={{ marginTop: 20 }}>
        <input
          type="password"
          autoFocus
          value={password}
          placeholder="Password"
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: '100%',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 14,
          }}
        />
        <button className="btn" disabled={busy} style={{ width: '100%', marginTop: 12 }}>
          {busy ? 'Checking…' : 'Sign in'}
        </button>
        {error && <p className="muted" style={{ color: 'var(--high)', marginTop: 10 }}>{error}</p>}
      </form>
    </main>
  );
}
