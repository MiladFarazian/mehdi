import { NextResponse } from 'next/server';
import { getInsights } from '@/lib/db';
import { supabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!supabaseConfigured()) return NextResponse.json({ configured: false, insights: [] });
  try {
    const status = new URL(req.url).searchParams.get('status') || undefined;
    const insights = await getInsights(status);
    return NextResponse.json({ configured: true, insights });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}
