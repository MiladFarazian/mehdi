import Anthropic from '@anthropic-ai/sdk';
import { advisorTools, executeTool } from './tools';

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

export function claudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set in .env.local.');
  return new Anthropic({ apiKey });
}

const SYSTEM = `You are mehdi, a sharp but kind personal financial advisor.
You help the user understand spending, catch runaway subscriptions, and find
places to cut back.

Rules:
- Every dollar figure or percentage you state MUST come from a tool result.
  Never estimate or invent numbers. If you don't have the data, call a tool.
- When asked about spending, call query_spending; for subscriptions call
  list_subscriptions; for findings call list_insights.
- Be concise and concrete. Prefer specific merchants, amounts, and annualized
  impact ("$15/mo = $180/yr").
- Judgment calls about whether something is worth it are the user's — offer a
  recommendation, then let them decide.`;

type Msg = { role: 'user' | 'assistant'; content: string };

// Run a grounded chat turn: Claude may call read-only tools, then answers.
export async function advisorChat(history: Msg[]): Promise<string> {
  const anthropic = client();
  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  for (let hop = 0; hop < 6; hop++) {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      tools: advisorTools as unknown as Anthropic.Tool[],
      messages,
    });

    if (res.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: res.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type === 'tool_use') {
          let out: unknown;
          try {
            out = await executeTool(block.name, block.input);
          } catch (e: any) {
            out = { error: e?.message || 'tool failed' };
          }
          results.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(out),
          });
        }
      }
      messages.push({ role: 'user', content: results });
      continue;
    }

    return res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
  }
  return "I wasn't able to finish that — try asking a narrower question.";
}

// Turn a precomputed facts bundle into a friendly digest. No tools needed —
// the facts are already grounded.
export async function writeDigest(facts: unknown): Promise<string> {
  const anthropic = client();
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Write a short spending digest from these computed facts. Lead with the single
most important thing to act on, then 3-5 bullets (subscriptions to review,
categories that spiked, money you could save). Use the exact numbers given.
End with one encouraging line.

FACTS:
${JSON.stringify(facts, null, 2)}`,
      },
    ],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}
