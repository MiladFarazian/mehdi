'use client';

import { useCallback, useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';

type Budget = { category: string; monthly_limit: number; spent: number; pct: number };
type Data = {
  configured: boolean;
  tableExists?: boolean;
  month?: string;
  budgets?: Budget[];
  availableCategories?: string[];
};

const pretty = (c: string) => c.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase());

export default function BudgetsPage() {
  const [d, setD] = useState<Data | null>(null);
  const [cat, setCat] = useState('');
  const [limit, setLimit] = useState('');

  const load = useCallback(async () => {
    setD(await fetch('/api/budgets').then((r) => r.json()));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (category: string, monthly_limit: number) => {
    await fetch('/api/budgets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, monthly_limit }),
    });
    setCat('');
    setLimit('');
    load();
  };

  const remove = async (category: string) => {
    await fetch('/api/budgets', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    });
    load();
  };

  return (
    <main className="container">
      <Nav />
      <header>
        <h1>Budgets</h1>
        <p className="muted">Set a monthly limit per category and track {d?.month ?? 'this month'}.</p>
      </header>

      {d && d.tableExists === false && (
        <div className="banner">
          Budgets need one more migration. Paste{' '}
          <code>supabase/migrations/0002_budgets.sql</code> into the Supabase SQL editor and run it,
          then reload.
        </div>
      )}

      {d?.tableExists && (
        <>
          <section className="card">
            {(d.budgets?.length ?? 0) === 0 && <p className="muted">No budgets yet. Add one below.</p>}
            {d.budgets?.map((b) => {
              const over = b.spent > b.monthly_limit;
              return (
                <div className="budget" key={b.category}>
                  <div className="budget-head">
                    <span className="name">{pretty(b.category)}</span>
                    <span className={over ? 'over' : 'muted'}>
                      ${b.spent.toFixed(0)} / ${b.monthly_limit.toFixed(0)}
                      <button className="chip" style={{ marginLeft: 10 }} onClick={() => remove(b.category)}>
                        Remove
                      </button>
                    </span>
                  </div>
                  <div className="bartrack" style={{ height: 10, marginTop: 8 }}>
                    <span
                      className="barfill"
                      style={{
                        width: `${Math.min(100, b.pct)}%`,
                        background: over ? 'var(--high)' : b.pct > 80 ? 'var(--warn)' : undefined,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </section>

          <section className="card">
            <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>Add a budget</h2>
            <div className="filters" style={{ marginTop: 0 }}>
              <select className="filter-input" value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">Choose category…</option>
                {d.availableCategories?.map((c) => (
                  <option key={c} value={c}>{pretty(c)}</option>
                ))}
              </select>
              <input
                className="filter-input"
                type="number"
                placeholder="Monthly limit $"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                style={{ minWidth: 140 }}
              />
              <button
                className="btn"
                disabled={!cat || !(Number(limit) > 0)}
                onClick={() => save(cat, Number(limit))}
              >
                Save
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
