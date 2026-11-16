import { useDeferredValue, useMemo } from "react";
import hljs from "highlight.js/lib/common";

/** Map a filename or bare extension to a highlight.js language name. */
export function langOf(name: string): string | undefined {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    py: "python", js: "javascript", mjs: "javascript", cjs: "javascript",
    ts: "typescript", tsx: "typescript", jsx: "javascript",
    json: "json", md: "markdown", markdown: "markdown",
    html: "xml", htm: "xml", xml: "xml", svg: "xml",
    css: "css", scss: "scss", less: "less",
    sh: "bash", bash: "bash", zsh: "bash", yml: "yaml", yaml: "yaml",
    toml: "ini", ini: "ini", sql: "sql", rs: "rust", go: "go",
    java: "java", c: "c", h: "c", cpp: "cpp", cc: "cpp", hpp: "cpp",
    cs: "csharp", php: "php", rb: "ruby", lua: "lua", swift: "swift",
    kt: "kotlin", diff: "diff", patch: "diff", dockerfile: "dockerfile",
  };
  return map[ext];
}

/** Tolerant JSON-string unescape. Handles truncated tails mid-escape. */
export function unescape(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch !== "\\") { out += ch; continue; }
    const n = s[i + 1];
    if (n === undefined) break;
    if (n === "n") out += "\n";
    else if (n === "t") out += "\t";
    else if (n === "r") out += "\r";
    else if (n === '"') out += '"';
    else if (n === "\\") out += "\\";
    else if (n === "/") out += "/";
    else if (n === "u" && /^[0-9a-fA-F]{4}$/.test(s.slice(i + 2, i + 6))) {
      out += String.fromCharCode(parseInt(s.slice(i + 2, i + 6), 16));
      i += 4;
    } else out += n;
    i++;
  }
  return out;
}

/** Extract a string field value from partial tool-call JSON args. */
export function fieldString(args: string, key: string): string | null {
  const i = args.indexOf(`"${key}"`);
  if (i < 0) return null;
  const rest = args.slice(i + key.length + 2);
  const colon = rest.indexOf(":");
  if (colon < 0) return null;
  const q = rest.indexOf('"', colon);
  if (q < 0) return null;
  const body = rest.slice(q + 1);
  let out = "";
  for (let j = 0; j < body.length; j++) {
    const ch = body[j];
    if (ch === "\\") {
      const n = body[j + 1];
      if (n === undefined) break;
      if (n === "n") out += "\n";
      else if (n === "t") out += "\t";
      else if (n === '"') out += '"';
      else if (n === "\\") out += "\\";
      else out += n;
      j++;
      continue;
    }
    if (ch === '"') return out;
    out += ch;
  }
  return out;
}

/** Index just past the opening quote of the "content" field, or -1. */
export function contentStart(args: string): number {
  const i = args.indexOf('"content"');
  if (i < 0) return -1;
  const rest = args.slice(i);
  const colon = rest.indexOf(":");
  if (colon < 0) return -1;
  const q = rest.indexOf('"', colon);
  if (q < 0) return -1;
  return i + q + 1;
}

/** Syntax-highlighted code block. Cheap: deferred + memoized so streaming stays smooth. */
export function Hl({ code, lang, className = "" }: { code: string; lang?: string; className?: string }) {
  const deferred = useDeferredValue(code);
  const html = useMemo(() => {
    if (!deferred) return "";
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(deferred, { language: lang }).value;
      }
      return hljs.highlightAuto(deferred).value;
    } catch {
      return null;
    }
  }, [deferred, lang]);
  return (
    <pre className={`hljs ${className}`}>
      {html === null
        ? <code>{deferred}</code>
        : <code dangerouslySetInnerHTML={{ __html: html }} />}
    </pre>
  );
}

/** Highlighted inline block (no pre wrapper) for tool previews. */
export function HlCode({ code, lang }: { code: string; lang?: string }) {
  const deferred = useDeferredValue(code);
  const html = useMemo(() => {
    if (!deferred) return "";
    try {
      if (lang && hljs.getLanguage(lang)) return hljs.highlight(deferred, { language: lang }).value;
      return hljs.highlightAuto(deferred).value;
    } catch {
      return "";
    }
  }, [deferred, lang]);
  return <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />;
}