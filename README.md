# mehdi

A personal financial-intelligence assistant. Securely links your bank and
credit-card accounts (read-only), builds a deep model of your spending, and
surfaces proactive advice:

- **Runaway subscriptions** — price creep, free-trials-converted-to-paid,
  duplicate/overlapping services, annual renewals before they hit
- **Cut-back recommendations** — categories and merchants where you're
  overspending vs. *your own* baseline, shown annualized
- **Patterns to rein in** — lifestyle creep, spending spikes, small leaks
- **Advisor** — ask Claude anything about your spending; answers are grounded
  in your real transactions, never guessed. Runs on your **Claude Code / Max
  subscription** (via the local `claude` CLI), so there's no separate API bill
- **Delivery** — proactive email alerts, a periodic digest, and on-demand chat

## Status

✅ **Phases 0–6 built.** Next.js + Supabase + Plaid (Sandbox) + Claude. Runs
end-to-end against fake banks today; flip to Plaid Production to use real
accounts (see [`docs/GOLIVE.md`](docs/GOLIVE.md)).

## Quick start

See [`docs/SETUP.md`](docs/SETUP.md). In short:

```bash
cp .env.example .env.local      # add Plaid + Supabase (+ Anthropic) keys
# paste supabase/migrations/0001_init.sql into the Supabase SQL editor
npm install && npm run dev
```

Then link a bank with sandbox creds **`user_good` / `pass_good`**, hit
**Sync** → **Run analysis**, and explore.

## How it links to your accounts

Plaid sits between the app and your bank and provides **read-only** transaction
+ balance data via a revocable token. The app never sees bank credentials, and
no payment/transfer scopes are requested. The token is exchanged and stored
server-side only.

## Architecture

```
Plaid (read-only) ──► /api/plaid/sync ──► transactions (Supabase)
                                              │
        ┌─────────────────────────────────────┘
        ▼
  Analysis engine (lib/analysis/)
   ├─ recurring.ts   subscription detection (cadence + amount stability)
   ├─ baselines.ts   per-category median + MAD baselines
   └─ detectors.ts   price creep · new recurring · duplicates · annual renewal
                     · category overspend · merchant spikes · lifestyle creep
        │ insights (Supabase)
        ▼
  Advisor (lib/advisor/, Claude Code CLI) ── grounded chat + digests
        ▼
  Delivery ── email alerts (Resend) · weekly digest (cron) · chat UI
```

**Core principle:** every dollar figure is computed in code; Claude only
explains and prioritizes precomputed facts — so numbers are always trustworthy.

## Docs

- [`docs/PLAN.md`](docs/PLAN.md) — full architecture & analysis design
- [`docs/SETUP.md`](docs/SETUP.md) — environment, DB, running, first use
- [`docs/GOLIVE.md`](docs/GOLIVE.md) — Plaid Production + hardening checklist

## Principles

- **Read-only** account access. No money movement.
- **Deterministic numbers**, LLM narration.
- **You own the data**: export and delete at any time.
