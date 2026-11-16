import type { Settings } from "./schema";

export type Effort = Settings["effort"];

export const EFFORTS: { id: Effort; label: string; wire: "low" | "medium" | "xhigh" | null; budget: number }[] = [
  { id: "off", label: "Off", wire: null, budget: 0 },
  { id: "low", label: "Low", wire: "low", budget: 512 },
  { id: "medium", label: "Med", wire: "medium", budget: 2048 },
  { id: "high", label: "High", wire: "xhigh", budget: 8192 },
];

export const effortOf = (id: Effort) => EFFORTS.find((e) => e.id === id) ?? EFFORTS[2];

export function wireThink(id: Effort) {
  const e = effortOf(id);
  return { thinking: e.wire !== null, level: e.wire, think_budget: e.budget };
}