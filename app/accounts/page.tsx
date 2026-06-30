'use client';

import { useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';

type Account = {
  account_id: string;
  name: string | null;
  official_name: string | null;
  type: string | null;
  subtype: string | null;
  mask: string | null;
  current_balance: number;
  isLiability: boolean;
};
type Income = {
  id: string;
  display_name: string;
  frequency: string;
  avg_amount: number;
  expected_next: string | null;
  annual_income: number;
};
type Data = {
  configured: boolean;
  accounts?: Account[];
  assets?: number;
  liabilities?: number;
  netWorth?: number;
  income?: Income[];
};

const money = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AccountsPage() {
  const [d, setD] = useState<Data | null>(null);

  useEffect(() => {
    fetch('/api/accounts').then((r) => r.json()).then(setD);
  }, []);

  const accounts = d?.accounts ?? [];
  const assets = accounts.filter((a) => !a.isLiability);
  const liabilities = accounts.filter((a) => a.isLiability);
  const income = d?.income ?? [];

  return (
    <main className="container">
      <Nav />
      <header>
        <h1>Accounts</h1>
        <p className="muted">Balances, net worth, and recurring income.</p>
      </header>

      {accounts.length === 0 && (
        <p className="muted card">No accounts linked yet.</p>
      )}

      {accounts.length > 0 && (
        <>
          <div className="hero" style={{ cursor: 'default' }}>
            <div>
              <div className="hero-label">Net worth</div>
              <div className="hero-value">{money(d?.netWorth ?? 0)}</div>
            </div>
            <div className="hero-sub">
              {money(d?.assets ?? 0)} assets · {money(d?.liabilities ?? 0)} owed
            </div>
          </div>

          <section className="card">
            <h2 style={{ margin: '0 0 6px', fontSize: 16 }}>Assets</h2>
            {assets.length === 0 && <p className="muted">None.</p>}
            {assets.map((a) => (
              <div className="sub" key={a.account_id}>
                <div>
                  <div className="name">{a.name || a.official_name}</div>
                  <div className="meta">
                    {a.subtype || a.type}{a.mask ? ` ····${a.mask}` : ''}
                  </div>
                </div>
                <div className="cost" style={{ fontWeight: 700 }}>{money(a.current_balance)}</div>
              </div>
            ))}
          </section>

          {liabilities.length > 0 && (
            <section className="card">
              <h2 style={{ margin: '0 0 6px', fontSize: 16 }}>Liabilities</h2>
              {liabilities.map((a) => (
                <div className="sub" key={a.account_id}>
                  <div>
                    <div className="name">{a.name || a.official_name}</div>
                    <div className="meta">{a.subtype || a.type}{a.mask ? ` ····${a.mask}` : ''}</div>
                  </div>
                  <div className="cost" style={{ fontWeight: 700, color: 'var(--high)' }}>
                    −{money(a.current_balance)}
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {income.length > 0 && (
        <section className="card">
          <h2 style={{ margin: '0 0 6px', fontSize: 16 }}>Recurring income</h2>
          {income.map((s) => (
            <div className="sub" key={s.id}>
              <div>
                <div className="name">{s.display_name}</div>
                <div className="meta">
                  {s.frequency}{s.expected_next ? ` · next ${s.expected_next}` : ''}
                </div>
              </div>
              <div className="cost">
                <div style={{ fontWeight: 700, color: 'var(--good)' }}>{money(s.avg_amount)}</div>
                <div className="meta">{money(s.annual_income)}/yr</div>
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
