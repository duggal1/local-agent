import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { EASE, bytes, copy } from "../lib/format";
import { usePreviewOpen } from "../lib/preview";
import type { FileMeta, ToolCall } from "../lib/types";
import { contentStart, fieldString, HlCode, langOf, unescape } from "./Code";
import { Check, Eye } from "./Icons";
import { Flow, Swap } from "./Roll";
import { Md } from "./Stream";

const LABEL: Record<string, [string, string]> = {
  load_skill: ["Loading skill", "Loading skill"],
  web_search: ["Searching", "Searching"],
  read_url: ["Reading page", "Reading page"],
  create_pdf: ["Writing PDF", "Rendering PDF"],
  create_markdown: ["Writing Markdown", "Saving"],
  create_file: ["Writing file", "Saving"],
  create_html: ["Writing HTML", "Saving"],
  create_csv: ["Writing CSV", "Saving"],
  create_xlsx: ["Building spreadsheet", "Saving"],
  create_pptx: ["Building deck", "Saving"],
  calculate: ["Calculating", "Calculating"],
  current_time: ["Checking the time", "Checking the time"],
  list_files: ["Listing files", "Listing files"],
  read_file: ["Reading file", "Reading file"],
};

const host = (u: string) => {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; }
};

const Sweep = () => (
  <motion.i
    className="sweep"
    initial={{ width: "0%", opacity: 1 }}
    animate={{ width: "100%", opacity: 0 }}
    transition={{ width: { duration: 0.5, ease: EASE }, opacity: { duration: 0.3, delay: 0.45 } }}
  />
);

function FileRow({ file }: { file: FileMeta }) {
  const open = usePreviewOpen();
  const [copied, setCopied] = useState(false);
  return (
    <>
      <Sweep />
      <div className="file-meta">
        <span className="file-name">{file.name}</span>
        <span className="file-sub">{file.kind} · {bytes(file.size)}</span>
      </div>
      <div className="file-actions">
        <button className="chip" onClick={() => open(file)}>Preview</button>
        {file.text && (
          <button
            className="chip"
            onClick={async () => {
              await copy(await (await fetch(file.url)).text());
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
          >
            <Swap text={copied ? "Copied" : "Copy"} />
          </button>
        )}
        <a className="chip primary" href={`${file.url}?download=1`} download={file.name}>Download</a>
      </div>
    </>
  );
}

/** Live streaming preview while a file is being written. Markdown renders as prose (app font); code stays mono. */
function WritingPreview({ call }: { call: ToolCall }) {
  const partial = call.partial ?? "";
  const name = fieldString(partial, "filename");
  const lang = (name ? langOf(name) : undefined) ?? (call.name === "create_markdown" ? "markdown" : undefined);
  const start = contentStart(partial);
  const content = start >= 0 ? unescape(partial.slice(start)) : "";
  const isMd = lang === "markdown";
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = body.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [content]);

  return (
    <div className="wcard">
      <div className="wcard-head">
        <i className="wcard-dot" data-live="true" />
        <span className="wcard-name">Writing {name ?? "file"}</span>
        <span className="wcard-n"><Flow value={call.chars} /> chars</span>
      </div>
      {content && (
        <div className="wcard-body" ref={body}>
          {isMd ? <Md src={content} live /> : <HlCode code={content} lang={lang} />}
        </div>
      )}
    </div>
  );
}

/** Live "searching" state — shimmering text + pulsing eye orb. */
function SearchLive({ call }: { call: ToolCall }) {
  const reading = call.name === "read_url";
  return (
    <div className="srch-live">
      <span className="srch-orb" data-live="true"><Eye /></span>
      <div className="srch-live-text">
        <span className="srch-shimmer">{reading ? "Reading the page" : "Searching the web"}</span>
        {call.detail && <span className="srch-q">{call.detail}</span>}
      </div>
    </div>
  );
}

/** Completed search — query + source chips. */
function SearchDone({ meta }: { meta: NonNullable<ToolCall["meta"]> }) {
  const sources = (meta.sources ?? []).slice(0, 6);
  return (
    <div className="srch">
      <div className="srch-head">
        <span className="srch-orb sm"><Eye /></span>
        <span className="srch-title">Searched</span>
        <span className="srch-query">{meta.query}</span>
      </div>
      <div className="srch-src">
        {sources.map((s) => (
          <a key={s.url} className="srch-chip" href={s.url} target="_blank" rel="noreferrer noopener" title={s.title}>{host(s.url)}</a>
        ))}
      </div>
    </div>
  );
}

/** Completed page read — host + size + open. */
function ReadDone({ meta }: { meta: NonNullable<ToolCall["meta"]> }) {
  const r = meta.read!;
  return (
    <div className="srch">
      <div className="srch-head">
        <span className="srch-orb sm"><Eye /></span>
        <span className="srch-title">Read</span>
        <span className="srch-query">{r.host}</span>
      </div>
      <div className="srch-foot">
        <span className="srch-size">{r.chars.toLocaleString()} chars</span>
        <a className="chip" href={r.url} target="_blank" rel="noreferrer noopener">Open</a>
      </div>
    </div>
  );
}

export function ToolCard({ call }: { call: ToolCall }) {
  const [a, b] = LABEL[call.name] ?? [call.name, call.name];
  const m = call.meta;
  const done = call.status === "done";
  const isFile = call.name.startsWith("create_");
  const isLiveSearch = (call.status === "writing" || call.status === "running") && (call.name === "web_search" || call.name === "read_url");
  const phase = call.file ? "file"
    : done && m?.skill ? "skill"
    : done && m?.sources ? "search"
    : done && m?.read ? "read"
    : call.status;

  return (
    <motion.div
      className={`card ${call.status}`}
      initial={{ opacity: 0, y: 6, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.26, ease: EASE }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={phase}
          className="card-in"
          data-flush={(call.status === "writing" && isFile) || isLiveSearch || (done && !!(m?.sources || m?.read))}
          initial={{ opacity: 0, filter: "blur(4px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(4px)" }}
          transition={{ duration: 0.16, ease: EASE }}
        >
          {call.file ? (
            <FileRow file={call.file} />
          ) : phase === "skill" ? (
            <>
              <Sweep />
              <div className="file-meta">
                <span className="file-name">{m!.skill!.name}</span>
                <span className="file-sub">Skill loaded · {m!.skill!.description}</span>
              </div>
              <span className="skill-ok"><Check /></span>
            </>
          ) : phase === "search" ? (
            <SearchDone meta={m!} />
          ) : phase === "read" ? (
            <ReadDone meta={m!} />
          ) : isLiveSearch ? (
            <SearchLive call={call} />
          ) : call.status === "writing" && isFile ? (
            <WritingPreview call={call} />
          ) : call.status === "writing" ? (
            <>
              <span className="card-label">{a}</span>
              <span className="card-num"><Flow value={call.chars} /> chars</span>
            </>
          ) : call.status === "running" ? (
            <div className="card-left">
              <span className="card-label">{b}</span>
              {call.detail && <span className="card-detail">{call.detail}</span>}
            </div>
          ) : (
            <span className="card-result">{call.summary || (call.status === "error" ? "Failed" : "Done")}</span>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}