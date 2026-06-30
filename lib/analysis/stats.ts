// Small, dependency-free statistics helpers. Robust estimators (median, MAD)
// are used throughout so a single outlier month can't distort a baseline.

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

// Median absolute deviation, scaled to be a consistent estimator of stdev.
export function mad(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = median(xs);
  const devs = xs.map((x) => Math.abs(x - m));
  return median(devs) * 1.4826;
}

// Coefficient of variation — used to score how "regular" intervals/amounts are.
export function coefficientOfVariation(xs: number[]): number {
  const m = mean(xs);
  if (m === 0) return Infinity;
  return stdev(xs) / Math.abs(m);
}

// Least-squares slope of y over x (used for lifestyle-creep trend detection).
export function linregSlope(ys: number[]): number {
  const n = ys.length;
  if (n < 2) return 0;
  const xs = ys.map((_, i) => i);
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function monthKey(date: string): string {
  return date.slice(0, 7); // YYYY-MM
}
