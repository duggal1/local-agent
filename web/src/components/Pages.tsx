import { AnimatePresence, motion } from "motion/react";
import { SPRING_SOFT } from "../lib/format";
import { useNav } from "../lib/nav";
import type { useChat } from "../lib/useChat";
import { Models } from "./pages/Models";
import { Overview, SettingsSection } from "./pages/Settings";

export function Pages({ c }: { c: ReturnType<typeof useChat> }) {
  const { view, section } = useNav();
  const key = view === "models" ? "models" : `s:${section}`;
  return (
    <main className="page">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={key} className="pg"
          initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -4, filter: "blur(6px)" }}
          transition={SPRING_SOFT}
        >
          {view === "models" ? <Models c={c} /> : section === "overview" ? <Overview /> : <SettingsSection section={section} />}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
