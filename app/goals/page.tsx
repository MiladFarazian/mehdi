'use client';

import { useCallback, useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';

type Goal = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  remaining: number;
  pct: number;
  months: number | null;
  projectedMonth: string | null;
};
type Data = { configured: boolean; tableExists?: boolean; goals?: Goal[]; avgMonthlyNet?: number };

const money = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function GoalsPage() {
  const [d, setD] = useState<Data | null>(null);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');

  const load = useCallback(async () => {
    setD(await fetch('/api/goals').then((r) => r.json()));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async (body: any) => {
    await fetch('/api/goals', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setName('');
    setTarget('');
    setCurrent('');
    load();
  };
  const remove = async (goalName: string) => {
    await fetch('/api/goals', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: goalName }),
    });
    load();
  };

  return (
    <main className="container">
      <Nav />
      <header>
        <h1>Savings goals</h1>
        <p className="muted">
          Track targets — projected from your ~{money(d?.avgMonthlyNet ?? 0)}/mo savings rate.
        </p>
      </header>

      {d && d.tableExists === false && (
        <div className="banner">
          Goals need one more migration. Paste <code>supabase/migrations/0003_goals.sql</code> into the
          Supabase SQL editor and run it, then reload.
        </div>
      )}

      {d?.tableExists && (
        <>
          <section className="card">
            {(d.goals?.length ?? 0) === 0 && <p className="muted">No goals yet. Add one below.</p>}
            {d.goals?.map((g) => {
              const done = g.current_amount >= g.target_amount;
              return (
                <div className="budget" key={g.id}>
                  <div className="budget-head">
                    <span className="name">{g.name}</span>
                    <span className="muted">
                      {money(g.current_amount)} / {money(g.target_amount)}
                      <button className="chip" style={{ marginLeft: 10 }} onClick={() => remove(g.name)}>
                        Remove
                      </button>
                    </span>
                  </div>
                  <div className="bartrack" style={{ height: 10, marginTop: 8 }}>
                    <span
                      className="barfill"
                      style={{ width: `${g.pct}%`, background: done ? 'var(--good)' : undefined }}
                    />
                  </div>
                  <div className="meta" style={{ marginTop: 6 }}>
                    {done ? (
                      <span style={{ color: 'var(--good)' }}>Reached! 🎉</span>
                    ) : g.projectedMonth ? (
                      <>On track to reach by <strong>{g.projectedMonth}</strong> ({g.months} mo) · {money(g.remaining)} to go</>
                    ) : (
                      <>{money(g.remaining)} to go</>
                    )}
                    <button
                      className="chip"
                      style={{ marginLeft: 10 }}
                      onClick={() => {
                        const v = prompt(`Update saved amount for "${g.name}"`, String(g.current_amount));
                        if (v !== null && !Number.isNaN(Number(v)))
                          save({ name: g.name, target_amount: g.target_amount, current_amount: Number(v), target_date: g.target_date });
                      }}
                    >
                      Update saved
                    </button>
                  </div>
                </div>
              );
            })}
          </section>

          <section className="card">
            <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>Add a goal</h2>
            <div className="filters" style={{ marginTop: 0 }}>
              <input className="filter-input" placeholder="Name (e.g. Emergency fund)" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="filter-input" type="number" placeholder="Target $" value={target} onChange={(e) => setTarget(e.target.value)} style={{ minWidth: 120 }} />
              <input className="filter-input" type="number" placeholder="Saved so far $" value={current} onChange={(e) => setCurrent(e.target.value)} style={{ minWidth: 120 }} />
              <button
                className="btn"
                disabled={!name || !(Number(target) > 0)}
                onClick={() => save({ name, target_amount: Number(target), current_amount: Number(current) || 0 })}
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
