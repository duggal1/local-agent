import { useEffect, useSyncExternalStore } from "react";
import { SettingsSchema, type PetSettings, type Settings } from "./schema";

const KEY = "bonsai:settings:v1";

export const TONES = {
  default: { label: "Default", text: "" },
  concise: { label: "Concise", text: "Keep answers short and to the point." },
  casual: { label: "Casual", text: "Talk casually, like a friend who knows the subject." },
  blunt: { label: "Blunt", text: "Be blunt and direct. No filler, no hedging, no compliments before the point." },
  formal: { label: "Formal", text: "Use a polished, professional tone." },
} as const;

const read = (): Settings => {
  try {
    return SettingsSchema.parse(JSON.parse(localStorage.getItem(KEY) ?? "{}"));
  } catch {
    return SettingsSchema.parse({});
  }
};

let state = read();
const subs = new Set<() => void>();
const sub = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export const getSettings = () => state;

export function setSettings(next: Partial<Settings> | ((s: Settings) => Settings)) {
  const raw = typeof next === "function" ? next(state) : { ...state, ...next };
  state = SettingsSchema.parse(raw); // clamps + validates every write
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota */ }
  subs.forEach((f) => f());
}

export const setPet = (p: Partial<PetSettings>) => setSettings((s) => ({ ...s, pet: { ...s.pet, ...p } }));
export const resetSettings = () => setSettings(() => SettingsSchema.parse({}));
export const useSettings = () => useSyncExternalStore(sub, getSettings, getSettings);

/** What the backend gets with every chat message. The server clamps again. */
export function wireOpts(s: Settings) {
  return {
    system: [s.systemPrompt.trim(), TONES[s.tone].text].filter(Boolean).join("\n\n"),
    temperature: s.temperature,
    top_p: s.topP,
    max_tokens: s.maxTokens,
  };
}

/** Call once in App. Applies theme, accent and text size to <html>. */
export function useApplySettings() {
  const s = useSettings();
  useEffect(() => {
    const r = document.documentElement;
    const mq = matchMedia("(prefers-color-scheme: light)");
    const apply = () => { r.dataset.theme = s.theme === "system" ? (mq.matches ? "light" : "dark") : s.theme; };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [s.theme]);
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty("--accent", s.accent);
    r.style.setProperty("--accent-a", `${s.accent}26`);
    r.style.setProperty("--accent-h", `${s.accent}66`);
    r.style.setProperty("--fs", `${s.fontSize}px`);
    r.dataset.font = s.font;
  }, [s.accent, s.fontSize, s.font]);
}
