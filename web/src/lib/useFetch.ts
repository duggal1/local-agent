import { useEffect, useState } from "react";

export function useJson<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let off = false;
    setErr(null);
    fetch(url, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json().catch(() => null))?.detail as string) || r.statusText);
        return r.json();
      })
      .then((d) => { if (!off) setData(d); })
      .catch((e) => { if (!off) setErr(String(e.message ?? e)); });
    return () => { off = true; };
  }, [url]);
  return { data, err };
}

export function useText(url: string) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let off = false;
    fetch(url, { cache: "no-store" }).then((r) => r.text()).then((t) => { if (!off) setText(t); }).catch(() => {});
    return () => { off = true; };
  }, [url]);
  return text;
}