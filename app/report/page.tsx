'use client';

import { useCallback, useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';
import { BarList } from '@/components/charts';

const money = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const pretty = (c: string) => c.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase());

export default function ReportPage() {
  const [month, setMonth] = useState('');
  const [d, setD] = useState<any>(null);

  const load = useCallback(async (m?: string) => {
    const r = await fetch(`/api/report${m ? `?month=${m}` : ''}`).then((x) => x.json());
    setD(r);
    if (!month && r.month) setMonth(r.month);
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const pick = (m: string) => {
    setMonth(m);
    load(m);
  };

  return (
    <main className="container">
      <div className="noprint">
        <Nav />
      </div>

      <header>
        <div className="row">
          <h1>Monthly report</h1>
          <div className="noprint" style={{ display: 'flex', gap: 8 }}>
            {d?.availableMonths?.length > 0 && (
              <select className="filter-input" value={month} onChange={(e) => pick(e.target.value)}>
                {d.availableMonths.map((m: string) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}
            <button className="btn" onClick={() => window.print()}>Print / Save PDF</button>
          </div>
        </div>
        <p className="muted">{d?.month}</p>
      </header>

      {d?.configured && (
        <>
          <div className="grid">
            <div className="stat"><div className="label">Income</div><div className="value" style={{ color: 'var(--good)' }}>{money(d.income)}</div></div>
            <div className="stat"><div className="label">Spent</div><div className="value">{money(d.spend)}</div></div>
            <div className="stat"><div className="label">Net saved</div><div className="value" style={{ color: d.net >= 0 ? 'var(--good)' : 'var(--high)' }}>{d.net >= 0 ? '+' : '−'}{money(Math.abs(d.net))}</div></div>
            <div className="stat"><div className="label">Subscriptions</div><div className="value">{money(d.subscriptions.monthlyTotal)}<span style={{ fontSize: 13, color: 'var(--muted)' }}>/mo</span></div></div>
          </div>

          <section className="card">
            <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>Spending by category</h2>
            <BarList items={d.topCategories.map((c: any) => ({ label: c.category, value: c.total }))} />
          </section>

          <section className="card">
            <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Top merchants</h2>
            {d.topMerchants.map((m: any) => (
              <div className="sub" key={m.merchant}>
                <div><div className="name">{m.display_name}</div><div className="meta">{m.count} charges</div></div>
                <div className="cost" style={{ fontWeight: 700 }}>{money(m.total)}</div>
              </div>
            ))}
          </section>

          {d.budgets.length > 0 && (
            <section className="card">
              <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Budgets</h2>
              {d.budgets.map((b: any) => (
                <div className="sub" key={b.category}>
                  <div className="name">{pretty(b.category)}</div>
                  <div className="cost" style={{ color: b.spent > b.limit ? 'var(--high)' : 'var(--muted)', fontWeight: 600 }}>
                    {money(b.spent)} / {money(b.limit)}
                  </div>
                </div>
              ))}
            </section>
          )}

          {d.insights.length > 0 && (
            <section className="card">
              <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Findings</h2>
              {d.insights.map((i: any, idx: number) => (
                <div className="sub" key={idx}>
                  <div><span className={`sev ${i.severity}`}>{i.severity}</span> <span className="name" style={{ marginLeft: 8 }}>{i.title}</span></div>
                  {i.annualized_impact ? <div className="cost impact">{money(Number(i.annualized_impact))}/yr</div> : null}
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
