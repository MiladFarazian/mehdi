# Setup

## 1. Environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Var | Required | Where |
|---|---|---|
| `PLAID_CLIENT_ID`, `PLAID_SECRET` | yes | [dashboard.plaid.com](https://dashboard.plaid.com) → Team Settings → Keys (Sandbox) |
| `SUPABASE_URL` | yes | Supabase project → Settings → API → Project URL (`https://<ref>.supabase.co`) |
| `SUPABASE_SECRET_KEY` | yes | Supabase project → Settings → API keys → **secret** key (`sb_secret_…`) |
| `RESEND_API_KEY` + `ALERT_*` | optional | [resend.com](https://resend.com) for email alerts/digests |
| `APP_PASSWORD` | optional (req. to deploy) | any password; gates every page + API. Blank = no gate (fine on localhost) |
| `CRON_SECRET` | optional | any random string; protects `/api/cron` |

**Advisor (chat + digests):** no key needed — it calls your local Claude Code
CLI, so it runs on your **Claude Code / Max subscription**. Just make sure the
CLI is installed and logged in: `claude login`. (Only works where the CLI is
authenticated — your machine, not a cloud deploy.) Optional: `CLAUDE_CODE_MODEL`
(default `sonnet`), `CLAUDE_BIN` (path to the binary).

The app runs fully without the optional keys — email simply stays off until its
keys are present.

## 2. Database

Apply the schema once. Easiest path (no extra creds):

1. Supabase Dashboard → **SQL Editor** → New query.
2. Paste the contents of [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) and **Run**.

Or with the Supabase CLI (needs project ref + DB password):

```bash
supabase link --project-ref <ref>
supabase db push
```

## 3. Run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## 4. First use

1. **Link a bank** — click *Link a bank account*, choose any institution, sign
   in with sandbox creds **`user_good` / `pass_good`**.
2. **Sync now** — pulls transactions into the database.
3. **Run analysis** — detects subscriptions, baselines, and insights.
4. Explore **Subscriptions**, **Insights**, and the **Advisor** chat.

## 5. Scheduling (optional)

Deployed on Vercel, [`vercel.json`](../vercel.json) runs:
- `/api/cron` daily (sync + analyze + alert)
- `/api/cron?digest=true` weekly (also emails a digest)

Set `CRON_SECRET` in Vercel project env so the endpoint is protected. Locally
you can trigger the same work by hitting `/api/plaid/sync`, `/api/analyze`, and
`/api/digest?send=true`, or just use the dashboard buttons.
