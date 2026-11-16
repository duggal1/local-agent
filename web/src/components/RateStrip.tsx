import { useEffect, useRef } from "react";

interface Props {
  tps: number;
  history: number[];
}

/** Live tokens/sec: pixel bar strip + instant tabular digits. No animation lib in the path. */
export function RateStrip({ tps, history }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = 48;
      const h = 16;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const max = Math.max(1, ...history, tps);
      const cell = 2;
      const cols = Math.floor(w / cell);
      const vals = history.slice(-cols);
      const padded = new Array(cols).fill(0);
      vals.forEach((v, i) => {
        padded[cols - vals.length + i] = v;
      });

      const css = getComputedStyle(document.documentElement);
      const accent = css.getPropertyValue("--accent").trim() || "#ff6a13";
      const live = tps > 0;
      padded.forEach((v, i) => {
        const colH = Math.max(1, Math.round((v / max) * (h - 2)));
        const x = i * cell;
        const y = h - colH;
        ctx.fillStyle = live ? accent : css.getPropertyValue("--text-3").trim() || "#737373";
        ctx.fillRect(x, y, cell, colH);
      });
    };

    draw();

    const obs = new MutationObserver(draw);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onMq = () => { if (!document.documentElement.getAttribute("data-theme")) draw(); };
    mq.addEventListener("change", onMq);

    return () => {
      obs.disconnect();
      mq.removeEventListener("change", onMq);
    };
  }, [tps, history]);

  return (
    <span className="rate" data-live={tps > 0} title="Tokens per second">
      <canvas ref={canvasRef} className="rate-strip" aria-hidden="true" style={{ imageRendering: "pixelated" }} />
      <span className="rate-num">{String(Math.round(tps)).padStart(3, "\u00a0")}</span>
      <span className="dim">tok/s</span>
    </span>
  );
}