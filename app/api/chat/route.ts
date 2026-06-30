import { NextResponse } from 'next/server';
import { runClaudeCode } from '@/lib/advisor/claudeCode';
import { buildFinancialContext } from '@/lib/advisor/context';
import { supabaseAdmin, supabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const SYSTEM = `You are mehdi, a sharp but kind personal financial advisor. You help the
user understand their spending, catch runaway subscriptions, and find places to cut back.

Rules:
- Use ONLY numbers found in the DATA below. Never invent or estimate figures. If the
  answer isn't in the data, say so plainly.
- Be concise and concrete: name specific merchants, amounts, and annualized impact
  ("$15/mo = $180/yr").
- Offer a clear recommendation, but leave judgment calls (is it worth it?) to the user.
- Do not use any tools. Answer directly from the DATA and CONVERSATION.`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 });
    }

    const context = supabaseConfigured() ? await buildFinancialContext() : {};
    const convo = messages
      .map((m: { role: string; content: string }) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const prompt = `${SYSTEM}

DATA (the user's real financial data, as JSON):
${JSON.stringify(context)}

CONVERSATION:
${convo}

Reply as the advisor to the latest USER message. Plain text, no markdown headers.`;

    const reply = await runClaudeCode(prompt);

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
