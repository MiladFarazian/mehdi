import { promises as fs } from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// PHASE 0 ONLY — a local JSON file as a stand-in for real storage.
// This keeps first-run friction to a single Plaid sandbox signup. In Phase 1
// this is replaced by Supabase Postgres with the access_token encrypted at
// rest (Supabase Vault / pgsodium). DO NOT use this in production.
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), 'data', 'local');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

export type Store = {
  accessToken?: string;
  itemId?: string;
};

export async function readStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

export async function writeStore(store: Store): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}
