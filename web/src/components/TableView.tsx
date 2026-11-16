import { motion } from "motion/react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { EASE } from "../lib/format";
import type { FileMeta } from "../lib/types";
import { useJson } from "../lib/useFetch";
import { Flow } from "./Roll";

interface TableData {
  kind: string; sheets: string[]; sheet: string | null;
  columns: string[]; rows: string[][]; num: boolean[]; total: number;
}

export function TableView({ file, rev }: { file: FileMeta; rev: number }) {
  const [sheet, setSheet] = useState<string | null>(null);
  useEffect(() => setSheet(null), [file.name]);
  const q = `/api/table?file=${encodeURIComponent(file.name)}${sheet ? `&sheet=${encodeURIComponent(sheet)}` : ""}&v=${rev}`;
  const { data, err } = useJson<TableData>(q);

  const tpl = useMemo(() => {
    if (!data) return "";
    const w = data.columns.map((c, i) => {
      let m = c.length;
      for (const r of data.rows.slice(0, 80)) m = Math.max(m, (r[i] ?? "").length);
      return Math.min(Math.max(m * 8 + 36, 96), 320);
    });
    return `44px ${w.map((x) => `${x}px`).join(" ")}`;
  }, [data]);

  if (!data) return <div className="pv-msg" data-err={!!err}>{err ?? "Reading table"}</div>;

  return (
    <motion.div
      className="tv"
      initial={{ opacity: 0, filter: "blur(8px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.26, ease: EASE }}
    >
      <div className="tv-scroll">
        <div className="tgrid" style={{ gridTemplateColumns: tpl }}>
          <div className="th idx">#</div>
          {data.columns.map((c, i) => <div key={i} className="th" data-num={data.num[i]} title={c}>{c}</div>)}
          {data.rows.map((r, ri) => (
            <Fragment key={ri}>
              <div className="td idx">{ri + 1}</div>
              {data.columns.map((_, ci) => {
                const v = r[ci] ?? "";
                return (
                  <div key={ci} className="td" data-num={data.num[ci]} data-f={v.startsWith("=")} title={v}>{v}</div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <div className="tv-foot">
        <div className="tabs">
          {data.sheets.length > 1 && data.sheets.map((s) => (
            <button key={s} data-on={s === data.sheet} onClick={() => setSheet(s)}>{s}</button>
          ))}
        </div>
        <span className="tv-count">
          {data.total > data.rows.length ? (<><Flow value={data.rows.length} /> of <Flow value={data.total} /> rows</>) : (<><Flow value={data.total} /> rows</>)}
        </span>
      </div>
    </motion.div>
  );
}