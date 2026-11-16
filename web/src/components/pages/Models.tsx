import { AnimatePresence, motion } from "motion/react";
import { useMemo, type CSSProperties } from "react";
import { cleanDownload, cleanModels, type ModelRow } from "../../lib/schema";
import type { useChat } from "../../lib/useChat";
import { Close, Download } from "../Icons";
import { Flow } from "../Roll";
import { Head, I } from "../ui";

type C = ReturnType<typeof useChat>;
const GB = 1024 ** 3;
const MB = 1024 ** 2;

const etaText = (s: number) => {
  if (!Number.isFinite(s)) return "estimating";
  if (s < 60) return `${Math.ceil(s)}s left`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s left`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m left`;
};

function Row({ m, c, i }: { m: ModelRow; c: C; i: number }) {
  const dl = cleanDownload(c.downloads[m.id]);
  const busy = !!dl && !m.installed;
  const total = dl?.total || m.bytes;
  const p = total > 0 ? Math.min(1, (dl?.done ?? 0) / total) : 0;
  const eta = dl && dl.speed > 0 && total > 0 ? (total - dl.done) / dl.speed : NaN;
  const mine = c.runtime.model === m.id;
  const active = m.installed && mine && c.runtime.state === "ready";
  const loading = m.installed && mine && c.runtime.state === "loading";
  const size = m.bytes >= GB ? `${(m.bytes / GB).toFixed(1)} GB` : m.bytes > 0 ? `${Math.round(m.bytes / MB)} MB` : null;

  return (
    <div className="mrow rise" style={I(i + 1)} data-active={active}>
      <AnimatePresence>
        {busy && (
          <motion.div
            key="fill" className="mfill" style={{ "--p": p } as CSSProperties}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
          />
        )}
      </AnimatePresence>

      <div>
        <div className="mname">{m.label}</div>
        <div className="msub">
          {busy ? (
            <>
              {dl.total === 0 ? <span className="shim">Starting</span> : <Flow value={p * 100} suffix="%" format={{ maximumFractionDigits: 0 }} />}
              <span>·</span>
              <span>{etaText(eta)}</span>
            </>
          ) : m.installed ? (
            <span>{size ? `Installed · ${size}` : "Installed"}</span>
          ) : (
            <span>{size ?? "Not downloaded"}</span>
          )}
        </div>
      </div>

      <div className="mright">
        {busy ? (
          <>
            <Flow className="mspeed" value={(dl.speed || 0) / MB} suffix=" MB/s" format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }} />
            <button className="btn btn-sq" aria-label="Cancel download" onClick={() => c.cancel(m.id)}><Close size={16} /></button>
          </>
        ) : !m.installed ? (
          <button className="btn btn-primary" onClick={() => c.get(m.id)}><Download size={16} />Download</button>
        ) : loading ? (
          <span className="shim">Loading</span>
        ) : active ? (
          <span className="mstate"><i className="dot" data-on />In use</span>
        ) : (
          <button className="btn" onClick={() => c.pick(m.id)}>Use</button>
        )}
      </div>
    </div>
  );
}

export function Models({ c }: { c: C }) {
  const models = useMemo(() => cleanModels(c.models), [c.models]);
  const n = models.filter((m) => m.installed).length;
  return (
    <>
      <Head title="Models" sub="Download once. Runs on this machine." />
      <div className="mstat rise" style={I(1)}>
        <i className="dot" data-on={c.connected} />
        {c.connected ? (
          <span><Flow value={n} format={{ useGrouping: false }} /> of <Flow value={models.length} format={{ useGrouping: false }} /> installed</span>
        ) : (
          <span className="shim">Connecting to backend</span>
        )}
      </div>
      <div className="mlist">
        {models.length === 0
          ? <div className="mempty">{c.connected ? "No models in the catalog." : ""}</div>
          : models.map((m, i) => <Row key={m.id} m={m} c={c} i={i} />)}
      </div>
    </>
  );
}