import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "./socket";
import { getSettings, wireOpts } from "./settings";
import { wireThink, type Effort } from "./effort";
import { AUTO } from "./preview";
import type { Chat, Download, FileMeta, Msg, ModelInfo, Part, RuntimeState, ToolCall } from "./types";

const uid = () => Math.random().toString(36).slice(2, 10);
const KEY = "bonsai:chats:v1";

const loadChats = (): Chat[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.map((c: Chat) => ({
      ...c,
      messages: c.messages.map((m) => ({
        ...m,
        done: true,
        parts: m.parts.map((p): Part =>
          p.kind === "tool" && (p.call.status === "writing" || p.call.status === "running")
            ? { kind: "tool", call: { ...p.call, status: "error", summary: "Interrupted" } }
            : p),
      })),
    }));
  } catch { return []; }
};

const pack = (ms: Msg[]): Msg[] =>
  ms.map((m) => ({
    ...m,
    parts: m.parts.map((p): Part => (p.kind === "text" ? { kind: "text", pieces: [p.pieces.join("")] } : p)),
  }));

const toWire = (m: Msg) => {
  if (m.role === "user") return { role: "user", content: m.text };
  let content = m.parts.map((p) => (p.kind === "text" ? p.pieces.join("") : "")).join("").trim();
  const files = m.parts.flatMap((p) => (p.kind === "tool" && p.call.file ? [p.call.file.name] : []));
  if (files.length) content += `\n\n[files created: ${files.join(", ")}]`;
  return { role: "assistant", content };
};

