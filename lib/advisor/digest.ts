import { buildDigestFacts } from './digestFacts';
import { runClaudeCode } from './claudeCode';

const SYSTEM = `You are mehdi, a sharp but kind personal financial advisor.`;

// Generate the periodic digest narrative from precomputed, grounded facts.
export async function generateDigest(): Promise<{ digest: string; facts: unknown }> {
  const facts = await buildDigestFacts();
  const prompt = `${SYSTEM}

Write a short spending digest from these computed facts. Lead with the single most
important thing to act on, then 3-5 bullets (subscriptions to review, categories that
spiked, money you could save). Use the EXACT numbers given — never invent figures.
End with one encouraging line. Plain text, no markdown headers.

FACTS (JSON):
${JSON.stringify(facts, null, 2)}`;

  const digest = await runClaudeCode(prompt);
  return { digest, facts };
}
