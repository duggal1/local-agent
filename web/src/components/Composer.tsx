import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SPRING_SNAPPY } from "../lib/format";

interface Props {
  busy: boolean;
  disabled: boolean;
  placeholder: string;
  onSend: (t: string) => void;
  onStop: () => void;
}

export function Composer({ busy, disabled, placeholder, onSend, onStop }: Props) {
  const [v, setV] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current!;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [v]);

  useEffect(() => { if (!disabled) ref.current?.focus(); }, [disabled]);

  const submit = () => {
    if (!v.trim() || disabled || busy) return;
    onSend(v);
    setV("");
  };

  return (
    <div className="composer-wrap">
      <div className="composer">
        <textarea
          ref={ref}
          rows={1}
          value={v}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
            if (e.key === "Escape" && busy) onStop();
          }}
        />
        <button
          className="send"
          data-busy={busy}
          disabled={!busy && (disabled || !v.trim())}
          onClick={busy ? onStop : submit}
          aria-label={busy ? "Stop" : "Send"}
        >
          <AnimatePresence initial={false} mode="wait">
            <motion.span
              key={busy ? "stop" : "send"}
              className="send-ico"
              initial={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
              transition={SPRING_SNAPPY}
            >
              {busy ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              )}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
      <div className="hint">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 10l-5 5 5 5" />
          <path d="M20 4v7a4 4 0 0 1-4 4H4" />
        </svg>
        send
        <span className="dim">·</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 19V5M19 12l-7-7-7 7" />
        </svg>
        newline
        <span className="dim">·</span>
        <span style={{ font: "500 12px var(--sans)" }}>Esc</span>
        stop
      </div>
    </div>
  );
}