export function useChat() {
  const [connected, setConnected] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [downloads, setDownloads] = useState<Record<string, Download>>({});
  const [runtime, setRuntime] = useState<RuntimeState>({ state: "idle", model: null, error: null });
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chats, setChats] = useState<Chat[]>(loadChats);
  const [activeId, setActiveId] = useState(() => uid());
  const [busy, setBusy] = useState(false);
  const [tps, setTps] = useState(0);
  const [tpsHistory, setTpsHistory] = useState<number[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [model, setModelState] = useState(() => localStorage.getItem("model") ?? "4b");
  const [effort, setEffort] = useState<Effort>(() => getSettings().effort);
  const [preview, setPreview] = useState<{ file: FileMeta; rev: number } | null>(null);

  const pending = useRef<{ k: "text" | "think"; v: string }[]>([]);
  const raf = useRef(0);
  // weighted throughput marks: {t, u} where u = token-equivalents (chars / 4.32)
  const marks = useRef<{ t: number; u: number }[]>([]);
  const meta = useRef({ n: 0, first: 0, last: 0, think: 0, units: 0 });
  const messagesRef = useRef<Msg[]>([]);
  const skipSave = useRef(false);
  const lastSave = useRef(0);
  messagesRef.current = messages;

  const patchLast = useCallback((fn: (m: Msg) => Msg) => {
    setMessages((ms) => {
      const i = ms.length - 1;
      if (i < 0 || ms[i].role !== "assistant") return ms;
      const next = ms.slice();
      next[i] = fn(ms[i]);
      return next;
    });
  }, []);

  const updateTool = useCallback((id: string, fn: (c: ToolCall) => ToolCall) => {
    patchLast((m) => ({
      ...m,
      parts: m.parts.map((p) => (p.kind === "tool" && p.call.id === id ? { kind: "tool", call: fn(p.call) } : p)),
    }));
  }, [patchLast]);

  const flush = useCallback(() => {
    raf.current = 0;
    const q = pending.current;
    if (!q.length) return;
    pending.current = [];
    patchLast((m) => {
      const parts = m.parts.slice();
      let thinking = m.thinking, thinkMs = m.thinkMs;
      const now = performance.now();
      for (const it of q) {
        if (it.k === "think") {
          thinking += it.v;
        } else {
          thinkMs ??= now - m.startedAt;
          const last = parts[parts.length - 1];
          if (last && last.kind === "text") parts[parts.length - 1] = { kind: "text", pieces: [...last.pieces, it.v] };
          else parts.push({ kind: "text", pieces: [it.v] });
        }
      }
      return { ...m, parts, thinking, thinkMs, thinkTokens: meta.current.think };
    });
  }, [patchLast]);

  const flushNow = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    flush();
  }, [flush]);

  const queue = useCallback((k: "text" | "think", v: string) => {
    pending.current.push({ k, v });
    if (!raf.current) raf.current = requestAnimationFrame(flush);
  }, [flush]);

  useEffect(() => socket.on((e) => {
    switch (e.type) {
      case "socket.open": setConnected(true); break;
      case "socket.close": setConnected(false); break;
      case "state": setModels(e.models); setDownloads(e.downloads); setRuntime(e.runtime); break;
      case "dl": setDownloads((d) => ({ ...d, [e.id]: { done: e.done, total: e.total, speed: e.speed } })); break;
      case "token": {
        const t = performance.now();
        const mt = meta.current;
        mt.n++; mt.units += 1; mt.first ||= t; mt.last = t;
        marks.current.push({ t, u: 1 });
        queue("text", e.text);
        break;
      }
      case "thinking": {
        const t = performance.now();
        const mt = meta.current;
        mt.think++; mt.units += 1; mt.first ||= t; mt.last = t;
        marks.current.push({ t, u: 1 });
        queue("think", e.text);
        break;
      }
      case "tool.start":
        flushNow();
        patchLast((m) => ({
          ...m,
          thinkMs: m.thinkMs ?? performance.now() - m.startedAt,
          parts: [...m.parts, { kind: "tool", call: { id: e.id, name: e.name, chars: 0, status: "writing" } }],
        }));
        break;
      case "tool.delta": {
        const d = e.delta ?? "";
        if (d) {
          const t = performance.now();
          const mt = meta.current;
          const u = d.length / 3.0; // code/JSON is ~3 chars/token (denser than prose)
          mt.units += u; mt.first ||= t; mt.last = t;
          marks.current.push({ t, u });
        }
        updateTool(e.id, (c) => ({ ...c, chars: e.chars, partial: (c.partial ?? "") + d }));
        break;
      }
      case "tool.run": updateTool(e.id, (c) => ({ ...c, status: "running", detail: e.detail })); break;
      case "tool.result": {
        updateTool(e.id, (c) => ({
          ...c, status: e.ok ? "done" : "error", summary: e.summary,
          file: e.file ?? undefined, meta: e.meta ?? undefined,
        }));
        if (e.file) {
          const f: FileMeta = e.file;
          setPreview((p) => (AUTO.has(f.kind) || p?.file.name === f.name ? { file: f, rev: Date.now() } : p));
        }
        break;
      }
      case "discard":
        flushNow();
        patchLast((m) => {
          const parts = m.parts.slice();
          if (parts.length && parts[parts.length - 1].kind === "text") parts.pop();
          return { ...m, parts, thinking: "" };
        });
        break;
      case "error":
        flushNow();
        if (e.scope === "chat") patchLast((m) => ({ ...m, error: e.message }));
        else setNotice(e.message);
        break;
      case "done":
        flushNow();
        patchLast((m) => {
          const mt = meta.current;
          const thinkMs = m.thinkMs ?? (m.thinking ? performance.now() - m.startedAt : undefined);
          const rate = mt.units > 1 && mt.last > mt.first ? (mt.units - 1) / ((mt.last - mt.first) / 1000) : undefined;
          return { ...m, done: true, thinkMs, tokens: Math.round(mt.units), tps: rate };
        });
        marks.current = [];
        setTps(0);
        setTpsHistory([]);
        setBusy(false);
        break;
      case "suggestions":
        setMessages((ms) => ms.map((m) => (m.id === e.id ? { ...m, suggestions: e.items } : m)));
        break;
    }
  }), [queue, flushNow, patchLast, updateTool]);

  // live tokens/sec — real generated tokens (chars/4.32) counted in a rolling 1s window
  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now();
      marks.current = marks.current.filter((m) => now - m.t < 1000);
      const v = marks.current.reduce((a, m) => a + m.u, 0); // tokens generated in the last second
      setTps((prev) => (Math.abs(prev - v) > 0.1 ? v : prev));
      if (v) setTpsHistory((h) => [...h.slice(-23), v]);
    }, 120);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!models.length) return;
    if (models.find((m) => m.id === model)?.installed) return;
    const first = models.find((m) => m.installed);
    if (first) setModelState(first.id);
  }, [models, model]);

  // history: upsert active chat (throttled ~400ms), persist when idle
  useEffect(() => {
    if (!messages.length) return;
    if (skipSave.current) { skipSave.current = false; return; }
    const wait = Math.max(0, 400 - (Date.now() - lastSave.current));
    const t = setTimeout(() => {
      lastSave.current = Date.now();
      const title = (messages.find((m) => m.role === "user")?.text ?? "New chat").replace(/\s+/g, " ").slice(0, 48);
      setChats((cs) => [
        { id: activeId, title, updatedAt: Date.now(), messages: pack(messages) },
        ...cs.filter((c) => c.id !== activeId),
      ]);
    }, wait);
    return () => clearTimeout(t);
  }, [messages, activeId]);

  useEffect(() => {
    if (busy) return;
    try { localStorage.setItem(KEY, JSON.stringify(chats.slice(0, 100))); } catch { /* quota */ }
  }, [chats, busy]);

  const newChat = useCallback(() => {
    if (busy) return;
    setPreview(null);
    setActiveId(uid());
    setMessages([]);
  }, [busy]);

  const openChat = useCallback((id: string) => {
    if (busy || id === activeId) return;
    const c = chats.find((x) => x.id === id);
    if (!c) return;
    skipSave.current = true;
    setPreview(null);
    setActiveId(id);
    setMessages(c.messages.map((m) => ({ ...m })));
  }, [busy, activeId, chats]);

  const removeChat = useCallback((id: string) => {
    if (busy && id === activeId) return;
    setChats((cs) => cs.filter((c) => c.id !== id));
    if (id === activeId) { setActiveId(uid()); setMessages([]); }
  }, [busy, activeId]);

  const pick = useCallback((id: string) => {
    setModelState(id);
    localStorage.setItem("model", id);
    socket.send({ type: "model.load", id });
  }, []);

  const send = useCallback((text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    const history = [...messagesRef.current.map(toWire), { role: "user", content: t }].filter((m) => m.content.trim());
    const aid = uid();
    const w = wireThink(effort);
    marks.current = [];
    meta.current = { n: 0, first: 0, last: 0, think: 0, units: 0 };
    setTps(0);
    setTpsHistory([]);
    setBusy(true);
    setMessages((ms) => [
      // drop stale suggestions from earlier turns
      ...ms.map((m) => (m.suggestions ? { ...m, suggestions: undefined } : m)),
      { id: uid(), role: "user", text: t, parts: [], thinking: "", done: true, startedAt: performance.now() },
      { id: aid, role: "assistant", text: "", parts: [], thinking: "", done: false, startedAt: performance.now(), effort, budget: w.think_budget },
    ]);
    socket.send({ type: "chat", id: aid, model, thinking: w.thinking, thinking_level: w.level, thinking_budget: w.think_budget, opts: wireOpts(getSettings()), messages: history });
  }, [busy, model, effort]);

  return {
    connected, models, downloads, runtime, messages, busy, tps, tpsHistory, notice, model,
    chats, activeId, openChat, newChat, removeChat,
    effort, setEffort,
    thinking: effort !== "off",
    setThinking: (v: boolean) => setEffort(v ? "medium" : "off"),
    pick, send,
    preview,
    openPreview: (file: FileMeta) => setPreview({ file, rev: Date.now() }),
    closePreview: () => setPreview(null),
    stop: () => socket.send({ type: "stop" }),
    get: (id: string) => socket.send({ type: "model.download", id }),
    cancel: (id: string) => {
      // optimistic: clear the row instantly, backend confirms via snapshot
      setDownloads((d) => { const n = { ...d }; delete n[id]; return n; });
      socket.send({ type: "model.cancel", id });
    },
    reset: newChat,
  };
}