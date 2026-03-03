export const SALES_STAGES = [
  "new",
  "qualified",
  "proposal",
  "negotiation",
  "on_hold",
  "won",
  "lost",
] as const;

export type SalesStage = (typeof SALES_STAGES)[number];

export const SERVICE_LINES = [
  "apps",
  "websites",
  "custom_software",
  "crm",
  "ai",
  "staff_aug",
  "business_development",
  "pitch_deck",
  "consultations",
] as const;

export type ServiceLine = (typeof SERVICE_LINES)[number];

// Stage-based probability defaults (0-100)
export const STAGE_PROBABILITY: Record<SalesStage, number> = {
  new: 10,
  qualified: 25,
  proposal: 50,
  negotiation: 70,
  on_hold: 20,
  won: 100,
  lost: 0,
};

export function formatServiceLine(s: string) {
  return (s || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}