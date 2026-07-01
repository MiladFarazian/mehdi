'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Nav } from '@/components/Nav';

type Txn = {
  id: string;
  date: string;
  name: string;
  merchant: string | null;
  amount: number;
  category: string;
  pending: boolean;
};

const PAGE = 50;

function fmt(amount: number) {
  const sign = amount < 0 ? '+' : '-';
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}
function pretty(c: string) {
  return c.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase());
}

export default function TransactionsPage() {
  const [txns, setTxns] = useState<Txn[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (category) p.set('category', category);
    p.set('limit', String(PAGE));
    p.set('offset', String(offset));
    const d = await fetch(`/api/transactions/list?${p}`).then((r) => r.json());
    setTxns(d.transactions || []);
    setTotal(d.total || 0);
    if (d.categories?.length) setCategories(d.categories);
    setLoading(false);
  }, [search, category, offset]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to first page when a filter changes.
  useEffect(() => {
    setOffset(0);
  }, [search, category]);

  return (
    <main className="container">
      <Nav />
      <header>
        <div className="row">
          <h1>Transactions</h1>
          <a className="btn ghost" href="/api/transactions/export">Export CSV</a>
        </div>
        <p className="muted">{total} transactions</p>
      </header>

      <div className="filters">
        <input
          className="filter-input"
          placeholder="Search merchant…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="filter-input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{pretty(c)}</option>
          ))}
        </select>
      </div>

      <section className="card">
        {loading && <p className="muted">Loading…</p>}
        {!loading && txns.length === 0 && <p className="muted">No transactions match.</p>}
        {!loading && txns.length > 0 && (
          <table className="txns">
            <thead>
              <tr>
                <th>Date</th>
                <th>Merchant</th>
                <th>Category</th>
                <th className="r">Amount</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => (
                <tr key={t.id}>
                  <td>{t.date}</td>
                  <td>
                    {t.merchant ? (
                      <Link href={`/merchants?m=${encodeURIComponent(t.merchant)}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                        {t.name}
                      </Link>
                    ) : (
                      t.name
                    )}
                    {t.pending ? ' (pending)' : ''}
                  </td>
                  <td><span className="tag">{pretty(t.category)}</span></td>
                  <td className="r">{fmt(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {total > PAGE && (
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
              ← Prev
            </button>
            <span className="muted">{offset + 1}–{Math.min(offset + PAGE, total)} of {total}</span>
            <button className="btn ghost" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>
              Next →
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
