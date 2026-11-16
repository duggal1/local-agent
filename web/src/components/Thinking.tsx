import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { SPRING_SNAPPY, SPRING_SOFT } from "../lib/format";
import { ArrowDown, ArrowUp } from "./Icons";
import { Flow } from "./Roll";
import { Md } from "./Stream";

interface Props {
  text: string; live: boolean; startedAt: number; ms?: number; label: string;
  tokens: number; budget?: number;
}
const INT = { useGrouping: true } as const;

export function Thinking({ text, live, startedAt, ms, label, tokens, budget }: Props) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => performance.now());
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(id);
  }, [live]);

  useEffect(() => {
    const el = scroller.current;
    if (el && live) el.scrollTop = el.scrollHeight;
  }, [text, live, open]);

  const secs = Math.max(0, (live ? now - startedAt : ms ?? 0) / 1000);
  const canOpen = text.length > 0;
  const hit = !!budget && tokens >= budget;

  return (
    <div className="think">
      <button className="think-btn" onClick={() => canOpen && setOpen((o) => !o)} data-static={!canOpen}>
        <span>{live ? label : "Thought for"}</span>
        <Flow className="think-time" value={secs} suffix="s" format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }} />
        {!!budget && (tokens > 0 || live) && (
          <span className="think-cap" data-live={live} data-hit={hit}>
            <span className="think-meter" style={{ "--p": Math.min(1, tokens / budget) } as CSSProperties}><i /></span>
            <Flow value={tokens} format={INT} />
            <span>/ {budget.toLocaleString("en-US")}</span>
            {hit && <span>· capped</span>}
          </span>
        )}
        {canOpen && (
          <AnimatePresence initial={false} mode="wait">
            <motion.span
              key={open ? "up" : "down"} className="think-ico"
              initial={{ opacity: 0, filter: "blur(3px)" }} animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(3px)" }} transition={SPRING_SNAPPY}
            >
              {open ? <ArrowUp /> : <ArrowDown />}
            </motion.span>
          </AnimatePresence>
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && canOpen && (
          <motion.div
            className="think-body"
            initial={{ height: 0, opacity: 0, filter: "blur(6px)" }}
            animate={{ height: "auto", opacity: 1, filter: "blur(0px)" }}
            exit={{ height: 0, opacity: 0, filter: "blur(6px)" }}
            transition={SPRING_SOFT}
          >
            <div className="think-scroll" ref={scroller}><Md src={text} live={live} /></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}