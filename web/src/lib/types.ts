export interface ModelInfo { id: string; label: string; installed: boolean; bytes: number }
export interface Download { done: number; total: number; speed: number }
export interface RuntimeState { state: "idle" | "loading" | "ready" | "error"; model: string | null; error: string | null }
export interface FileMeta { name: string; size: number; kind: string; url: string; text: boolean }
export interface ToolMeta {
  skill?: { name: string; description: string };
  sources?: { title: string; url: string }[];
  query?: string;
  read?: { url: string; host: string; chars: number };
}
export interface ToolCall {
  id: string; name: string; chars: number;
  status: "writing" | "running" | "done" | "error";
  detail?: string; summary?: string; file?: FileMeta; meta?: ToolMeta;
  partial?: string;   // streamed tool-call arguments (raw JSON, possibly truncated)
}
export type Part = { kind: "text"; pieces: string[] } | { kind: "tool"; call: ToolCall };
export interface Msg {
  id: string; role: "user" | "assistant";
  text: string; parts: Part[];
  thinking: string;
  startedAt: number;          // performance.now() when the request was sent
  thinkMs?: number;           // send -> first output
  tokens?: number; tps?: number;
  effort?: import("./effort").Effort; budget?: number; thinkTokens?: number;
  suggestions?: string[];
  error?: string; done: boolean;
}
export interface Chat { id: string; title: string; updatedAt: number; messages: Msg[] }