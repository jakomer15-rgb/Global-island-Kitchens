import { cn } from "@/lib/cn";

/**
 * Typographic wordmark: the name on one line in tracked capitals over a small tagline, as in the
 * owner's reference. The company's logo files are not yet supplied (docs/OPEN_QUESTIONS.md #1);
 * this is replaced by the real logo when they arrive. Always Latin script: the Arabic company
 * name is not yet confirmed.
 */
export function Wordmark({
  className,
  tone = "dark",
  size = "md",
}: {
  className?: string;
  /** `inherit` takes the surrounding text colour (the header over the hero photograph). */
  tone?: "dark" | "light" | "inherit";
  size?: "md" | "lg";
}) {
  return (
    <span
      lang="en"
      dir="ltr"
      className={cn(
        // Latin fonts even on Arabic pages, where the font tokens switch to Arabic faces.
        "inline-flex flex-col font-sans leading-none [--font-display:var(--font-fraunces),serif] [--font-sans:var(--font-inter),sans-serif]",
        tone === "dark" && "text-charcoal",
        tone === "light" && "text-ivory",
        className,
      )}
    >
      <span
        className={cn(
          "font-display tracking-[0.04em] uppercase",
          size === "md" ? "text-[0.875rem] sm:text-[1.25rem]" : "text-[1.5rem] sm:text-[2rem] md:text-[2.5rem]",
        )}
      >
        Global Island Kitchens
      </span>
      <span
        className={cn(
          "font-normal tracking-[0.22em] uppercase",
          size === "md" ? "mt-1.5 text-[0.5rem] sm:text-[0.5625rem]" : "mt-3 text-[0.6875rem]",
          tone === "dark" && "text-walnut",
          tone === "light" && "text-walnut-soft",
          tone === "inherit" && "opacity-80",
        )}
      >
        Custom Furniture &amp; Interiors
      </span>
    </span>
  );
}
