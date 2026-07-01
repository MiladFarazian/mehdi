'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Nav } from '@/components/Nav';
import { Logo } from '@/components/Logo';

type Sub = {
  id: string;
  display_name: string;
  category: string | null;
  frequency: string;
  avg_amount: number;
  first_amount: number;
  last_amount: number;
  expected_next: string | null;
  annual_cost: number;
  user_status: string | null;
  logo_url: string | null;
};

function daysUntil(date: string): number {
  const ms = new Date(date).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [totals, setTotals] = useState({ monthlyTotal: 0, annualTotal: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await fetch('/api/subscriptions').then((r) => r.json());
    setSubs(d.subscriptions || []);
    setTotals({ monthlyTotal: d.monthlyTotal || 0, annualTotal: d.annualTotal || 0 });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: string, user_status: string) => {
    // "Not a subscription" removes it from the list entirely (and permanently).
    if (user_status === 'not_subscription') {
      setSubs((prev) => prev.filter((s) => s.id !== id));
    } else {
      setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, user_status } : s)));
    }
    await fetch(`/api/subscriptions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_status }),
    });
  };

  const upcoming = useMemo(
    () =>
      subs
        .filter((s) => s.expected_next && daysUntil(s.expected_next) >= 0 && daysUntil(s.expected_next) <= 30)
        .sort((a, b) => (a.expected_next! < b.expected_next! ? -1 : 1)),
    [subs],
  );

  return (
    <main className="container">
      <Nav />
      <header>
        <h1>Subscriptions</h1>
        <p className="muted">
          {subs.length} detected · ${totals.monthlyTotal.toFixed(0)}/mo · ${totals.annualTotal.toFixed(0)}/yr
        </p>
      </header>

      {upcoming.length > 0 && (
        <section className="card">
          <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>Upcoming charges · next 30 days</h2>
          <div style={{ marginTop: 8 }}>
            {upcoming.map((s) => {
              const d = daysUntil(s.expected_next!);
              return (
                <div className="upcoming" key={s.id}>
                  <span className="when">{d === 0 ? 'today' : `in ${d}d`}</span>
                  <span className="name">{s.display_name}</span>
                  <span className="muted" style={{ fontSize: 13 }}>{s.expected_next}</span>
                  <span className="cost">${Number(s.avg_amount).toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="card">
        {loading && <p className="muted">Loading…</p>}
        {!loading && subs.length === 0 && (
          <p className="muted">No subscriptions detected yet. Run analysis from the dashboard.</p>
        )}
        {subs.map((s) => {
          const hike = s.last_amount > s.first_amount;
          return (
            <div className="sub" key={s.id}>
              <Logo url={s.logo_url} />
              <div>
                <div className="name">{s.display_name}</div>
                <div className="meta">
                  {s.frequency} · ${Number(s.avg_amount).toFixed(2)}
                  {hike && (
                    <span style={{ color: 'var(--warn)' }}> · ↑ from ${Number(s.first_amount).toFixed(2)}</span>
                  )}
                  {s.expected_next && <span> · next {s.expected_next}</span>}
                </div>
                <div className="fb" style={{ marginTop: 8 }}>
                  <button className={`chip ${s.user_status === 'using' ? 'on' : ''}`} onClick={() => setStatus(s.id, 'using')}>
                    Still using
                  </button>
                  <button className={`chip ${s.user_status === 'not_using' ? 'on' : ''}`} onClick={() => setStatus(s.id, 'not_using')}>
                    Not using
                  </button>
                  <button className={`chip ${s.user_status === 'cancel' ? 'on' : ''}`} onClick={() => setStatus(s.id, 'cancel')}>
                    Plan to cancel
                  </button>
                  <button className="chip" onClick={() => setStatus(s.id, 'not_subscription')}>
                    Not a subscription
                  </button>
                </div>
              </div>
              <div className="cost">
                <div style={{ fontWeight: 700 }}>${Number(s.annual_cost).toFixed(0)}/yr</div>
                <div className="meta">${(Number(s.annual_cost) / 12).toFixed(2)}/mo</div>
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
