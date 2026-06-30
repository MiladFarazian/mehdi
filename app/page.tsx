'use client';

import { useCallback, useEffect, useState } from 'react';
import { LinkButton } from '@/components/LinkButton';
import { TransactionsList, type Txn } from '@/components/TransactionsList';

export default function Home() {
  const [linked, setLinked] = useState(false);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/plaid/transactions');
      const d = await r.json();
      setLinked(Boolean(d.linked));
      setTxns(d.transactions || []);
      setNotReady(Boolean(d.notReady));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Sandbox can take a moment to generate transactions — poll until ready.
  useEffect(() => {
    if (!notReady) return;
    const t = setTimeout(load, 2500);
    return () => clearTimeout(t);
  }, [notReady, load]);

  return (
    <main className="container">
      <header>
        <h1>mehdi</h1>
        <p className="muted">Phase 0 — proving the Plaid → transactions loop (Sandbox)</p>
      </header>

      {!linked && (
        <section className="card">
          <p>
            No account linked yet. In Plaid Link, choose any bank and sign in with the
            sandbox credentials <code>user_good</code> / <code>pass_good</code>.
          </p>
          <LinkButton onLinked={load} />
        </section>
      )}

      {linked && (
        <section className="card">
          <div className="row">
            <h2>Recent transactions</h2>
            <button className="btn ghost" onClick={load}>Refresh</button>
          </div>
          {loading && <p className="muted">Loading…</p>}
          {!loading && notReady && (
            <p className="muted">Sandbox is generating transactions… retrying.</p>
          )}
          {!loading && !notReady && <TransactionsList txns={txns} />}
        </section>
      )}
    </main>
  );
}
