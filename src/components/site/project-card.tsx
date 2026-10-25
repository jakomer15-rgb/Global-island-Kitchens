import { ArrowUpRight } from "lucide-react";
import type { Project } from "@/content/projects";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

/** Text-only project card (no photographs until usage permission is confirmed). */
export function ProjectCard({ project, locale }: { project: Project; locale: Locale }) {
  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group flex h-full flex-col justify-between gap-6 border-t border-charcoal/20 py-6 transition-colors hover:border-walnut"
    >
      <div>
        <p className="text-sm text-walnut">
          {project.location[locale]}
          {project.size && <span className="text-ink-muted"> · {project.size[locale]}</span>}
        </p>
        <h3 className="mt-2 font-display text-display-md">{project.name[locale]}</h3>
        <p className="mt-2 text-sm text-ink-muted">{project.scopeText[locale]}</p>
      </div>
      <ArrowUpRight
        aria-hidden
        className="size-5 text-walnut transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100"
      />
    </Link>
  );
}
