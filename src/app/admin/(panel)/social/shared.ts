import type { Tone } from "@/components/admin/ui";

export const statusTone: Record<string, Tone> = {
  draft: "neutral",
  pending_approval: "warn",
  approved: "info",
  scheduled: "info",
  published: "good",
  failed: "bad",
};

export const targetTone: Record<string, Tone> = {
  pending: "info",
  published: "good",
  failed: "bad",
  manual: "warn",
};

export const targetStatusNames: Record<string, string> = {
  pending: "Publishes automatically",
  published: "Published",
  failed: "Failed",
  manual: "Post by hand",
};
