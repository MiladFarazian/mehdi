# mehdi

A personal financial-intelligence assistant. Securely links your bank and
credit-card accounts, builds a deep model of your spending, and surfaces
proactive advice:

- **Runaway subscriptions** — recurring charges that grew, duplicated, or went unused
- **Cut-back recommendations** — categories and merchants where you're overspending vs. your own baseline
- **Spending patterns to rein in** — lifestyle creep, impulse clusters, and anomalies, explained in plain language

## Status

🚧 **Phase 0** — a working Next.js + Plaid **Sandbox** slice that links a (fake)
bank and lists its transactions. See [`docs/PLAN.md`](docs/PLAN.md) for the full
architecture and analysis design.

## Running Phase 0

1. **Get free Plaid Sandbox keys** at <https://dashboard.plaid.com> →
   Team Settings → Keys. Sandbox is free and uses fake banks.
2. Copy the env template and paste your keys:
   ```bash
   cp .env.example .env.local
   # edit .env.local: PLAID_CLIENT_ID and PLAID_SECRET
   ```
3. Install and run:
   ```bash
   npm install
   npm run dev
   ```
4. Open <http://localhost:3000>, click **Link a bank account**, pick any bank,
   and sign in with the sandbox credentials **`user_good`** / **`pass_good`**.
   Recent transactions appear once linked.

> Phase 0 stores the Plaid token in a gitignored local file (`data/local/`) to
> keep setup to a single signup. Phase 1 moves storage to Supabase Postgres with
> the token encrypted at rest.

## High-level architecture

```
Bank / card accounts
        │  (read-only, tokenized)
   Aggregator (Plaid)
        │  transactions, balances, recurring streams
   Ingestion + normalization
        │
   Analysis engine ── recurring-charge detection
        │           ── category baselines & anomaly detection
        │           ── subscription lifecycle tracking
   LLM advisor (Claude) ── plain-language insights & recommendations
        │
   App (web / mobile) + alerts
```

## Principles

- **Read-only** access to accounts. No money movement.
- **Least data**: store only what the analysis needs; encrypt sensitive fields.
- **You own the data**: export and delete at any time.
