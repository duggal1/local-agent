import { motion } from "motion/react";
import { useId, type KeyboardEvent } from "react";
import { EFFORTS, effortOf, type Effort as E } from "../lib/effort";
import { Brain } from "./Icons";

export function Effort({ value, onChange }: { value: E; onChange: (v: E) => void }) {
  const id = useId();
  const i = EFFORTS.findIndex((e) => e.id === value);
  const cap = effortOf(value).budget;

  const key = (ev: KeyboardEvent) => {
    const d = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    ev.preventDefault();
    onChange(EFFORTS[(i + d + EFFORTS.length) % EFFORTS.length].id);
  };

  return (
    <div className="eff" data-on={value !== "off"} title={cap ? `Thinking · ${cap.toLocaleString("en-US")} token cap` : "Thinking off"}>
      <span className="eff-ico"><Brain size={16} /></span>
      <div className="eff-g" role="radiogroup" aria-label="Thinking effort" onKeyDown={key}>
        {EFFORTS.map((e) => {
          const on = e.id === value;
          return (
            <button key={e.id} role="radio" aria-checked={on} tabIndex={on ? 0 : -1} className="eff-b" onClick={() => onChange(e.id)}>
              {on && <motion.span layoutId={id} className="eff-pill" transition={{ type: "spring", stiffness: 560, damping: 48 }} />}
              <span>{e.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}