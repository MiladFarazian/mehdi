'use client';

import { useCallback, useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';

type Insight = {
  id: string;
  type: string;
  severity: 'high' | 'warn' | 'info';
  title: string;
  body: string;
  annualized_impact: number | null;
  status: string;
};

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await fetch('/api/insights').then((r) => r.json());
    setInsights((d.insights || []).filter((i: Insight) => i.status !== 'dismissed'));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (id: string, status: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== id || status !== 'dismissed'));
    await fetch(`/api/insights/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  };

  // Headline savings = actionable subscription fixes only (matches /api/analytics).
  const FIXABLE = new Set(['price_creep', 'duplicate_services', 'new_recurring', 'annual_renewal']);
  const potentialSavings = insights
    .filter((i) => i.status !== 'dismissed' && i.annualized_impact && FIXABLE.has(i.type))
    .reduce((a, i) => a + Number(i.annualized_impact), 0);

  return (
    <main className="container">
      <Nav />
      <header>
        <h1>Insights</h1>
        <p className="muted">Runaway subscriptions, overspend, and patterns to rein in.</p>
      </header>

      {potentialSavings > 0 && (
        <div className="banner" style={{ borderColor: 'var(--good)' }}>
          Acting on these could save you about{' '}
          <strong>${potentialSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr</strong>{' '}
          <span className="muted">(estimated — some findings may overlap).</span>
        </div>
      )}

      <section style={{ marginTop: 8 }}>
        {loading && <p className="muted card">Loading…</p>}
        {!loading && insights.length === 0 && (
          <p className="muted card">Nothing flagged yet. Link an account and run analysis.</p>
        )}
        {insights.map((i) => (
          <div className="insight" key={i.id}>
            <div className="top">
              <span className={`sev ${i.severity}`}>{i.severity}</span>
              <h3>{i.title}</h3>
              {i.annualized_impact ? (
                <span className="impact">${Number(i.annualized_impact).toFixed(0)}/yr</span>
              ) : null}
            </div>
            <p>{i.body}</p>
            <div className="actions">
              <button className="chip" onClick={() => update(i.id, 'actioned')}>
                Mark handled
              </button>
              <button className="chip" onClick={() => update(i.id, 'dismissed')}>
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
