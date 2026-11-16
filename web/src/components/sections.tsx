import type { Section } from "../lib/nav";
import { Brush, Chat, Grid, Paw, Sliders } from "./Icons";

export const SECTIONS: { id: Section; label: string; Icon: typeof Grid }[] = [
  { id: "overview", label: "Overview", Icon: Grid },
  { id: "prompt", label: "Behavior", Icon: Chat },
  { id: "model", label: "Model", Icon: Sliders },
  { id: "appearance", label: "Appearance", Icon: Brush },
  { id: "pet", label: "Pet", Icon: Paw },
];