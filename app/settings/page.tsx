'use client';

import { useCallback, useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';

type Status = {
  supabase: boolean;
  plaidEnv: string;
  advisor: boolean;
  encryption: boolean;
  email: boolean;
  authGate: boolean;
  transactions: number;
  accounts: number;
  items: number;
};

function Row({ label, ok, note }: { label: string; ok: boolean; note?: string }) {
  return (
    <div className="sub">
      <div>
        <span className="name">{label}</span>
        {note && <div className="meta">{note}</div>}
      </div>
      <div className="cost">
        <span className={`sev ${ok ? 'info' : 'warn'}`} style={{ background: ok ? 'rgba(63,185,80,0.15)' : undefined, color: ok ? 'var(--good)' : 'var(--warn)' }}>
          {ok ? 'on' : 'off'}
        </span>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [s, setS] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState('');

  const load = useCallback(async () => {
    setS(await fetch('/api/settings').then((r) => r.json()));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const clearAll = async () => {
    setBusy(true);
    await fetch('/api/settings', { method: 'DELETE' });
    setConfirm('');
    setBusy(false);
    load();
  };

  return (
    <main className="container">
      <Nav />
      <header>
        <h1>Settings</h1>
        <p className="muted">Configuration status and data controls.</p>
      </header>

      <section className="card">
        <h2 style={{ margin: '0 0 6px', fontSize: 16 }}>Status</h2>
        {s && (
          <>
            <Row label="Supabase" ok={s.supabase} />
            <Row label="Advisor (Claude Code)" ok={s.advisor} />
            <Row label="Token encryption" ok={s.encryption} note={s.encryption ? undefined : 'Set TOKEN_ENC_KEY before real accounts'} />
            <Row label="Password gate" ok={s.authGate} />
            <Row label="Email alerts" ok={s.email} note={s.email ? undefined : 'Optional — set RESEND_API_KEY'} />
            <div className="sub">
              <div><span className="name">Plaid environment</span></div>
              <div className="cost"><span className="tag">{s.plaidEnv}</span></div>
            </div>
            <div className="sub">
              <div><span className="name">Data</span></div>
              <div className="cost meta">{s.accounts} accounts · {s.transactions} transactions · {s.items} items</div>
            </div>
          </>
        )}
      </section>

      <section className="card" style={{ borderColor: 'var(--high)' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 16, color: 'var(--high)' }}>Danger zone</h2>
        <p className="muted">
          Clear all data — removes every transaction, subscription, insight, budget, goal, and
          revokes linked Plaid items. Use this to wipe demo data before linking real accounts. This
          cannot be undone.
        </p>
        <div className="filters" style={{ marginTop: 12 }}>
          <input
            className="filter-input"
            placeholder="Type DELETE to confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <button
            className="btn"
            style={{ background: 'var(--high)' }}
            disabled={confirm !== 'DELETE' || busy}
            onClick={clearAll}
          >
            {busy ? 'Clearing…' : 'Clear all data'}
          </button>
        </div>
      </section>
    </main>
  );
}
