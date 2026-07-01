'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Nav } from '@/components/Nav';
import { TrendBars } from '@/components/charts';

const fmt = (a: number) => `${a < 0 ? '+' : '-'}$${Math.abs(a).toFixed(2)}`;
const pretty = (c: string) => c.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase());

function Detail({ m }: { m: string }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    setD(null);
    fetch(`/api/merchants?m=${encodeURIComponent(m)}`).then((r) => r.json()).then(setD);
  }, [m]);

  return (
    <>
      <div style={{ marginTop: 8 }}>
        <Link href="/merchants" className="btn ghost">← All merchants</Link>
      </div>
      {!d && <p className="muted" style={{ marginTop: 16 }}>Loading…</p>}
      {d && (
        <>
          <header>
            <h1>{d.display_name}</h1>
            <p className="muted">
              ${Number(d.total).toFixed(0)} total · {d.count} charges · avg ${Number(d.avg).toFixed(2)} · range ${Number(d.min).toFixed(2)}–${Number(d.max).toFixed(2)}
            </p>
          </header>
          {d.subscription && (
            <div className="banner" style={{ borderColor: 'var(--accent)' }}>
              Recurring {d.subscription.frequency} · ${Number(d.subscription.avg_amount).toFixed(2)}/charge · ${Number(d.subscription.annual_cost).toFixed(0)}/yr · next {d.subscription.expected_next}
            </div>
          )}
          <section className="card">
            <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>Monthly</h2>
            <TrendBars data={d.monthly || []} />
          </section>
          <section className="card">
            <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Transactions</h2>
            <table className="txns">
              <thead>
                <tr><th>Date</th><th>Category</th><th className="r">Amount</th></tr>
              </thead>
              <tbody>
                {d.transactions?.map((t: any, i: number) => (
                  <tr key={i}>
                    <td>{t.date}{t.pending ? ' (pending)' : ''}</td>
                    <td><span className="tag">{pretty(t.category)}</span></td>
                    <td className="r">{fmt(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  );
}

function List() {
  const [d, setD] = useState<any>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    fetch('/api/merchants').then((r) => r.json()).then(setD);
  }, []);
  const merchants = (d?.merchants || []).filter((x: any) =>
    q ? x.display_name.toLowerCase().includes(q.toLowerCase()) : true,
  );
  return (
    <>
      <header>
        <h1>Merchants</h1>
        <p className="muted">Where your money goes, by merchant.</p>
      </header>
      <div className="filters">
        <input className="filter-input" placeholder="Search merchant…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <section className="card">
        {!d && <p className="muted">Loading…</p>}
        {d && merchants.length === 0 && <p className="muted">No merchants match.</p>}
        {merchants.map((x: any) => (
          <Link href={`/merchants?m=${encodeURIComponent(x.merchant)}`} key={x.merchant} className="sub" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div>
              <div className="name">{x.display_name}{x.isSubscription ? ' 🔁' : ''}</div>
              <div className="meta">{x.count} charges · last {x.last}</div>
            </div>
            <div className="cost" style={{ fontWeight: 700 }}>${x.total.toFixed(0)}</div>
          </Link>
        ))}
      </section>
    </>
  );
}

function MerchantsInner() {
  const m = useSearchParams().get('m');
  return m ? <Detail m={m} /> : <List />;
}

export default function MerchantsPage() {
  return (
    <main className="container">
      <Nav />
      <Suspense fallback={<p className="muted" style={{ marginTop: 16 }}>Loading…</p>}>
        <MerchantsInner />
      </Suspense>
    </main>
  );
}
