# Going live with real accounts

Phase 0–5 run entirely on Plaid **Sandbox** (fake banks). To connect your real
bank/credit-card accounts, move to Plaid **Production**.

## 1. Plaid Production

1. In the Plaid Dashboard, request **Production access** (a short form; approval
   is usually fast for personal use). Verify current pricing first.
2. Get your **Production** secret. In `.env.local` set:
   ```
   PLAID_ENV=production
   PLAID_SECRET=<your production secret>
   ```
3. Add a **webhook URL** in the Plaid Dashboard pointing to
   `https://<your-deploy>/api/plaid/webhook` so new transactions sync
   automatically.

## 2. Harden before connecting real money

- [ ] **Add auth.** The app currently assumes a single trusted user on
      localhost. Before deploying publicly, gate every page/route behind
      Supabase Auth (and 2FA). Until then, do **not** expose it on the internet.
- [ ] **Encrypt the Plaid `access_token` at rest.** Replace the plaintext
      `plaid_items.access_token` column with Supabase Vault / pgsodium. (Marked
      `TODO(prod)` in the migration.)
- [ ] **Verify Plaid webhook JWTs** in `/api/plaid/webhook` (marked
      `NOTE(prod)`), so only Plaid can trigger syncs.
- [ ] **Set `CRON_SECRET`** in the deploy environment.
- [ ] **Rotate any secrets** that were ever shared in chat/docs.
- [ ] Confirm RLS is on (it is, in the migration) and that the secret key is
      only ever used server-side.

## 3. Deploy

- Push to GitHub → import into **Vercel**.
- Add all `.env.local` vars to the Vercel project (Production env).
- `vercel.json` schedules the daily sync/analyze and weekly digest.

## 4. Data ownership

- Export: query the `transactions` / `recurring_streams` tables, or add an
  export route.
- Delete: removing a row from `plaid_items` cascades to its accounts and
  transactions. Call Plaid `/item/remove` to revoke access on Plaid's side too.
