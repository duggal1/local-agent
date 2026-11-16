import { animate, motion, useMotionValue } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useSettings } from "../lib/settings";

const RATIO = 0.72;

/** The agent pet. Body, two legs and two blink lids, all driven by one color. */
export function PetSvg({
  color, size, walking = false, blink = true, happy = false, busy = false,
}: { color: string; size: number; walking?: boolean; blink?: boolean; happy?: boolean; busy?: boolean }) {
  return (
    <svg
      className="pet-svg" width={size} height={size * RATIO} viewBox="0 50 500 360"
      fill="none" shapeRendering="crispEdges"
      data-walking={walking} data-busy={busy} data-happy={happy}
    >
      <g className="pet-body" fill={color}>
        <path d="M200 60h80v20h-80zM200 80h80v20h-80zM220 100h40v20h-40zM220 120h40v20h-40zM220 140h40v20h-40zM120 160h240v20h-240zM80 180h320v20h-320zM60 200h360v20h-360zM60 220h80v20h-80zM180 220h120v20h-120zM340 220h80v20h-80zM60 240h80v20h-80zM180 240h120v20h-120zM340 240h80v20h-80zM440 240h40v20h-40zM60 260h80v20h-80zM180 260h120v20h-120zM340 260h80v20h-80zM440 260h40v20h-40zM60 280h400v20h-400zM20 300h440v20h-440zM20 320h40v20h-40zM80 320h360v20h-360zM100 340h280v20h-280z" />
        {blink && (
          <>
            <rect className="pet-eye" x="140" y="220" width="40" height="60" />
            <rect className="pet-eye" x="300" y="220" width="40" height="60" />
          </>
        )}
      </g>
      <g className="pet-leg pet-leg-a" fill={color}><rect x="100" y="360" width="80" height="40" /></g>
      <g className="pet-leg pet-leg-b" fill={color}><rect x="300" y="360" width="80" height="40" /></g>
    </svg>
  );
}

/** Lives at the very bottom of the window, under the composer. Wanders, flips, hops when poked. */
export function Pet({ busy }: { busy: boolean }) {
  const { pet } = useSettings();
  const x = useMotionValue(24);
  const y = useMotionValue(0);
  const [walking, setWalking] = useState(false);
  const [face, setFace] = useState<1 | -1>(1);
  const [happy, setHappy] = useState(false);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const h = Math.round(pet.size * RATIO);

  // reserve the strip so the composer never sits on the pet
  useEffect(() => {
    document.documentElement.style.setProperty("--pet-h", pet.enabled ? `${h + 4}px` : "0px");
    return () => document.documentElement.style.setProperty("--pet-h", "0px");
  }, [pet.enabled, h]);

  useEffect(() => {
    if (!pet.enabled) return;
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const maxX = () => Math.max(8, window.innerWidth - pet.size - 8);
    let alive = true;
    let timer = 0;
    let ctl: { stop: () => void } | undefined;

    const walk = (to: number, then?: () => void) => {
      const from = x.get();
      const dist = Math.abs(to - from);
      if (dist < 4) { setWalking(false); then?.(); return; }
      setFace(to > from ? 1 : -1);
      setWalking(true);
      const pps = 70 * pet.speed * (busyRef.current ? 2.2 : 1);
      ctl = animate(x, to, {
        duration: dist / pps, ease: "linear",
        onComplete: () => { if (!alive) return; setWalking(false); then?.(); },
      });
    };
    const roam = () => {
      if (!alive) return;
      walk(8 + Math.random() * (maxX() - 8), () => { timer = window.setTimeout(roam, 1500 + Math.random() * 4000); });
    };
    const home = () => (pet.behavior === "left" ? 8 : pet.behavior === "right" ? maxX() : null);
    const onResize = () => { const p = home(); x.set(p ?? Math.min(x.get(), maxX())); };
    window.addEventListener("resize", onResize);

    const target = home();
    if (calm || pet.behavior === "still") x.set(Math.min(x.get(), maxX()));
    else if (target !== null) walk(target);
    else timer = window.setTimeout(roam, 600);

    return () => {
      alive = false;
      window.clearTimeout(timer);
      ctl?.stop();
      window.removeEventListener("resize", onResize);
      setWalking(false);
    };
  }, [pet.enabled, pet.behavior, pet.speed, pet.size, x]);

  const poke = () => {
    setHappy(true);
    animate(y, [0, -Math.round(h * 0.6), 0], { duration: 0.5, ease: "easeOut" });
    window.setTimeout(() => setHappy(false), 900);
  };

  if (!pet.enabled) return null;
  return (
    <div className="pet-lane">
      <motion.button className="pet" style={{ x, y }} onClick={poke} aria-label="Agent pet" tabIndex={-1}>
        <div style={{ transform: `scaleX(${face})` }}>
          <PetSvg color={pet.color} size={pet.size} walking={walking} blink={pet.blink} happy={happy} busy={busy} />
        </div>
      </motion.button>
    </div>
  );
}
