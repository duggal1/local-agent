import { AnimatePresence, motion } from "motion/react";
import { memo, useState } from "react";
import { SPRING_SOFT, copy } from "../lib/format";
import type { Msg } from "../lib/types";
import { Check, CopyIcon, Elbow } from "./Icons";
import { Swap } from "./Roll";
import { Stream } from "./Stream";
import { Thinking } from "./Thinking";
import { ToolCard } from "./ToolCard";

const fullText = (m: Msg) =>
  m.parts.map((p) => (p.kind === "text" ? p.pieces.join("") : "")).filter(Boolean).join("\n\n").trim();

function Footer({ m, text }: { m: Msg; text: string }) {
  const [copied, setCopied] = useState(false);
  const words = text.split(/\s+/).filter(Boolean).length;
  return (
    <motion.div
      className="foot"
      initial={{ opacity: 0, y: 4, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={SPRING_SOFT}
    >
      <button
        className="foot-btn"
        onClick={async () => { await copy(text); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
      >
        {copied ? <Check /> : <CopyIcon />}
        <Swap text={copied ? "Copied" : "Copy"} />
      </button>
      <span className="foot-dot" />
      <span>{words.toLocaleString()} {words === 1 ? "word" : "words"}</span>
      {m.tps !== undefined && (
        <>
          <span className="foot-dot" />
          <span>{m.tps.toFixed(1)} tok/s</span>
        </>
      )}
    </motion.div>
  );
}

function Suggestions({ items, onPick }: { items: string[]; onPick: (t: string) => void }) {
  return (
    <div className="sugg">
      {items.map((s, i) => (
        <motion.button
          key={s}
          className="sugg-item"
          onClick={() => onPick(s)}
          initial={{ opacity: 0, y: 6, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ ...SPRING_SOFT, delay: i * 0.06 }}
        >
          <span className="sugg-ico"><Elbow /></span>
          <span>{s}</span>
        </motion.button>
      ))}
    </div>
  );
}

interface Props {
  m: Msg; live: boolean; status: string; isLast: boolean; onSuggest: (t: string) => void;
}

export const Message = memo(function Message({ m, live, status, isLast, onSuggest }: Props) {
  if (m.role === "user") {
    return (
      <div className="user">
        <div className="user-bubble">{m.text}</div>
      </div>
    );
  }
  const hasThinking = m.thinking.length > 0;
  const waiting = live && m.parts.length === 0 && (m.effort !== "off" || status.startsWith("Loading"));
  const showThink = hasThinking || waiting;
  const thinkLive = live && m.thinkMs === undefined;
  const text = fullText(m);

  return (
    <div className="asst">
      <AnimatePresence initial={false}>
        {showThink && (
          <motion.div
            key="think"
            initial={{ opacity: 0, filter: "blur(6px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(6px)", height: 0 }}
            transition={SPRING_SOFT}
          >
            <Thinking
              text={m.thinking}
              live={thinkLive}
              startedAt={m.startedAt}
              ms={m.thinkMs}
              label={status.startsWith("Loading") ? "Loading model" : "Thinking"}
              tokens={m.thinkTokens ?? 0}
              budget={m.budget}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {m.parts.map((p, i) =>
        p.kind === "text" ? (
          <Stream key={i} pieces={p.pieces} live={live && i === m.parts.length - 1} />
        ) : (
          <ToolCard key={p.call.id} call={p.call} />
        ),
      )}

      {m.error && <div className="err">{m.error}</div>}
      {!live && m.done && text && <Footer m={m} text={text} />}
      {isLast && !live && m.suggestions && m.suggestions.length > 0 && (
        <Suggestions items={m.suggestions} onPick={onSuggest} />
      )}
    </div>
  );
});