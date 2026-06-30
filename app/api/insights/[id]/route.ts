import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Update an insight's status: seen | dismissed | actioned.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { status } = await req.json();
    if (!['seen', 'dismissed', 'actioned', 'new'].includes(status)) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 });
    }
    const db = supabaseAdmin();
    const { error } = await db.from('insights').update({ status }).eq('id', params.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}
