'use client';

import { LinkButton } from '@/components/LinkButton';

type Props = {
  summary: any;
  busy: string | null;
  onReload: () => void;
  onRun: (label: string, url: string) => void;
  note?: string;
};

function Step({
  n,
  done,
  active,
  title,
  desc,
  children,
}: {
  n: number;
  done: boolean;
  active: boolean;
  title: string;
  desc: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`ostep ${done ? 'done' : active ? 'active' : ''}`}>
      <div className="onum">{done ? '✓' : n}</div>
      <div style={{ flex: 1 }}>
        <div className="otitle">{title}</div>
        <div className="muted" style={{ fontSize: 13 }}>{desc}</div>
        {active && children && <div style={{ marginTop: 10 }}>{children}</div>}
      </div>
    </div>
  );
}

export function Onboarding({ summary, busy, onReload, onRun, note }: Props) {
  const accounts = summary?.accounts ?? 0;
  const transactions = summary?.transactions ?? 0;
  const analyzed = (summary?.subscriptions ?? 0) > 0 || (summary?.newInsights ?? 0) > 0;

  const step1 = accounts > 0;
  const step2 = transactions > 0;
  const step3 = analyzed;

  return (
    <section className="card" style={{ marginTop: 24 }}>
      <h2 style={{ margin: '0 0 6px' }}>Welcome to mehdi 👋</h2>
      <p className="muted">
        Link an account and I&apos;ll map your spending, catch runaway subscriptions, and find
        places to cut back. Three quick steps:
      </p>

      <div style={{ marginTop: 18 }}>
        <Step
          n={1}
          done={step1}
          active={!step1}
          title="Link a bank account"
          desc="Read-only via Plaid — sign in with your bank credentials."
        >
          <LinkButton onLinked={onReload} />
        </Step>
        <Step
          n={2}
          done={step2}
          active={step1 && !step2}
          title="Sync your transactions"
          desc="Pull your recent history into mehdi."
        >
          <button className="btn" disabled={!!busy} onClick={() => onRun('sync', '/api/plaid/sync')}>
            {busy === 'sync' ? 'Syncing…' : 'Sync now'}
          </button>
        </Step>
        <Step
          n={3}
          done={step3}
          active={step2 && !step3}
          title="Run the analysis"
          desc="Detect subscriptions, build baselines, and surface insights."
        >
          <button className="btn" disabled={!!busy} onClick={() => onRun('analyze', '/api/analyze')}>
            {busy === 'analyze' ? 'Analyzing…' : 'Run analysis'}
          </button>
        </Step>
      </div>
      {note && <p className="muted" style={{ marginTop: 10 }}>{note}</p>}
    </section>
  );
}
