export const bytes = (n: number) =>
  n >= 1e9 ? (n / 1e9).toFixed(2) + " GB" : n >= 1e6 ? (n / 1e6).toFixed(0) + " MB" : n >= 1e3 ? (n / 1e3).toFixed(0) + " KB" : n + " B";

export const rate = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + " MB/s" : (n / 1e3).toFixed(0) + " KB/s";

export const copy = (t: string) => navigator.clipboard.writeText(t);

export const EASE = [0.16, 1, 0.3, 1] as const;

/** Signature spring: buttery, no overshoot wobble. Entrances, layout, popups. */
export const SPRING = { type: "spring", stiffness: 300, damping: 32, mass: 0.9 } as const;
/** Softer spring for large surfaces (pages, cards, messages). */
export const SPRING_SOFT = { type: "spring", stiffness: 200, damping: 26, mass: 1 } as const;
/** Snappy spring for small swaps (icons, labels). */
export const SPRING_SNAPPY = { type: "spring", stiffness: 480, damping: 36, mass: 0.7 } as const;