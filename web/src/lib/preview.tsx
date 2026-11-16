import { createContext, useContext } from "react";
import type { FileMeta } from "./types";

export const PreviewCtx = createContext<(f: FileMeta) => void>(() => {});
export const usePreviewOpen = () => useContext(PreviewCtx);

/** Kinds that pop the panel open by themselves. Markdown and code wait for a click. */
export const AUTO = new Set(["HTML", "HTM", "CSV", "XLSX", "PPTX", "PDF"]);