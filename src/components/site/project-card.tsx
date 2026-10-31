import { ArrowUpRight } from "lucide-react";
import { galleryOf, type Project } from "@/content/projects";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";

/**
 * Project card: the project's first photo, or a quiet sand panel with its name when it has none
 * (no stand-in imagery). In a gallery, `lead` is the wide first card and `fill` stretches the photo
 * to match the height of its row (wide screens only).
 */
export function ProjectCard({
  project,
  locale,
  variant,
}: {
  project: Project;
  locale: Locale;
  variant?: "lead" | "fill";
}) {
  const cover = galleryOf(project)[0];
  const large = variant === "lead";
  return (
    <Link href={`/projects/${project.slug}`} className="group flex h-full flex-col">
      <div
        className={cn(
          "relative aspect-[4/3] overflow-hidden bg-sand",
          large && "lg:aspect-[16/10]",
          variant === "fill" && "lg:aspect-auto lg:flex-1",
        )}
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- static files and /media, already optimised
          <img
            src={cover.src}
            alt=""
            loading="lazy"
            decoding="async"
            width={cover.width}
            height={cover.height}
            className="absolute inset-0 size-full img-zoom object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 flex items-center justify-center bg-sand-deep/60 p-8 text-center font-display text-display-md text-walnut"
          >
            {project.name[locale]}
          </div>
        )}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-oak transition-transform duration-700 ease-out-soft group-hover:scale-x-100 rtl:origin-right"
        />
      </div>
      <div className="mt-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-walnut">
            {project.location[locale]}
            {project.size && <span className="text-ink-muted"> · {project.size[locale]}</span>}
          </p>
          <h3
            className={cn(
              "mt-1 font-display transition-colors group-hover:text-walnut",
              large ? "text-display-lg" : "text-display-md",
            )}
          >
            {project.name[locale]}
          </h3>
          <p className="mt-2 text-sm text-ink-muted">{project.scopeText[locale]}</p>
        </div>
        <ArrowUpRight
          aria-hidden
          className="mt-1 size-5 shrink-0 text-walnut transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100"
        />
      </div>
    </Link>
  );
}
