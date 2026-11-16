import { useState } from "react";
import { go, type Section } from "../../lib/nav";
import { TONES, resetSettings, setPet, setSettings, useSettings } from "../../lib/settings";
import { Effort } from "../Effort";
import { ArrowUpRight } from "../Icons";
import { PetSvg } from "../Pet";
import { Flow } from "../Roll";
import { SECTIONS } from "../sections";
import { Group, Head, I, Row, Select, Slider, Swatches, Toggle } from "../ui";

const ACCENTS = ["#ff6a13", "#ff8a00", "#ff3d71", "#8b5cf6", "#22c55e", "#38bdf8", "#f5f5f4"];
const PET_COLORS = ["#ea580c", "#ff6a13", "#f43f5e", "#a78bfa", "#34d399", "#38bdf8", "#facc15", "#fafafa"];
const int = { useGrouping: false };
const two = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

export function Overview() {
  const s = useSettings();
  const summary: Record<string, string> = {
    prompt: `${TONES[s.tone].label} tone · ${s.systemPrompt.trim() ? "custom prompt" : "default prompt"}`,
    model: `Temp ${s.temperature.toFixed(2)} · top-p ${s.topP.toFixed(2)} · ${s.effort} thinking`,
    appearance: `${s.theme[0].toUpperCase() + s.theme.slice(1)} · ${s.accent} · ${s.fontSize}px`,
    pet: s.pet.enabled ? `On · ${s.pet.behavior} · ${s.pet.color}` : "Off",
  };
  return (
    <>
      <Head title="Settings" sub="Saved on this device." />
      <div className="ov">
        {SECTIONS.filter((x) => x.id !== "overview").map((x, i) => (
          <button key={x.id} className="ov-card rise" style={I(i + 1)} onClick={() => go("settings", x.id)}>
            <span className="ov-ico"><x.Icon size={22} /></span>
            <span className="ov-t">{x.label}</span>
            <span className="ov-s">{summary[x.id]}</span>
            <span className="ov-go"><ArrowUpRight size={16} /></span>
          </button>
        ))}
      </div>
      <div className="foot-actions rise" style={I(5)}>
        <button className="btn" onClick={resetSettings}>Reset everything</button>
      </div>
    </>
  );
}

function Prompt() {
  const s = useSettings();
  const tone = TONES[s.tone];
  return (
    <>
      <Head title="Behavior" sub="How Bonsai talks to you." />
      <Group i={1}>
        <Row title="Tone" desc={tone.text || "Ships with Bonsai's built-in voice."}>
          <Select
            value={s.tone}
            options={(Object.keys(TONES) as (keyof typeof TONES)[]).map((k) => ({ value: k, label: TONES[k].label }))}
            onChange={(t) => setSettings({ tone: t as any })}
          />
        </Row>
        <Row title="System prompt" desc="Appended to Bonsai's built-in rules." stack>
          <textarea
            className="ta" rows={10} maxLength={8000} value={s.systemPrompt}
            placeholder="Extra instructions for the model..."
            onChange={(e) => setSettings({ systemPrompt: e.target.value })}
          />
          <div className="ta-foot">
            <span><Flow className="ta-count" value={s.systemPrompt.length} format={int} /> / 8000</span>
            <button className="link" onClick={() => setSettings({ systemPrompt: "" })}>Clear</button>
          </div>
        </Row>
      </Group>
      <div className="pg-note rise" style={I(2)}>Tone and custom instructions apply to new messages.</div>
    </>
  );
}

