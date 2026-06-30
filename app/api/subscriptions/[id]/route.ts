import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Record user feedback on a subscription — the "still using this?" loop.
// user_status: using | not_using | keep | cancel
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { user_status } = await req.json();
    if (!['using', 'not_using', 'keep', 'cancel'].includes(user_status)) {
      return NextResponse.json({ error: 'invalid user_status' }, { status: 400 });
    }
    const db = supabaseAdmin();
    const { error } = await db
      .from('recurring_streams')
      .update({ user_status })
      .eq('id', params.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}
