import { cn } from "@/lib/cn";

export function SectionHeading({
  index,
  eyebrow,
  title,
  intro,
  id,
  tone = "dark",
  className,
}: {
  index?: string;
  eyebrow: string;
  title: string;
  intro?: string;
  id?: string;
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <div className={cn("max-w-3xl", className)}>
      <p
        className={cn(
          "flex items-center gap-3 eyebrow",
          tone === "dark" ? "text-walnut" : "text-walnut-soft",
        )}
      >
        <span aria-hidden className="h-px w-7 bg-oak" />
        {index && (
          <span className="tabular-nums" dir="ltr">
            {index}
          </span>
        )}
        <span>{eyebrow}</span>
      </p>
      <h2 id={id} className="mt-5 font-display text-display-lg text-balance">
        {title}
      </h2>
      {intro && (
        <p className={cn("mt-6 max-w-copy", tone === "dark" ? "text-ink-muted" : "text-ivory/70")}>{intro}</p>
      )}
    </div>
  );
}
