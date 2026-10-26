import type { Tone } from "@/components/admin/ui";

export const quotationTone: Record<string, Tone> = {
  draft: "neutral",
  sent: "info",
  approved: "good",
  rejected: "bad",
  converted: "good",
};

export const stageTone: Record<string, Tone> = {
  inquiry: "neutral",
  measurement: "info",
  design: "info",
  quotation: "info",
  approval: "warn",
  production: "warn",
  installation: "warn",
  completion: "good",
};
