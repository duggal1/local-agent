import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { ArrowDown, Check } from "./Icons";
import { Flow } from "./Roll";
import type { Format } from "@number-flow/react";

/** Stagger index for the .rise entrance. */
export const I = (n: number) => ({ "--i": n }) as CSSProperties;

export function Head({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="pg-head rise">
      <h1 className="pg-title">{title}</h1>
      {sub && <p className="pg-sub">{sub}</p>}
    </header>
  );
}

export const Group = ({ children, i = 1 }: { children: ReactNode; i?: number }) => (
  <div className="group rise" style={I(i)}>{children}</div>
);

export function Row({ title, desc, children, stack }: { title: string; desc?: string; children: ReactNode; stack?: boolean }) {
  return (
    <div className="srow" data-stack={stack}>
      <div className="row-t">
        <div className="row-h">{title}</div>
        {desc && <div className="row-d">{desc}</div>}
      </div>
      <div className="row-c">{children}</div>
    </div>
  );
}

export function Slider({
  value, min, max, step, onChange, format, unit,
}: {
  value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format?: Format; unit?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="sl">
      <input
        className="range" type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ "--p": `${pct}%` } as CSSProperties}
      />
      <Flow className="sl-val" value={value} suffix={unit} format={format} />
    </div>
  );
}

export function Segmented<T extends string>({
  value, options, onChange,
}: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button key={o.value} className="seg-b" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.value === value && (
            <motion.span layoutId={id} className="seg-pill" transition={{ type: "spring", stiffness: 520, damping: 44 }} />
          )}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={value} className="tg" data-on={value} onClick={() => onChange(!value)}>
      <motion.span layout className="tg-k" transition={{ type: "spring", stiffness: 600, damping: 40 }} />
    </button>
  );
}

function Hex({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [d, setD] = useState(value);
  useEffect(() => setD(value), [value]);
  return (
    <input
      className="hex" value={d} maxLength={7} spellCheck={false} aria-label="Hex color"
      onChange={(e) => {
        const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
        setD(v);
        if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v);
      }}
      onBlur={() => setD(value)}
    />
  );
}

export function Swatches({ value, colors, onChange }: { value: string; colors: string[]; onChange: (v: string) => void }) {
  return (
    <div className="sw">
      {colors.map((c) => (
        <button
          key={c} className="sw-b" aria-label={c}
          data-on={c.toLowerCase() === value.toLowerCase()}
          style={{ "--c": c } as CSSProperties}
          onClick={() => onChange(c)}
        />
      ))}
      <label className="sw-custom" title="Custom color">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <span style={{ background: value }} />
      </label>
      <Hex value={value} onChange={onChange} />
    </div>
  );
}

export function Select({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const label = options.find((o) => o.value === value)?.label ?? value;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: globalThis.MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const pop = root.current?.querySelector<HTMLDivElement>(".dd-pop");
    const sel = pop?.querySelector<HTMLButtonElement>('[data-on="true"]') ?? pop?.querySelector<HTMLButtonElement>(".dd-item");
    sel?.focus();
  }, [open]);

  const onKey = (e: KeyboardEvent) => {
    if (!open) return;
    const items = [...(root.current?.querySelectorAll<HTMLButtonElement>(".dd-item") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      btn.current?.focus();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const d = e.key === "ArrowDown" ? 1 : -1;
      items[(i + d + items.length) % items.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className="dd" ref={root} onKeyDown={onKey}>
      <button
        ref={btn}
        type="button"
        className="dd-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{label}</span>
        <span className="dd-chev"><ArrowDown size={14} /></span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="dd-pop"
            role="listbox"
            aria-label={label}
            initial={{ opacity: 0, scale: 0.97, y: -3, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.98, y: -2, filter: "blur(4px)" }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            {options.map((o) => {
              const on = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={on}
                  className="dd-item"
                  data-on={on}
                  onClick={() => { onChange(o.value); setOpen(false); btn.current?.focus(); }}
                >
                  <span>{o.label}</span>
                  {on && <span className="dd-check"><Check size={14} /></span>}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
