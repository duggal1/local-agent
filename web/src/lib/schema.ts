import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** Every field has a .catch(), so junk in localStorage heals itself instead of crashing the UI. */
export const PetSchema = z.object({
  enabled: z.boolean().catch(true),
  color: hex.catch("#ea580c"),
  size: z.number().min(24).max(96).catch(44),
  speed: z.number().min(0.4).max(2).catch(1),
  behavior: z.enum(["roam", "left", "right", "still"]).catch("roam"),
  blink: z.boolean().catch(true),
});

export const SettingsSchema = z.object({
  systemPrompt: z.string().max(8000).catch(""),
  tone: z.enum(["default", "concise", "casual", "blunt", "formal"]).catch("default"),
  temperature: z.number().min(0).max(2).catch(1.0),
  topP: z.number().min(0.05).max(1).catch(0.99),
  maxTokens: z.number().int().min(256).max(32768).catch(16384),
  effort: z.enum(["off", "low", "medium", "high"]).catch("medium"),
  font: z.enum(["sans", "serif"]).catch("sans"),
  theme: z.enum(["dark", "light", "system"]).catch("dark"),
  accent: hex.catch("#ff6a13"),
  fontSize: z.number().min(13).max(18).catch(15),
  pet: PetSchema.catch(() => PetSchema.parse({})),
});

export type Settings = z.infer<typeof SettingsSchema>;
export type PetSettings = z.infer<typeof PetSchema>;

/** Backend payloads. Anything that doesn't match gets dropped, never rendered. */
export const ModelSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  installed: z.boolean(),
  bytes: z.number().nonnegative().catch(0),
});
export const DownloadSchema = z.object({
  done: z.number().nonnegative(),
  total: z.number().nonnegative(),
  speed: z.number().nonnegative().catch(0),
});

export type ModelRow = z.infer<typeof ModelSchema>;
export type DownloadRow = z.infer<typeof DownloadSchema>;

export function cleanModels(v: unknown): ModelRow[] {
  const list = Array.isArray(v) ? v : [];
  return list.flatMap((x) => {
    const r = ModelSchema.safeParse(x);
    return r.success ? [r.data] : [];
  });
}

export function cleanDownload(v: unknown): DownloadRow | undefined {
  const r = DownloadSchema.safeParse(v);
  return r.success ? r.data : undefined;
}
