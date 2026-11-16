import { setSettings, useSettings } from "../lib/settings";
import type { useChat } from "../lib/useChat";
import { Effort } from "./Effort";
import { Moon, Sun } from "./Icons";
import { RateStrip } from "./RateStrip";

export function TopBar({ c }: { c: ReturnType<typeof useChat> }) {
  const s = useSettings();
  const light = s.theme === "light" || (s.theme === "system" && matchMedia("(prefers-color-scheme: light)").matches);
  return (
    <header className="tb">
      <span className="tb-brand">Bonsai</span>
      <div className="tb-r">
        <button className="tb-btn" aria-label="Toggle font" onClick={() => setSettings({ font: s.font === "sans" ? "serif" : "sans" })}>
          {s.font === "sans" ? "Sans" : "Serif"}
        </button>
        <Effort value={c.effort} onChange={c.setEffort} />
        <button className="tb-btn tb-sq" aria-label="Toggle theme" onClick={() => setSettings({ theme: light ? "dark" : "light" })}>
          {light ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <RateStrip tps={c.tps} history={c.tpsHistory} />
      </div>
    </header>
  );
}