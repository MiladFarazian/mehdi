'use client';

import { useState } from 'react';
import { Nav } from '@/components/Nav';

type Msg = { role: 'user' | 'assistant'; content: string };

const EXAMPLES = [
  'How much did I spend on takeout last month?',
  'What can I cut back on?',
  'Which subscriptions should I cancel?',
  'Where is my spending creeping up?',
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
            {EXAMPLES.map((e) => (
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
