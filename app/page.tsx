'use client';

import { useCallback, useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';
import { LinkButton } from '@/components/LinkButton';
import { TransactionsList, type Txn } from '@/components/TransactionsList';

type Summary = {
  configured: boolean;
  transactions?: number;
  accounts?: number;
  subscriptions?: number;
  monthlySubscriptionCost?: number;
  newInsights?: number;
  lastCompleteMonth?: string;
  lastMonthSpend?: number;
};

export default function Home() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string>('');

  const load = useCallback(async () => {
    const [s, t] = await Promise.all([
      fetch('/api/summary').then((r) => r.json()),
      fetch('/api/plaid/transactions').then((r) => r.json()),
    ]);
    setSummary(s);
    setTxns(t.transactions || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = useCallback(
    async (label: string, url: string) => {
      setBusy(label);
      setNote('');
      try {
        const r = await fetch(url, { method: 'POST' });
        const d = await r.json();
        if (d.error) setNote(d.error);
        else if (label === 'sync') setNote(`Synced: +${d.added} new, ${d.modified} updated.`);
        else if (label === 'analyze')
          setNote(`Analyzed ${d.transactions} txns → ${d.streams} subscriptions, ${d.newInsights} new insights.`);
        await load();
      } catch (e: any) {
        setNote(e?.message || 'Failed');
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  const configured = summary?.configured;
  const hasData = (summary?.transactions ?? 0) > 0;

  return (
    <main className="container">
      <Nav />

      {summary && !configured && (
        <div className="banner">
          Supabase isn&apos;t configured yet. Add <code>SUPABASE_URL</code> to{' '}
          <code>.env.local</code> and apply <code>supabase/migrations/0001_init.sql</code> in the
          Supabase SQL editor, then restart <code>npm run dev</code>.
        </div>
      )}

      <header>
        <h1>Dashboard</h1>
        <p className="muted">Your spending at a glance.</p>
      </header>

      <div className="grid">
        <div className="stat">
          <div className="label">Spent ({summary?.lastCompleteMonth ?? '—'})</div>
          <div className="value">${(summary?.lastMonthSpend ?? 0).toFixed(0)}</div>
        </div>
        <div className="stat">
          <div className="label">Subscriptions</div>
          <div className="value">{summary?.subscriptions ?? 0}</div>
        </div>
        <div className="stat">
          <div className="label">Subs / month</div>
          <div className="value">${(summary?.monthlySubscriptionCost ?? 0).toFixed(0)}</div>
        </div>
        <div className="stat">
          <div className="label">New insights</div>
          <div className="value">{summary?.newInsights ?? 0}</div>
        </div>
      </div>

      <section className="card">
        <div className="row">
          <h2>Accounts &amp; data</h2>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          {hasData
            ? `${summary?.accounts ?? 0} account(s), ${summary?.transactions ?? 0} transactions.`
            : 'No account linked yet. In Plaid Link pick any bank and sign in with user_good / pass_good.'}
        </p>
        <div className="actions">
          <LinkButton onLinked={load} />
          <button className="btn ghost" disabled={!!busy} onClick={() => run('sync', '/api/plaid/sync')}>
            {busy === 'sync' ? 'Syncing…' : 'Sync now'}
          </button>
          <button className="btn ghost" disabled={!!busy} onClick={() => run('analyze', '/api/analyze')}>
            {busy === 'analyze' ? 'Analyzing…' : 'Run analysis'}
          </button>
        </div>
        {note && <p className="muted" style={{ marginTop: 10 }}>{note}</p>}
      </section>

      {hasData && (
        <section className="card">
          <div className="row">
            <h2>Recent transactions</h2>
            <button className="btn ghost" onClick={load}>Refresh</button>
          </div>
          <TransactionsList txns={txns} />
        </section>
      )}
    </main>
  );
}
