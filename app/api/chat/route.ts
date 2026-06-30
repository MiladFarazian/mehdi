import { NextResponse } from 'next/server';
import { advisorChat, claudeConfigured } from '@/lib/advisor/claude';
import { supabaseAdmin, supabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!claudeConfigured()) {
    return NextResponse.json(
      { error: 'Set ANTHROPIC_API_KEY in .env.local to use the advisor.' },
      { status: 400 },
    );
  }
  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 });
    }

    const reply = await advisorChat(messages);

    // Best-effort: persist the latest exchange for history.
    if (supabaseConfigured()) {
      const db = supabaseAdmin();
      const last = messages[messages.length - 1];
      await db.from('chat_messages').insert([
        { role: 'user', content: String(last?.content ?? '') },
        { role: 'assistant', content: reply },
      ]);
    }

    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error('chat error', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Chat failed' }, { status: 500 });
  }
}
