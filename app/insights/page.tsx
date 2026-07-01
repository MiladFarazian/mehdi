'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

const SEV_RANK = { high: 0, warn: 1, info: 2 } as const;
const prettyType = (t: string) => t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const FIXABLE = new Set(['price_creep', 'duplicate_services', 'new_recurring', 'annual_renewal']);

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [sev, setSev] = useState<'all' | 'high' | 'warn' | 'info'>('all');
  const [type, setType] = useState('all');
  const [sort, setSort] = useState<'severity' | 'savings'>('severity');

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
    setInsights((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/insights/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  };

  const types = useMemo(() => [...new Set(insights.map((i) => i.type))].sort(), [insights]);

  const visible = useMemo(() => {
    let list = insights.filter((i) => (sev === 'all' || i.severity === sev) && (type === 'all' || i.type === type));
    list = list.slice().sort((a, b) =>
      sort === 'savings'
        ? (Number(b.annualized_impact) || 0) - (Number(a.annualized_impact) || 0)
        : SEV_RANK[a.severity] - SEV_RANK[b.severity],
    );
    return list;
  }, [insights, sev, type, sort]);

  const potentialSavings = insights
    .filter((i) => i.annualized_impact && FIXABLE.has(i.type))
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

      {insights.length > 0 && (
        <div className="filters">
          {(['all', 'high', 'warn', 'info'] as const).map((s) => (
            <button key={s} className={`chip ${sev === s ? 'on' : ''}`} onClick={() => setSev(s)}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
          <select className="filter-input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>{prettyType(t)}</option>
            ))}
          </select>
          <select className="filter-input" value={sort} onChange={(e) => setSort(e.target.value as any)}>
            <option value="severity">Sort: severity</option>
            <option value="savings">Sort: biggest savings</option>
          </select>
        </div>
      )}

      <section style={{ marginTop: 8 }}>
        {loading && <p className="muted card">Loading…</p>}
        {!loading && insights.length === 0 && (
          <p className="muted card">Nothing flagged yet. Link an account and run analysis.</p>
        )}
        {!loading && insights.length > 0 && visible.length === 0 && (
          <p className="muted card">No insights match these filters.</p>
        )}
        {visible.map((i) => (
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
              <button className="chip" onClick={() => update(i.id, 'actioned')}>Mark handled</button>
              <button className="chip" onClick={() => update(i.id, 'dismissed')}>Dismiss</button>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
