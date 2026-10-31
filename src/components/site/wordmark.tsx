import { cn } from "@/lib/cn";

/**
 * Typographic wordmark. The company's logo files are not yet supplied (docs/OPEN_QUESTIONS.md #1);
 * this is replaced by the real logo when they arrive. Always Latin script: the Arabic company
 * name is not yet confirmed.
 */
export function Wordmark({
  className,
  tone = "dark",
  size = "md",
}: {
  className?: string;
  tone?: "dark" | "light";
  size?: "md" | "lg";
}) {
  return (
    <span
      lang="en"
      dir="ltr"
      className={cn(
        // Latin fonts even on Arabic pages, where the font tokens switch to Arabic faces.
        "inline-flex flex-col font-sans leading-none [--font-display:var(--font-cormorant),serif] [--font-sans:var(--font-jost),sans-serif]",
        tone === "dark" ? "text-charcoal" : "text-ivory",
        className,
      )}
    >
      <span
        className={cn(
          "font-display tracking-[0.02em]",
          size === "md" ? "text-[1.375rem]" : "text-[2.25rem] md:text-[3rem]",
        )}
      >
        Global Island
      </span>
      <span
        className={cn(
          "font-medium tracking-[0.42em] uppercase",
          size === "md" ? "mt-1 text-[0.625rem]" : "mt-2 text-xs",
          tone === "dark" ? "text-walnut" : "text-walnut-soft",
        )}
      >
        Kitchens
      </span>
    </span>
  );
}
