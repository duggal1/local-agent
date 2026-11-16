import { useSyncExternalStore } from "react";

export type View = "chat" | "models" | "settings";
export type Section = "overview" | "prompt" | "model" | "appearance" | "pet";

let state = { view: "chat" as View, section: "overview" as Section };
const subs = new Set<() => void>();
const sub = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export function go(view: View, section: Section = "overview") {
  if (state.view === view && state.section === section) return;
  state = { view, section };
  subs.forEach((f) => f());
}

export const useNav = () => useSyncExternalStore(sub, () => state, () => state);
