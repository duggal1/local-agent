import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { SPRING_SOFT } from "../lib/format";
import { go, useNav } from "../lib/nav";
import type { Chat } from "../lib/types";
import { ArrowLeft, Close, Download, PanelLeft, Plus, Settings } from "./Icons";
import { SECTIONS } from "./sections";

interface Props {
  chats: Chat[]; activeId: string; busy: boolean;
  onOpen: (id: string) => void; onNew: () => void; onRemove: (id: string) => void;
}

const panel = {
  initial: { opacity: 0, x: -10, filter: "blur(6px)" },
  animate: { opacity: 1, x: 0, filter: "blur(0px)" },
  exit: { opacity: 0, x: -10, filter: "blur(6px)" },
  transition: SPRING_SOFT,
};

function group(ts: number) {
  const d0 = new Date();
  d0.setHours(0, 0, 0, 0);
  const day = 864e5;
  if (ts >= d0.getTime()) return "Today";
  if (ts >= d0.getTime() - day) return "Yesterday";
  if (ts >= d0.getTime() - 7 * day) return "Previous 7 days";
  return "Older";
}

function Item({ icon, label, active, open, onClick }: { icon: ReactNode; label: string; active: boolean; open: boolean; onClick: () => void }) {
  return (
    <button className="sb-item" data-active={active} onClick={onClick} title={label}>
      {active && <motion.span layoutId="sb-pill" className="sb-pill" transition={{ type: "spring", stiffness: 520, damping: 44 }} />}
      <span className="sb-ico">{icon}</span>
      {open && <span className="sb-label">{label}</span>}
    </button>
  );
}

export function Sidebar({ chats, activeId, busy, onOpen, onNew, onRemove }: Props) {
  const { view, section } = useNav();
  const [open, setOpen] = useState(() => localStorage.getItem("sidebar") !== "0");
  const toggle = () => setOpen((o) => { localStorage.setItem("sidebar", o ? "0" : "1"); return !o; });
  const inSettings = view === "settings";

  const rows: ({ k: "g"; label: string } | { k: "c"; chat: Chat })[] = [];
  let prev = "";
  for (const c of chats) {
    const g = group(c.updatedAt);
    if (g !== prev) { rows.push({ k: "g", label: g }); prev = g; }
    rows.push({ k: "c", chat: c });
  }
  const newChat = () => { go("chat"); onNew(); };

  return (
    <motion.aside className="side" data-open={open} initial={false} animate={{ width: open ? 272 : 56 }} transition={SPRING_SOFT}>
      <div className="side-top">
        <button className="icon-btn" onClick={toggle} aria-label="Toggle sidebar"><PanelLeft size={18} /></button>
        {inSettings ? (
          open
            ? <button className="new-btn" onClick={() => go("chat")}><ArrowLeft size={18} /><span>Back to chat</span></button>
            : <button className="icon-btn" onClick={() => go("chat")} aria-label="Back to chat"><ArrowLeft size={18} /></button>
        ) : open ? (
          <button className="new-btn" onClick={newChat} disabled={busy}><Plus size={18} /><span>New chat</span></button>
        ) : (
          <button className="icon-btn" onClick={newChat} disabled={busy} aria-label="New chat"><Plus size={18} /></button>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {inSettings ? (
          <motion.div key="settings" className="sb-panel" {...panel}>
            {open && <div className="sb-title">Settings</div>}
            <nav className="sb-nav">
              {SECTIONS.map((s) => (
                <Item key={s.id} label={s.label} open={open} active={section === s.id} icon={<s.Icon size={20} />} onClick={() => go("settings", s.id)} />
              ))}
            </nav>
          </motion.div>
        ) : (
          <motion.div key="main" className="sb-panel" {...panel}>
            <nav className="sb-nav">
              <Item label="Models" open={open} active={view === "models"} icon={<Download size={20} />} onClick={() => go("models")} />
              <Item label="Settings" open={open} active={false} icon={<Settings size={20} />} onClick={() => go("settings")} />
            </nav>
            {open && (
              <nav className="side-list">
                {rows.length === 0 && <div className="side-empty">No chats yet</div>}
                <AnimatePresence initial={false}>
                  {rows.map((r) =>
                    r.k === "g" ? (
                      <motion.div key={`g-${r.label}`} layout="position" className="grp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        {r.label}
                      </motion.div>
                    ) : (
                      <motion.div
                        key={r.chat.id} layout="position" className="chat-item"
                        data-active={view === "chat" && r.chat.id === activeId}
                        role="button" tabIndex={0}
                        onClick={() => { go("chat"); onOpen(r.chat.id); }}
                        onKeyDown={(e) => e.key === "Enter" && (go("chat"), onOpen(r.chat.id))}
                        initial={{ opacity: 0, filter: "blur(6px)" }} animate={{ opacity: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, filter: "blur(6px)" }} transition={SPRING_SOFT}
                      >
                        <span className="chat-title">{r.chat.title}</span>
                        <button className="chat-del" aria-label="Delete chat" onClick={(e) => { e.stopPropagation(); onRemove(r.chat.id); }}>
                          <Close size={14} />
                        </button>
                      </motion.div>
                    ),
                  )}
                </AnimatePresence>
              </nav>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}