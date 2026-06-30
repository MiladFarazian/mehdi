# mehdi — Plan

A personal financial-intelligence assistant. Links your bank + credit-card
accounts (read-only), builds a deep model of your spending, and proactively
flags runaway subscriptions, cut-back opportunities, and spending patterns to
rein in.

**Decisions locked:** personal use · web app first · proactive alerts + periodic
digest + on-demand chat.

**Default stack:** Next.js (App Router, TypeScript) · Supabase (Postgres, Auth,
Edge Functions, pg_cron) · Plaid (account linking) · Claude API (advisor) ·
Resend (email) · Vercel (hosting).

---

## 1. How account linking works

We never see or store your bank credentials. An **aggregator** sits between us
and the banks and hands us **read-only** transaction + balance data via a
revocable token.

### Provider choice

| Provider | Why | Notes |
|---|---|---|
| **Plaid** (recommended) | Best US coverage, rich `personal_finance_category`, a built-in `/transactions/recurring` endpoint, `/transactions/sync` cursor model, webhooks | Production requires a short approval; pay-as-you-go. **Verify current pricing — it changes.** |
| Teller | Developer-friendly, generous personal/free tier, US banks | Good cheaper fallback |
| SimpleFIN Bridge | ~$1.50/mo, built for personal aggregation | Cheapest, less rich data |

We'll build against an **aggregator interface** so swapping is a single adapter,
and develop against **Plaid Sandbox** (free, fake banks) before touching real
money.

### Link flow (Plaid Link)

1. Backend calls `/link/token/create` → returns a short-lived `link_token`.
2. Frontend opens **Plaid Link** (`react-plaid-link`); you pick your bank and
   authenticate **on the bank/Plaid side**.
3. On success the frontend gets a `public_token`. Backend exchanges it via
   `/item/public_token/exchange` → `access_token` + `item_id`.
4. **Encrypt and store** the `access_token` (Supabase Vault / pgsodium). This is
   the only secret that matters; treat it like a password.
5. Pull data:
   - `/transactions/sync` (cursor-based; handles adds, modifies, removes)
   - `/accounts/balance/get`
   - `/transactions/recurring/get` (Plaid's own recurring streams — a baseline
     we cross-check against our own detection)
6. Register a **webhook**; on `SYNC_UPDATES_AVAILABLE` we re-run `sync` and
   re-analyze incrementally.

Read-only throughout — no payment/transfer scopes are ever requested.

---

## 2. Data model (Postgres / Supabase)

All tables have Row-Level Security on (good hygiene even single-user).

- `plaid_items` — `item_id`, **encrypted** `access_token`, institution, sync
  `cursor`, status.
- `accounts` — per-account: type (checking/credit/…), mask, balances.
- `transactions` — canonical ledger: `date`, `amount`, `merchant_name`,
  raw `name`, `pfc_primary`, `pfc_detailed`, `pending`, plus our enrichments
  (`normalized_merchant`, `is_discretionary`, `stream_id`).
- `recurring_streams` — detected subscriptions: `normalized_merchant`,
  `frequency`, `avg_amount`, `amount_history[]`, `first_seen`, `last_seen`,
  `expected_next`, `status` (active/late/ended), `confidence`.
- `category_baselines` — per category/month: robust median + MAD (see §3).
- `insights` — generated findings: `type`, `severity`, `title`, computed
  `facts` (JSON), `narrative`, `status` (new/seen/dismissed/actioned).
