# mehdi

A personal financial-intelligence assistant. Securely links your bank and
credit-card accounts, builds a deep model of your spending, and surfaces
proactive advice:

- **Runaway subscriptions** — recurring charges that grew, duplicated, or went unused
- **Cut-back recommendations** — categories and merchants where you're overspending vs. your own baseline
- **Spending patterns to rein in** — lifestyle creep, impulse clusters, and anomalies, explained in plain language

## Status

🚧 Early planning. See [`docs/PLAN.md`](docs/PLAN.md) for the architecture and analysis design.

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
