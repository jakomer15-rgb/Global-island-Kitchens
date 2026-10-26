import type { DesignerStatus } from "@/generated/prisma/client";

export const designerTone: Record<DesignerStatus, "neutral" | "info" | "good" | "bad" | "warn"> = {
  pending: "warn",
  approved: "good",
  rejected: "bad",
  suspended: "bad",
};
