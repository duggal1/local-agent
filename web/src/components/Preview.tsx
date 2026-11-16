import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { EASE, copy } from "../lib/format";
import type { FileMeta } from "../lib/types";
import { useJson, useText } from "../lib/useFetch";
import { Close, Copy01 } from "./Icons";
import { Swap } from "./Roll";
import { Md } from "./Stream";
import { TableView } from "./TableView";

const enc = encodeURIComponent;
const SANDBOX = "allow-scripts allow-popups allow-forms allow-modals allow-downloads";
interface P { file: FileMeta; rev: number }

function HtmlView({ file, rev }: P) {
  const [mobile, setMobile] = useState(false);
  const [n, setN] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const src = `/api/view?file=${enc(file.name)}&v=${rev}-${n}`;
  useEffect(() => setLoaded(false), [src]);
  return (
    <>
      <div className="pv-stage" data-mobile={mobile}>
        <iframe key={src} className="frame" src={src} sandbox={SANDBOX} title={file.name} onLoad={() => setLoaded(true)} />
        <AnimatePresence>
          {!loaded && (
            <motion.div
              className="pv-msg over"
              exit={{ opacity: 0, filter: "blur(6px)" }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              Rendering
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="pv-bar">
        <div className="seg-ctl">
          <button data-on={!mobile} onClick={() => setMobile(false)}>Desktop</button>
          <button data-on={mobile} onClick={() => setMobile(true)}>Mobile</button>
        </div>
        <button className="chip" onClick={() => setN((x) => x + 1)}>Reload</button>
      </div>
    </>
  );
}

function SlidesView({ file, rev }: P) {
  const { data, err } = useJson<{ slides: { title: string; bullets: string[]; notes: string }[] }>(
    `/api/slides?file=${enc(file.name)}&v=${rev}`,
  );
  if (!data) return <div className="pv-msg" data-err={!!err}>{err ?? "Reading deck"}</div>;
  return (
    <div className="pv-scroll slides">
      {data.slides.map((s, i) => (
        <motion.div
          key={i}
          className="slide"
          initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.26, ease: EASE, delay: Math.min(i, 8) * 0.04 }}
        >
          <div className="slide-in">
            <i className="slide-bar" />
            <div className={i === 0 ? "slide-t big" : "slide-t"}>{s.title}</div>
            <ul>{s.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>
          </div>
          <span className="slide-n">{i + 1}</span>
        </motion.div>
      ))}
    </div>
  );
}

function TextView({ file, rev }: P) {
  const text = useText(`${file.url}?v=${rev}`);
  if (text === null) return <div className="pv-msg">Loading</div>;
  const src = file.kind === "MD" ? text : "````" + file.kind.toLowerCase() + "\n" + text + "\n````";
  return <div className="pv-scroll pad"><Md src={src} /></div>;
}

export function Preview({ file, rev, onClose }: P & { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const w = useMemo(() => (window.innerWidth < 1000 ? window.innerWidth - 16 : Math.round(Math.min(window.innerWidth * 0.44, 700))), []);
  const k = file.kind;
  const html = k === "HTML" || k === "HTM";
  const body = html ? <HtmlView file={file} rev={rev} />
    : k === "CSV" || k === "XLSX" ? <TableView file={file} rev={rev} />
    : k === "PPTX" ? <SlidesView file={file} rev={rev} />
    : k === "PDF" ? <iframe className="frame" src={`${file.url}?v=${rev}`} title={file.name} />
    : <TextView file={file} rev={rev} />;

  return (
    <motion.aside
      className="panel"
      initial={{ width: 0, opacity: 0, filter: "blur(10px)" }}
      animate={{ width: w, opacity: 1, filter: "blur(0px)" }}
      exit={{ width: 0, opacity: 0, filter: "blur(10px)" }}
      transition={{ duration: 0.34, ease: EASE }}
    >
      <div className="panel-in" style={{ width: w }}>
        <header className="panel-head">
          <div className="panel-title">
            <span className="panel-kind">{k}</span>
            <span className="panel-name" title={file.name}>{file.name}</span>
          </div>
          {html && (
            <a className="chip" href={`/api/view?file=${enc(file.name)}`} target="_blank" rel="noreferrer">View full</a>
          )}
          {file.text && (
            <button
              className="chip"
              onClick={async () => {
                await copy(await (await fetch(file.url)).text());
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
            >
              <Copy01 size={14} />
              <Swap text={copied ? "Copied" : "Copy"} />
            </button>
          )}
          <a className="chip primary" href={`${file.url}?download=1`} download={file.name}>Download</a>
          <button className="icon-btn" onClick={onClose} aria-label="Close preview"><Close /></button>
        </header>
        <div className="panel-body">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={file.name}
              className="pv-fill"
              initial={{ opacity: 0, filter: "blur(8px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(8px)" }}
              transition={{ duration: 0.18, ease: EASE }}
            >
              {body}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  );
}