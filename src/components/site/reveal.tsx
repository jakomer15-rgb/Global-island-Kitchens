import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Moves content up as it scrolls into view, with a CSS scroll-driven animation (`reveal` utility
 * in globals.css). Content is always visible, with or without the animation.
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
