// Single source of truth for "today" (UTC, YYYY-MM-DD) used by the analysis engine.
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
