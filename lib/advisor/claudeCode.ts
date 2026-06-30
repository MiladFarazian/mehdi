import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { tmpdir } from 'os';

// Runs Claude via the local Claude Code CLI (`claude -p`), so calls use your
// Claude Code / Max subscription instead of a metered API key. Requires the CLI
// to be installed and logged in (`claude login`) on the machine running this
// server. Works locally; NOT on a typical cloud deploy where the CLI/auth is
// absent (see docs/GOLIVE.md).

function resolveBin(): string {
  const env = process.env.CLAUDE_BIN;
  if (env && existsSync(env)) return env;
  const candidates = [
    `${process.env.HOME}/.local/bin/claude`,
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return 'claude'; // fall back to PATH
}

export function advisorAvailable(): boolean {
  return true; // resolved at call time; a missing CLI surfaces a clear error
}

// One-shot completion. We run in a neutral cwd so the CLI doesn't load this
// project's CLAUDE.md/skills, and cap turns at 1 so it answers directly.
export async function runClaudeCode(prompt: string): Promise<string> {
  const bin = resolveBin();
  const model = process.env.CLAUDE_CODE_MODEL || 'sonnet';
  const args = ['-p', '--output-format', 'json', '--max-turns', '1', '--model', model];

  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: tmpdir(), env: process.env });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e: any) =>
      reject(
        new Error(
          e?.code === 'ENOENT'
            ? 'Claude Code CLI not found. Install it and run `claude login`, or set CLAUDE_BIN in .env.local.'
            : e?.message || 'Failed to start Claude Code',
        ),
      ),
    );
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(err.trim() || `Claude Code exited with code ${code}`));
      try {
        const j = JSON.parse(out);
        if (j.is_error) return reject(new Error(j.result || 'Claude Code returned an error'));
        resolve(String(j.result ?? '').trim());
      } catch {
        resolve(out.trim());
      }
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}
