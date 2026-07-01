'use client';

import { useCallback, useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';

type Check = { name: string; status: 'pass' | 'warn' | 'fail'; note: string };

export default function HealthPage() {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    const d = await fetch('/api/health').then((r) => r.json());
    setChecks(d.checks || []);
    setOk(d.ok);
    setLoading(false);
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <main className="container">
      <Nav />
      <header>
        <div className="row">
          <h1>Health check</h1>
          <button className="btn ghost" onClick={run} disabled={loading}>
            {loading ? 'Checking…' : 'Re-run'}
          </button>
        </div>
        <p className="muted">
          {ok === null ? 'Running pre-flight…' : ok ? 'All systems go — nothing blocking.' : 'Some checks failed — see below.'}
        </p>
      </header>

      <section className="card">
        {!checks && <p className="muted">Loading…</p>}
        {checks?.map((c) => (
          <div className="health" key={c.name}>
            <span className={`dot ${c.status}`} />
            <span className="hname">{c.name}</span>
            <span className="hnote">{c.note}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
