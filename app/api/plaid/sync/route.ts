import { NextResponse } from 'next/server';
import { syncAllItems } from '@/lib/sync';

export const dynamic = 'force-dynamic';

// Pull the latest transactions for every linked item.
export async function POST() {
  try {
    const result = await syncAllItems();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('sync error', err?.response?.data || err);
    return NextResponse.json({ error: err?.message || 'Sync failed' }, { status: 500 });
  }
}
