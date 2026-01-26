export const SALES_STAGES = ["new", "qualified", "proposal", "negotiation", "won", "lost"] as const;
export type SalesStage = (typeof SALES_STAGES)[number];

export const SERVICE_LINES = ["apps", "websites", "custom_software", "crm", "ai", "staff_aug"] as const;
export type ServiceLine = (typeof SERVICE_LINES)[number];

export function formatServiceLine(s: string) {
  return s.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
 