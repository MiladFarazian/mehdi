'use client';

import { useEffect, useState } from 'react';
import { Nav } from '@/components/Nav';

type Msg = { role: 'user' | 'assistant'; content: string };

const BASE = [
  'What can I cut back on this month?',
  'How much am I saving each month?',
  'How is my net worth looking?',
];

// Starter questions tuned to what the analysis actually found.
const BY_INSIGHT: Record<string, string> = {
  price_creep: 'Which of my subscriptions went up in price?',
  duplicate_services: 'Which of my subscriptions overlap?',
  budget_exceeded: 'Why am I over budget this month?',
  category_overspend: 'What category did I overspend on, and why?',
  new_recurring: 'What new recurring charges started recently?',
  small_leaks: 'Where are my small charges quietly adding up?',
  annual_renewal: 'What annual charges are coming up?',
  lifestyle_creep: 'Is my spending creeping up over time?',
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>(BASE);

  useEffect(() => {
    fetch('/api/insights')
      .then((r) => r.json())
      .then((d) => {
        const types = [...new Set((d.insights || []).filter((i: any) => i.status !== 'dismissed').map((i: any) => i.type))];
        const fromData = types.map((t) => BY_INSIGHT[t as string]).filter(Boolean) as string[];
        const merged = [...new Set([...fromData, ...BASE])].slice(0, 5);
        if (merged.length) setSuggestions(merged);
      })
      .catch(() => {});
  }, []);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    setError('');
    const next: Msg[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const d = await r.json();
      if (d.error) setError(d.error);
      else setMessages((prev) => [...prev, { role: 'assistant', content: d.reply }]);
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="container">
      <Nav />
      <header>
        <h1>Advisor</h1>
        <p className="muted">Ask about your spending. Answers are grounded in your real transactions.</p>
      </header>

      <section className="card">
        <div className="chat">
          {messages.length === 0 && (
            <p className="muted">Ask a question to get started — for example:</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>
              {m.content}
            </div>
          ))}
          {busy && <div className="bubble assistant">Thinking…</div>}
        </div>

        {messages.length === 0 && (
          <div className="examples">
            {suggestions.map((e) => (
              <button key={e} className="btn ghost" onClick={() => send(e)}>
                {e}
              </button>
            ))}
          </div>
        )}

        {error && <p className="muted" style={{ color: 'var(--high)', marginTop: 10 }}>{error}</p>}

        <div className="composer">
          <input
            value={input}
            placeholder="Ask about your spending…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send(input)}
          />
          <button className="btn" disabled={busy} onClick={() => send(input)}>
            Send
          </button>
        </div>
      </section>
    </main>
  );
}
