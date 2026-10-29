export const mean = (x: number[]) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : NaN);
export function median(x: number[]) {
  if (!x.length) return NaN;
  const s = [...x].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
/** Sample standard deviation (n-1). NaN for n<2. */
export function std(x: number[]) {
  if (x.length < 2) return NaN;
  const m = mean(x);
  return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / (x.length - 1));
}
/** Linear-interpolated percentile, p in [0,100]. */
export function percentile(x: number[], p: number) {
  if (!x.length) return NaN;
  const s = [...x].sort((a, b) => a - b);
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}
const T95: Record<number, number> = { 1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228, 15: 2.131, 20: 2.086, 30: 2.042 };
function tCrit(df: number) {
  const keys = Object.keys(T95).map(Number).sort((a, b) => a - b);
  for (const k of keys) if (df <= k) return T95[k];
  return 1.96;
}
/** 95% CI for the mean using Student's t. Returns null when n < 3 (insufficient trials). */
export function ci95(x: number[]): [number, number] | null {
  if (x.length < 3) return null;
  const h = (tCrit(x.length - 1) * std(x)) / Math.sqrt(x.length);
  return [mean(x) - h, mean(x) + h];
}
/** Ordinary least squares y = a + b·x. */
export function ols(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n < 3 || new Set(xs).size < 2) return null;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  const resid = ys.map((y, i) => y - (intercept + slope * xs[i]));
  const se = Math.sqrt(resid.reduce((a, r) => a + r * r, 0) / (n - 2) / sxx);
  return { slope, intercept, r2, n, slopeSE: se, slopeCI: [slope - tCrit(n - 2) * se, slope + tCrit(n - 2) * se] as [number, number] };
}
export function describe(x: number[]) {
  return { n: x.length, mean: mean(x), median: median(x), std: std(x), p50: percentile(x, 50), p95: x.length >= 20 ? percentile(x, 95) : NaN, ci: ci95(x) };
}
