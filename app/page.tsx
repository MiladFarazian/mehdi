'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { LinkButton } from '@/components/LinkButton';
import { Onboarding } from '@/components/Onboarding';
import { TransactionsList, type Txn } from '@/components/TransactionsList';
import { BarList, TrendBars } from '@/components/charts';

type Summary = {
  configured: boolean;
  transactions?: number;
  accounts?: number;
  subscriptions?: number;
  monthlySubscriptionCost?: number;
  newInsights?: number;
  lastCompleteMonth?: string;
  lastMonthSpend?: number;
};

type Analytics = {
  potentialSavings?: number;
  savingsCount?: number;
  monthlyTrend?: { month: string; spend: number }[];
  monthlyCashflow?: { month: string; income: number; spend: number; net: number }[];
  spendingPatterns?: {
    byDayOfWeek: { label: string; total: number; avgPerDay: number }[];
    weekdayAvg: number;
    weekendAvg: number;
    priciestDay: string | null;
  };
  topCategories?: { category: string; total: number }[];
  income?: number;
  spend?: number;
};

export default function Home() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [analytics, setAnalytics] = useState<Analytics>({});
  const [netWorth, setNetWorth] = useState<number | null>(null);
  const [runway, setRunway] = useState<any>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const [s, a, acc, rw, t] = await Promise.all([
      fetch('/api/summary').then((r) => r.json()),
      fetch('/api/analytics').then((r) => r.json()),
      fetch('/api/accounts').then((r) => r.json()),
      fetch('/api/runway').then((r) => r.json()),
      fetch('/api/plaid/transactions').then((r) => r.json()),
    ]);
    setSummary(s);
    setAnalytics(a || {});
    setNetWorth(acc?.configured ? acc.netWorth ?? null : null);
    setRunway(rw?.configured ? rw : null);
    setTxns((t.transactions || []).slice(0, 8));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = useCallback(
    async (label: string, url: string) => {
      setBusy(label);
      setNote('');
      try {
        const d = await fetch(url, { method: 'POST' }).then((r) => r.json());
        if (d.error) setNote(d.error);
        else if (label === 'sync') setNote(`Synced: +${d.added} new, ${d.modified} updated.`);
        else if (label === 'analyze')
          setNote(`Analyzed ${d.transactions} txns → ${d.streams} subscriptions, ${d.newInsights} new insights.`);
        await load();
      } catch (e: any) {
        setNote(e?.message || 'Failed');
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  const configured = summary?.configured;
  const hasData = (summary?.transactions ?? 0) > 0;
  const savings = analytics.potentialSavings ?? 0;

  return (
    <main className="container">
      <Nav />

      {summary && !configured && (
        <div className="banner">
          Supabase isn&apos;t configured yet. Add <code>SUPABASE_URL</code> to{' '}
          <code>.env.local</code> and apply the migration, then restart.
        </div>
      )}

      <header>
        <h1>Dashboard</h1>
        <p className="muted">Your spending at a glance.</p>
      </header>

      {configured && !hasData && (
        <Onboarding summary={summary} busy={busy} onReload={load} onRun={run} note={note} />
      )}

      {hasData && runway && runway.burnPerMonth > 0 && (
        <section className="card" style={{ borderColor: 'var(--warn)' }}>
          <div className="row">
            <h2 style={{ margin: 0, fontSize: 16 }}>Burn &amp; runway</h2>
            <span className="sev warn">deficit</span>
          </div>
          <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>
            You&apos;re spending about{' '}
            <strong style={{ color: 'var(--text)' }}>${runway.burnPerMonth.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</strong>{' '}
            more than you earn (income ${runway.monthlyIncome.toFixed(0)}/mo vs spend ${runway.monthlySpend.toFixed(0)}/mo, median).
          </p>
          <div className="grid" style={{ marginTop: 14 }}>
            <div className="stat">
              <div className="label">Monthly burn</div>
              <div className="value" style={{ color: 'var(--high)' }}>−${runway.burnPerMonth.toFixed(0)}</div>
            </div>
            <div className="stat">
              <div className="label">Liquid cash (linked)</div>
              <div className="value">${runway.liquidCash.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="stat">
              <div className="label">Runway</div>
              <div className="value">
                {runway.runwayMonths != null ? `${runway.runwayMonths} mo` : '—'}
              </div>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
            Runway is based on <strong style={{ color: 'var(--text)' }}>${runway.liquidCash.toFixed(0)}</strong> in
            linked accounts. Link your savings account for an accurate figure — your real runway is
            almost certainly longer.
          </p>
        </section>
      )}

      {savings > 0 && (
        <Link href="/insights" className="hero">
          <div>
            <div className="hero-label">Potential savings we found</div>
            <div className="hero-value">${savings.toLocaleString(undefined, { maximumFractionDigits: 0 })}<span className="hero-unit">/yr</span></div>
          </div>
          <div className="hero-sub">
            across {analytics.savingsCount ?? 0} insight{(analytics.savingsCount ?? 0) === 1 ? '' : 's'} →
          </div>
        </Link>
      )}

      {hasData && (
        <div className="grid">
          {netWorth !== null && (
            <div className="stat">
              <div className="label">Net worth</div>
              <div className="value">${netWorth.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>
          )}
          <div className="stat">
            <div className="label">Spent ({summary?.lastCompleteMonth ?? '—'})</div>
            <div className="value">${(summary?.lastMonthSpend ?? 0).toFixed(0)}</div>
          </div>
          <div className="stat">
            <div className="label">Subscriptions</div>
            <div className="value">{summary?.subscriptions ?? 0}</div>
          </div>
          <div className="stat">
            <div className="label">Subs / month</div>
            <div className="value">${(summary?.monthlySubscriptionCost ?? 0).toFixed(0)}</div>
          </div>
          <div className="stat">
            <div className="label">New insights</div>
            <div className="value">{summary?.newInsights ?? 0}</div>
          </div>
        </div>
      )}

      {hasData && (
        <div className="two-col">
          <section className="card">
            <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>Monthly spending</h2>
            <p className="muted" style={{ fontSize: 13 }}>Last {analytics.monthlyTrend?.length ?? 0} months</p>
            <TrendBars data={analytics.monthlyTrend ?? []} />
          </section>
          <section className="card">
            <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>Where it went</h2>
            <p className="muted" style={{ fontSize: 13 }}>Top categories, {analytics.income ? `income $${analytics.income.toFixed(0)} · ` : ''}{summary?.lastCompleteMonth}</p>
            <BarList items={(analytics.topCategories ?? []).map((c) => ({ label: c.category, value: c.total }))} />
          </section>
        </div>
      )}

      {hasData && analytics.spendingPatterns && (
        <section className="card">
          <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>Spending patterns</h2>
          <p className="muted" style={{ fontSize: 13 }}>
            Average spend per weekday
            {analytics.spendingPatterns.priciestDay
              ? ` · priciest day: ${analytics.spendingPatterns.priciestDay}`
              : ''}
          </p>
          <BarList
            items={analytics.spendingPatterns.byDayOfWeek.map((d) => ({ label: d.label, value: d.avgPerDay }))}
          />
          <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
            Weekends average <strong style={{ color: 'var(--text)' }}>${analytics.spendingPatterns.weekendAvg.toFixed(0)}</strong>/day vs{' '}
            <strong style={{ color: 'var(--text)' }}>${analytics.spendingPatterns.weekdayAvg.toFixed(0)}</strong>/day on weekdays.
          </p>
        </section>
      )}

      {hasData && (analytics.monthlyCashflow?.some((c) => c.income > 0) ?? false) && (
        <section className="card">
          <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>Cash flow</h2>
          <p className="muted" style={{ fontSize: 13 }}>Income vs. spending, net saved</p>
          <table className="txns" style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>Month</th>
                <th className="r">In</th>
                <th className="r">Out</th>
                <th className="r">Net</th>
              </tr>
            </thead>
            <tbody>
              {analytics.monthlyCashflow!.slice().reverse().map((c) => (
                <tr key={c.month}>
                  <td>{c.month}</td>
                  <td className="r" style={{ color: 'var(--good)' }}>${c.income.toFixed(0)}</td>
                  <td className="r">${c.spend.toFixed(0)}</td>
                  <td className="r" style={{ color: c.net >= 0 ? 'var(--good)' : 'var(--high)', fontWeight: 600 }}>
                    {c.net >= 0 ? '+' : '−'}${Math.abs(c.net).toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {hasData && (
        <section className="card">
          <div className="row">
            <h2 style={{ margin: 0, fontSize: 16 }}>Accounts &amp; data</h2>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            {summary?.accounts ?? 0} account(s), {summary?.transactions ?? 0} transactions.
          </p>
          <div className="actions">
            <LinkButton onLinked={load} />
            <button className="btn ghost" disabled={!!busy} onClick={() => run('sync', '/api/plaid/sync')}>
              {busy === 'sync' ? 'Syncing…' : 'Sync now'}
            </button>
            <button className="btn ghost" disabled={!!busy} onClick={() => run('analyze', '/api/analyze')}>
              {busy === 'analyze' ? 'Analyzing…' : 'Run analysis'}
            </button>
          </div>
          {note && <p className="muted" style={{ marginTop: 10 }}>{note}</p>}
        </section>
      )}

      {hasData && (
        <section className="card">
          <div className="row">
            <h2 style={{ margin: 0, fontSize: 16 }}>Recent transactions</h2>
            <Link className="btn ghost" href="/transactions">View all →</Link>
          </div>
          <TransactionsList txns={txns} />
        </section>
      )}
    </main>
  );
}
