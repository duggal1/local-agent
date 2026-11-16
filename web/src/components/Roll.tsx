import NumberFlow, { type Format } from "@number-flow/react";
import { AnimatePresence, motion } from "motion/react";
import { SPRING_SNAPPY } from "../lib/format";

const EASE_CSS = "cubic-bezier(0.2, 0.7, 0.2, 1)";

/** NumberFlow — digits roll, no blur. */
export function Flow({
  value, suffix, format, className = "",
}: { value: number; suffix?: string; format?: Format; className?: string }) {
  return (
    <span className={`flow ${className}`}>
      <NumberFlow
        value={value}
        suffix={suffix}
        format={format}
        willChange
        transformTiming={{ duration: 260, easing: EASE_CSS }}
        spinTiming={{ duration: 260, easing: EASE_CSS }}
        opacityTiming={{ duration: 180, easing: "ease-out" }}
      />
    </span>
  );
}

/** Drop-in for the old Roll: numbers inside the string roll, everything else is plain text. */
export function Roll({ value, className = "" }: { value: string; className?: string }) {
  const parts = value.split(/(\d+(?:\.\d+)?)/);
  return (
    <span className={`roll ${className}`}>
      {parts.map((p, i) => {
        if (i % 2 === 0) return p ? <span key={i}>{p.replace(/ /g, "\u00a0")}</span> : null;
        const [int, frac = ""] = p.split(".");
        return (
          <Flow
            key={i}
            value={Number(p)}
            format={{
              useGrouping: false,
              minimumIntegerDigits: int.length,
              minimumFractionDigits: frac.length,
              maximumFractionDigits: frac.length,
            }}
          />
        );
      })}
    </span>
  );
}

/** Text swap with blur crossfade. */
export function Swap({ text }: { text: string }) {
  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.span
        key={text}
        style={{ display: "inline-block" }}
        initial={{ opacity: 0, filter: "blur(4px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, filter: "blur(4px)" }}
        transition={SPRING_SNAPPY}
      >
        {text}
      </motion.span>
    </AnimatePresence>
  );
}