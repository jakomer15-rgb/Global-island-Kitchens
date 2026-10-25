import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

export type SwatchName = "oak" | "walnut" | "stone" | "solid" | "paintedLight" | "paintedDark";

/**
 * Illustrated finish swatch drawn with CSS gradients only (no images, no SVG filters, so it is
 * cheap to paint at any size). These are impressions of finish families, not photographs of real
 * décors, and are labelled as such wherever shown.
 */

/** Irregular vertical grain: overlapping repeats with co-prime widths so the pattern doesn't visibly tile. */
function grain(base: string, dark: string, light: string): CSSProperties {
  return {
    backgroundColor: base,
    backgroundImage: [
      `repeating-linear-gradient(92deg, ${dark} 0 1px, transparent 1px 7px)`,
      `repeating-linear-gradient(88deg, transparent 0 11px, ${dark} 11px 13px, transparent 13px 29px)`,
      `repeating-linear-gradient(90deg, ${light} 0 3px, transparent 3px 17px)`,
      `linear-gradient(90deg, transparent 0 18%, ${dark} 18% 21%, transparent 21% 63%, ${dark} 63% 64%, transparent 64%)`,
    ].join(","),
  };
}

const styles: Record<SwatchName, CSSProperties> = {
  oak: grain("#b98c5c", "rgb(90 55 25 / 0.16)", "rgb(255 240 215 / 0.12)"),
  walnut: grain("#5d3b25", "rgb(25 12 4 / 0.28)", "rgb(160 110 70 / 0.12)"),
  stone: {
    backgroundColor: "#d9d1c5",
    // Soft veining and sparse speckle; co-prime tile sizes keep the speckle from reading as a grid.
    backgroundImage: [
      "radial-gradient(ellipse 70% 30% at 30% 35%, rgb(255 255 255 / 0.4), transparent 70%)",
      "radial-gradient(ellipse 60% 25% at 75% 75%, rgb(120 105 90 / 0.16), transparent 70%)",
      "linear-gradient(115deg, transparent 40%, rgb(150 135 120 / 0.12) 46%, transparent 52%)",
      "radial-gradient(circle at 30% 40%, rgb(100 88 76 / 0.12) 0 1px, transparent 1.6px)",
      "radial-gradient(circle at 70% 20%, rgb(100 88 76 / 0.09) 0 1.2px, transparent 2px)",
    ].join(","),
    backgroundSize: "100% 100%, 100% 100%, 100% 100%, 17px 23px, 29px 19px",
  },
  solid: {
    backgroundColor: "#3b3a37",
    backgroundImage: "linear-gradient(135deg, rgb(255 255 255 / 0.06), transparent 55%)",
  },
  paintedLight: {
    backgroundColor: "#ece4d7",
    backgroundImage: "linear-gradient(135deg, rgb(255 255 255 / 0.55), transparent 50%, rgb(0 0 0 / 0.05))",
  },
  paintedDark: {
    backgroundColor: "#2f3b38",
    backgroundImage: "linear-gradient(135deg, rgb(255 255 255 / 0.14), transparent 50%, rgb(0 0 0 / 0.12))",
  },
};

export function Swatch({ name, className }: { name: SwatchName; className?: string }) {
  return <div aria-hidden className={cn("size-full", className)} style={styles[name]} />;
}
