'use client';

import { useCallback, useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';
import { Logo } from '@/components/Logo';

type M = {
  merchant: string;
  display_name: string;
  logo_url: string | null;
  total: number;
  count: number;
  tag: 'business' | 'personal' | null;
  suggested: 'business' | null;
};
type Data = { configured: boolean; tableExists?: boolean; merchants?: M[] };

export default function BusinessPage() {
  const [d, setD] = useState<Data | null>(null);
  const [filter, setFilter] = useState<'all' | 'untagged' | 'business'>('all');

  const load = useCallback(async () => {
    setD(await fetch('/api/tags').then((r) => r.json()));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const tag = async (merchant: string, t: 'business' | 'personal') => {
    setD((prev) =>
      prev ? { ...prev, merchants: prev.merchants?.map((m) => (m.merchant === merchant ? { ...m, tag: t, suggested: null } : m)) } : prev,
    );
    await fetch('/api/tags', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ normalized_merchant: merchant, tag: t }),
    });
  };

  const merchants = (d?.merchants || []).filter((m) =>
    filter === 'untagged' ? !m.tag : filter === 'business' ? m.tag === 'business' : true,
  );
  const bizPerYr = (d?.merchants || [])
    .filter((m) => m.tag === 'business')
    .reduce((s, m) => s + m.total, 0);

  return (
    <main className="container">
      <Nav />
      <header>
        <h1>Business vs. personal</h1>
        <p className="muted">
          Tag merchants as Parkzy-business so they drop out of your personal burn. Suggested
          business tools are highlighted.
        </p>
      </header>

      {d && d.tableExists === false && (
        <div className="banner">
          Needs one migration. Paste <code>supabase/migrations/0005_merchant_tags.sql</code> into the
          Supabase SQL editor and run it, then reload.
        </div>
      )}

      {d?.tableExists && (
        <>
          {bizPerYr > 0 && (
            <div className="banner" style={{ borderColor: 'var(--accent)' }}>
              Tagged business so far: <strong>${bizPerYr.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>{' '}
              excluded from personal spend.
            </div>
          )}
          <div className="filters">
            {(['all', 'untagged', 'business'] as const).map((f) => (
              <button key={f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>
          <section className="card">
            {!d && <p className="muted">Loading…</p>}
            {merchants.map((m) => (
              <div className="sub" key={m.merchant}>
                <Logo url={m.logo_url} />
                <div>
                  <div className="name">
                    {m.display_name}
                    {m.suggested === 'business' && (
                      <span className="sev info" style={{ marginLeft: 8 }}>suggested: business</span>
                    )}
                  </div>
                  <div className="meta">${m.total.toFixed(0)} · {m.count} charges</div>
                </div>
                <div className="fb" style={{ marginLeft: 'auto' }}>
                  <button className={`chip ${m.tag === 'business' ? 'on' : ''}`} onClick={() => tag(m.merchant, 'business')}>
                    Business
                  </button>
                  <button className={`chip ${m.tag === 'personal' ? 'on' : ''}`} onClick={() => tag(m.merchant, 'personal')}>
                    Personal
                  </button>
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
