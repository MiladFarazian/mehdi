import { NextResponse } from 'next/server';
import { getStreams } from '@/lib/db';
import { supabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false, subscriptions: [] });
  try {
    const subscriptions = await getStreams();
    const monthlyTotal = subscriptions.reduce((a, s) => a + Number(s.annual_cost) / 12, 0);
    return NextResponse.json({
      configured: true,
      subscriptions,
      monthlyTotal: Number(monthlyTotal.toFixed(2)),
      annualTotal: Number(subscriptions.reduce((a, s) => a + Number(s.annual_cost), 0).toFixed(2)),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}