function Model() {
  const s = useSettings();
  return (
    <>
      <Head title="Model" sub="Sampling and reasoning defaults." />
      <Group>
        <Row title="Temperature" desc="Low is focused. High is looser.">
          <Slider value={s.temperature} min={0} max={2} step={0.05} format={two} onChange={(temperature) => setSettings({ temperature })} />
        </Row>
        <Row title="Top-p" desc="Sample only from the top slice of probability.">
          <Slider value={s.topP} min={0.05} max={1} step={0.05} format={two} onChange={(topP) => setSettings({ topP })} />
        </Row>
        <Row title="Max tokens" desc="Per step. Keep it high if the agent writes files.">
          <Slider value={s.maxTokens} min={256} max={32768} step={256} format={int} onChange={(maxTokens) => setSettings({ maxTokens })} />
        </Row>
        <Row title="Thinking" desc="Default for new chats. Medium suits an 8 GB M1.">
          <Effort value={s.effort} onChange={(effort) => setSettings({ effort })} />
        </Row>
        <Row title="Models" desc="Download or switch the model that runs.">
          <button className="btn" onClick={() => go("models")}>Manage models</button>
        </Row>
      </Group>
    </>
  );
}

function Appearance() {
  const s = useSettings();
  return (
    <>
      <Head title="Appearance" sub="Theme, accent, font and text size." />
      <Group>
        <Row title="Theme">
          <Select
            value={s.theme}
            options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }, { value: "system", label: "System" }]}
            onChange={(theme) => setSettings({ theme: theme as any })}
          />
        </Row>
        <Row title="Font">
          <Select
            value={s.font}
            options={[{ value: "sans", label: "Sans" }, { value: "serif", label: "Serif" }]}
            onChange={(font) => setSettings({ font: font as any })}
          />
        </Row>
        <Row title="Accent" desc="Buttons, progress and live numbers." stack>
          <Swatches value={s.accent} colors={ACCENTS} onChange={(accent) => setSettings({ accent })} />
        </Row>
        <Row title="Text size" desc="Messages and answers.">
          <Slider value={s.fontSize} min={13} max={18} step={1} unit="px" format={int} onChange={(fontSize) => setSettings({ fontSize })} />
        </Row>
      </Group>
    </>
  );
}

function PetPage() {
  const s = useSettings();
  const [walk, setWalk] = useState(false);
  const p = s.pet;
  return (
    <>
      <Head title="Pet" sub="Your agent avatar. It lives at the bottom of the window." />
      <div className="pet-stage rise" style={I(1)} onPointerEnter={() => setWalk(true)} onPointerLeave={() => setWalk(false)}>
        <PetSvg color={p.color} size={Math.max(72, p.size * 1.8)} walking={walk} blink={p.blink} />
        <i className="pet-ground" />
      </div>
      <Group i={2}>
        <Row title="Show pet"><Toggle value={p.enabled} onChange={(enabled) => setPet({ enabled })} /></Row>
        <Row title="Color" desc="Pick one or paste any hex." stack>
          <Swatches value={p.color} colors={PET_COLORS} onChange={(color) => setPet({ color })} />
        </Row>
        <Row title="Size">
          <Slider value={p.size} min={24} max={96} step={2} unit="px" format={int} onChange={(size) => setPet({ size })} />
        </Row>
        <Row title="Speed">
          <Slider value={p.speed} min={0.4} max={2} step={0.1} unit="x" format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }} onChange={(speed) => setPet({ speed })} />
        </Row>
        <Row title="Behavior" desc="Roam wanders. Left and Right park it in a corner.">
          <Select
            value={p.behavior}
            options={[{ value: "roam", label: "Roam" }, { value: "left", label: "Left" }, { value: "right", label: "Right" }, { value: "still", label: "Still" }]}
            onChange={(behavior) => setPet({ behavior: behavior as any })}
          />
        </Row>
        <Row title="Blinking"><Toggle value={p.blink} onChange={(blink) => setPet({ blink })} /></Row>
      </Group>
    </>
  );
}

export function SettingsSection({ section }: { section: Section }) {
  switch (section) {
    case "prompt": return <Prompt />;
    case "model": return <Model />;
    case "appearance": return <Appearance />;
    case "pet": return <PetPage />;
    default: return <Overview />;
  }
}