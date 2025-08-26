// src/lib/normalize.ts
export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
export function minmax(n: number, min: number, max: number) {
  if (max === min) return 0.5;
  return clamp((n - min) / (max - min), 0, 1);
}
export function bucketLabel01(x: number) {
  if (x >= 0.67) return "strong";
  if (x >= 0.33) return "moderate";
  return "weak";
}
  