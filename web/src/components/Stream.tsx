import { Children, memo, useMemo, useState, type ReactElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Hl, langOf } from "./Code";
import { copy } from "../lib/format";
import { Copy01 } from "./Icons";
import { Swap } from "./Roll";

/** Splits text into settled blocks + one live tail (the block still being written). */
export function splitBlocks(text: string, done: boolean) {
  const lines = text.split("\n");
  const blocks: string[] = [];
  let cur: string[] = [];
  let fence = false;
  lines.forEach((line, i) => {
    const isFence = /^\s*```/.test(line);
    if (isFence) fence = !fence;
    if (!fence && !isFence && line.trim() === "") {
      if (i === lines.length - 1) return;
      if (cur.length) { blocks.push(cur.join("\n")); cur = []; }
      return;
    }
    cur.push(line);
  });
  let tail = "";
  if (cur.length) {
    if (done) blocks.push(cur.join("\n"));
    else tail = cur.join("\n");
  }
  return { blocks, tail };
}

/** Wraps each word of the live block in <span class="w"> so new words blur in (CSS animation runs on mount only). */
function rehypeWords() {
  return (tree: any) => {
    const walk = (node: any, skip: boolean) => {
      if (!node.children) return;
      const out: any[] = [];
      for (const ch of node.children) {
        if (ch.type === "text" && !skip) {
          for (const part of ch.value.split(/(\s+)/)) {
            if (!part) continue;
            out.push(
              /^\s+$/.test(part)
                ? { type: "text", value: part }
                : { type: "element", tagName: "span", properties: { className: ["w"] }, children: [{ type: "text", value: part }] },
            );
          }
        } else {
          if (ch.type === "element") walk(ch, skip || ch.tagName === "pre" || ch.tagName === "code");
          out.push(ch);
        }
      }
      node.children = out;
    };
    walk(tree, false);
  };
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const hl = langOf(lang) ?? lang;
  return (
    <div className="code">
      <div className="code-head">
        <span>{lang || "text"}</span>
        <button
          className="code-copy"
          onClick={async () => { await copy(code); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
        >
          <Copy01 size={13} />
          <Swap text={copied ? "Copied" : "Copy"} />
        </button>
      </div>
      <Hl code={code} lang={hl || undefined} />
    </div>
  );
}

function Pre({ children }: { children?: ReactNode }) {
  const el = Children.toArray(children)[0] as ReactElement<{ className?: string; children?: ReactNode }> | undefined;
  const lang = /language-([\w+-]+)/.exec(el?.props?.className ?? "")?.[1] ?? "";
  const code = String(el?.props?.children ?? "").replace(/\n$/, "");
  return <CodeBlock lang={lang} code={code} />;
}

const REMARK = [remarkGfm];
const REHYPE_LIVE = [rehypeWords];
const COMPONENTS = {
  pre: Pre,
  a: ({ node: _n, ...p }: any) => <a {...p} target="_blank" rel="noreferrer noopener" />,
  table: ({ node: _n, children }: any) => <div className="tbl"><table>{children}</table></div>,
};

/** Reusable Markdown renderer (answers, thinking trace). */
export const Md = memo(function Md({ src, live = false }: { src: string; live?: boolean }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={REMARK}
        rehypePlugins={live ? REHYPE_LIVE : undefined}
        components={COMPONENTS as never}
      >
        {src}
      </ReactMarkdown>
    </div>
  );
});

export function Stream({ pieces, live }: { pieces: string[]; live: boolean }) {
  const full = useMemo(() => pieces.join(""), [pieces]);
  const { blocks, tail } = useMemo(() => splitBlocks(full, !live), [full, live]);
  return (
    <div className="prose">
      {blocks.map((b, i) => <Md key={i} src={b} />)}
      {tail && <Md key={blocks.length} src={tail} live />}
    </div>
  );
}