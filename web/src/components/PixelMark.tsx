import type { ReactNode } from "react";

const CELL = 4;

const MAP: string[] = [
  "...######...",
  "..########..",
  ".##########.",
  ".##E####E##.",
  ".##########.",
  ".##########.",
  "..########..",
  "...######...",
  "..##....##..",
  "..##....##..",
];

/** Static pixel-art agent mark. No animation, theme-aware. */
export function PixelMark() {
  const w = MAP[0].length * CELL;
  const h = MAP.length * CELL;
  const rects: ReactNode[] = [];
  MAP.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      rects.push(
        <rect
          key={`${x}-${y}`}
          x={x * CELL}
          y={y * CELL}
          width={CELL}
          height={CELL}
          fill={ch === "E" ? "var(--accent)" : "var(--text-2)"}
        />
      );
    });
  });
  return (
    <svg
      className="pixel-mark"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="Bonsai agent"
      style={{ imageRendering: "pixelated", shapeRendering: "crispEdges" }}
    >
      {rects}
    </svg>
  );
}