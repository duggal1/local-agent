import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useLayoutEffect, useRef } from "react";
import { Composer } from "./components/Composer";
import { Message } from "./components/Message";
import { PixelMark } from "./components/PixelMark";
import { Preview } from "./components/Preview";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { Pages } from "./components/Pages";
import { Pet } from "./components/Pet";
import { SPRING, SPRING_SOFT } from "./lib/format";
import { useChat } from "./lib/useChat";
import { useNav } from "./lib/nav";
import { go } from "./lib/nav";
import { PreviewCtx } from "./lib/preview";
import { useApplySettings } from "./lib/settings";

const STARTERS = [
  "Write a one-page PDF brief on how ternary quantization works",
  "Draft a README.md for a FastAPI + Vite project",
  "Write a Python script that renames photos by their EXIF date",
  "Make a weekly study plan as a Markdown file",
];

function Empty({ connected, none, onPick }: { connected: boolean; none: boolean; onPick: (t: string) => void }) {
  const head = !connected ? "Backend offline" : none ? "Download a model" : "What are we building?";
  const sub = !connected
    ? "Start it with python run.py inside /backend."
    : none
      ? "Pick a size in the bar above. It streams straight to disk."
      : "Everything runs on this machine. Files it makes appear here to download.";
  return (
    <motion.div
      className="empty"
      initial={{ opacity: 0, filter: "blur(10px)", y: 8 }}
      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      exit={{ opacity: 0, filter: "blur(10px)" }}
      transition={SPRING_SOFT}
    >
      <PixelMark />
      <div>
        <h1>{head}</h1>
        {none && connected ? (
          <button className="btn btn-primary" onClick={() => go("models")}>Get a model</button>
        ) : (
          <p>{sub}</p>
        )}
      </div>
      {connected && !none && (
        <div className="starters">
          {STARTERS.map((s) => (
            <button key={s} className="starter" onClick={() => onPick(s)}>{s}</button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function App() {
  const c = useChat();
  useApplySettings();
  const { view } = useNav();
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const sel = c.models.find((m) => m.id === c.model);
  const ready = c.connected && !!sel?.installed;
  const none = c.models.length > 0 && !c.models.some((m) => m.installed);
  const status = c.runtime.state === "loading" ? "Loading model" : "Waiting for first token";

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [c.messages]);

  const send = (t: string) => { stick.current = true; c.send(t); };

  const placeholder = !c.connected
    ? "Backend offline"
    : none
      ? "Download a model to start"
      : !sel?.installed
        ? "Pick an installed model"
        : "Ask, or tell it to make a file";

  return (
    <MotionConfig reducedMotion="user">
      <PreviewCtx.Provider value={c.openPreview}>
      <div className="shell">
        <Sidebar
          chats={c.chats}
          activeId={c.activeId}
          busy={c.busy}
          onOpen={c.openChat}
          onNew={c.newChat}
          onRemove={c.removeChat}
        />
        {view === "chat" ? (
          <div className="app">
        <TopBar c={c} />

        <div
          className="scroll"
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
        >
          <div className="col">
            <AnimatePresence initial={false} mode="popLayout">
              {c.messages.length === 0 && <Empty key="empty" connected={c.connected} none={none} onPick={send} />}
            </AnimatePresence>
            <AnimatePresence initial={false}>
              {c.messages.map((m, i) => (
                <motion.div
                  key={m.id}
                  className="msg"
                  initial={{ opacity: 0, y: 8, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, filter: "blur(8px)" }}
                  transition={SPRING_SOFT}
                >
                  <Message m={m} live={c.busy && i === c.messages.length - 1} status={status} isLast={i === c.messages.length - 1} onSuggest={send} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <AnimatePresence>
          {c.notice && (
            <motion.div
              className="notice"
              initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 8, filter: "blur(6px)" }}
              transition={SPRING}
            >
              {c.notice}
            </motion.div>
          )}
        </AnimatePresence>

        <Composer busy={c.busy} disabled={!ready} placeholder={placeholder} onSend={send} onStop={c.stop} />
        </div>
        ) : (
          <Pages c={c} />
        )}
        <Pet busy={c.busy} />
        <AnimatePresence initial={false}>
          {c.preview && (
            <Preview key="preview" file={c.preview.file} rev={c.preview.rev} onClose={c.closePreview} />
          )}
        </AnimatePresence>
      </div>
      </PreviewCtx.Provider>
    </MotionConfig>
  );
}