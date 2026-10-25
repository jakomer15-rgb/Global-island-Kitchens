import { SectionHeading } from "@/components/site/section-heading";
import { testimonialsSection as c } from "@/content/cms";
import type { Locale } from "@/i18n/routing";

export interface PublicTestimonial {
  id: string;
  displayName: string;
  textEn: string | null;
  textAr: string | null;
}

/** Published testimonials (each with recorded consent). Renders nothing until there is one for this language. */
export function Testimonials({ items, locale }: { items: PublicTestimonial[]; locale: Locale }) {
  const shown = items
    .map((t) => ({ ...t, text: locale === "ar" ? t.textAr : t.textEn }))
    .filter((t): t is typeof t & { text: string } => Boolean(t.text));
  if (shown.length === 0) return null;

  return (
    <section aria-labelledby="testimonials-title" className="py-24 md:py-32">
      <div className="container-site">
        <SectionHeading id="testimonials-title" eyebrow={c.eyebrow[locale]} title={c.title[locale]} />
        <ul className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((t) => (
            <li key={t.id} className="border-t border-charcoal/20 pt-6">
              <figure>
                <blockquote className="text-lg leading-relaxed">“{t.text}”</blockquote>
                <figcaption className="mt-4 text-sm text-ink-muted">{t.displayName}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-xs text-ink-muted">{c.note[locale]}</p>
      </div>
    </section>
  );
}