- `user_feedback` — your answers ("still using this?", "this is a need not a
  want") that train the system over time.
- `chat_messages` — advisor conversation history.

---

## 3. Analysis engine (the core)

**Guiding principle — deterministic first, LLM second.** Every dollar figure,
percentage, and date is computed in code/SQL. The LLM only *explains and
prioritizes* pre-computed facts. This makes numbers trustworthy and prevents
the model from inventing amounts.

### 3.1 Merchant normalization & enrichment

Bank descriptions are noisy (`SQ *BLUE BOTTLE 0421`, `AMZN Mktp US*2X4...`).
Pipeline: strip store numbers/dates/trailing IDs → map to a canonical merchant →
attach category (Plaid's `personal_finance_category`) → tag **need vs want**
(rules + your feedback). This single step powers everything downstream.

### 3.2 Recurring / subscription detection

For each normalized merchant:
- Compute gaps between charge dates; test whether they cluster near a known
  period — weekly (~7), biweekly (~14), monthly (~28–31), quarterly (~90),
  annual (~365) — with **low variance** (coefficient of variation).
- Require **amount stability** (charges within a tolerance band).
- **Confidence** = f(number of occurrences, interval regularity, amount
  stability). Cross-check against Plaid's `/recurring` output.
- Persist as a `recurring_stream` with `expected_next` and `amount_history`.

### 3.3 Runaway-subscription detectors (the headline feature)

Each fires an `insight` with computed facts + annualized cost:

1. **Price creep** — latest amount > earliest by a threshold (% or absolute).
   "Spotify went $9.99 → $11.99 (+20%) in Mar; +$24/yr."
2. **New recurring charge / trial-converted-to-paid** — a stream that didn't
   exist last cycle, especially a first real charge after a $0/$1 auth.
   "New $14.99/mo charge from XYZ started — a free trial likely converted."
3. **Duplicate / overlapping services** — multiple active streams in one
   category. "4 video services = $58/mo. Most-overlapping: HBO + Hulu."
4. **Zombie candidates** — long-running streams you've never paused, surfaced
   as *questions* (bank data can't truly prove "unused"), e.g. gym, an app you
   forgot. The system asks **"still using this?"**; your answer is stored and
   respected.
5. **Annual-renewal pre-warning** — large yearly charges flagged *before* they
   hit ("Amazon Prime $139 renews in 9 days").
6. **Failed cancellation** — a stream you marked "canceling" that keeps
   charging.

### 3.4 Category baselines & anomaly detection

- Per category, build a rolling baseline = **median + MAD** (median absolute
  deviation) over the trailing 3–6 months. Robust to one-off outliers, unlike a
  mean.
- **Overspend anomaly**: this period's category spend > `median + k·MAD` → flag,
  with the delta in dollars.
- **Merchant spikes**: same test at merchant level ("DoorDash $312 across 14
  orders vs your 6-mo median $180").

### 3.5 Pattern / habit detection ("rein in")

- **Lifestyle creep** — fit a trend to monthly *discretionary* spend; a
  significant positive slope = creep, quantified ("+$140/mo over 6 months").
- **Impulse clusters** — bursts of discretionary charges in short windows
  (same day/weekend), late-night spending, post-payday spikes.
- **Small-leak detection** — high-frequency small charges that sum large
  (coffee, rideshare, in-app).

### 3.6 Cut-back recommendations

Rank opportunities by `spend × deviation × discretionary-ness`:
- **Category**: "Back to your median on takeout = **$132/mo** saved."
- **Subscriptions**: "Cancel these 3 = **$47/mo → $564/yr**."
- **Merchant**: concrete, named, with the order count and amount.

Each recommendation carries the **annualized** impact, because $15/mo doesn't
feel like $180/yr until you say it that way.

---

## 4. The advisor (Claude)

The LLM receives a **structured JSON of computed facts** (insights, baselines,
top merchants, streams) and produces:
- **Digest narrative** — weekly/monthly: what happened, what to cut, what to
  watch, in plain language and your priorities.
- **Chat** — tool-use over your data: Claude calls read-only SQL/aggregation
  tools ("spend by category last month", "all charges from X") so answers are
  grounded in real rows, never guessed.

Guardrails: numbers come only from tool results; the model is instructed to
**refuse to estimate** unprovided figures and to defer judgment calls back to
you (e.g. "is this a need?").

---

## 5. Delivery

- **Proactive alerts** — a high-severity insight (new recurring charge, price
  hike, spend spike) → email now (Resend), web push later.
- **Periodic digest** — `pg_cron`/scheduled Edge Function compiles facts →
  Claude narrative → email weekly + monthly.
- **Chat on demand** — a Next.js route streaming Claude with the grounded
  data tools above.

---

## 6. Security & privacy (real financial data, even for one user)

- Bank credentials: **never stored** — Plaid handles auth.
- Plaid `access_token`: **encrypted at rest** (Supabase Vault / pgsodium).
- Secrets only in env / Supabase secrets — **never committed** (`.gitignore`
  already blocks `.env*`).
- **RLS** on every table; **2FA** on the app (Supabase Auth).
- Store **masked** account numbers only; minimize PII.
- HTTPS everywhere; short-lived sessions.
- **You own the data**: one-click export + delete, and `/item/remove` revokes
  Plaid access.

---

## 7. Cost (personal, rough — verify current pricing)

- **Plaid** production: a few linked items is small monthly cost (or use Teller
  free / SimpleFIN ~$1.50/mo).
- **Supabase**: free tier likely fine; Pro $25/mo if you outgrow it.
- **Claude API**: pennies per digest/chat.
- **Vercel + Resend**: free/hobby tiers.
- **Ballpark: under ~$20–50/mo.**

---

## 8. Roadmap

| Phase | Outcome |
|---|---|
| **0 — Scaffold** | Next.js + Supabase + Plaid **Sandbox**; link a fake bank; pull & list transactions end-to-end. |
| **1 — Ingest** | Data model + `/transactions/sync` + webhook; normalization & categorization; transactions UI. |
| **2 — Subscriptions** | Recurring detection + subscription dashboard (all streams, costs, next dates). |
| **3 — Intelligence** | Runaway detectors + baselines/anomalies + insights engine. |
| **4 — Advisor** | Grounded chat + digest generation with Claude. |
| **5 — Alerts & feedback** | Email alerts, weekly/monthly digest, "still using this?" loop. |
| **6 — Go live** | Plaid Production approval; link your real accounts; harden. |

**Start point:** Phase 0 — scaffold the app and complete one full
Sandbox link → transaction-pull loop, so the whole pipe is proven before any
real account is connected.
