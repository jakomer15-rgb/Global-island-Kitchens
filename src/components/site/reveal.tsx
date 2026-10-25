import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Fades content up as it scrolls into view, with a CSS scroll-driven animation (`reveal` utility
 * in globals.css). Content is always visible without it: in browsers without support, with reduced
 * motion, without JavaScript, and for crawlers.
 */
export function Reveal({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li";
}) {
  return <Tag className={cn("reveal", className)}>{children}</Tag>;
}
