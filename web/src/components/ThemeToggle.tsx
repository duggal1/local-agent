import { useEffect, useState } from "react";
import { Swap } from "./Roll";

function systemDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readDark() {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark") return true;
  if (attr === "light") return false;
  return systemDark();
}

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean>(() => readDark());

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!document.documentElement.getAttribute("data-theme")) setDark(mq.matches);
    };
    mq.addEventListener("change", onChange);
    const obs = new MutationObserver(() => setDark(readDark()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mq.removeEventListener("change", onChange);
      obs.disconnect();
    };
  }, []);

  const toggle = () => {
    const next = !dark;
    const theme = next ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("theme", theme); } catch {}
    setDark(next);
  };

  return (
    <button className="chip theme-toggle" onClick={toggle} title="Toggle theme" aria-label="Toggle theme">
      <Swap text={dark ? "☾" : "☀"} />
    </button>
  );
}