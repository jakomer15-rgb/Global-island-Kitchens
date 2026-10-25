import { Mail, Phone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Address } from "@/components/site/address";
import { SectionHeading } from "@/components/site/section-heading";
import { Button } from "@/components/ui/button";
import { company, telHref } from "@/config/company";

export function Showroom() {
  const t = useTranslations();
  const ar = useLocale() === "ar";
  const [main] = company.phones;

  return (
    <section aria-labelledby="showroom-title" id="showroom" className="scroll-mt-20 bg-sand py-24 md:py-32">
      <div className="container-site grid gap-14 lg:grid-cols-12">
        <SectionHeading
          index="06"
          id="showroom-title"
          eyebrow={t("Showroom.eyebrow")}
          title={t("Showroom.title")}
          className="lg:col-span-5"
        />

        <div className="grid gap-10 sm:grid-cols-2 lg:col-span-7">
          <div className="border-t border-charcoal/20 pt-6">
            <h3 className="eyebrow text-walnut">{t("Showroom.showroom")}</h3>
            <Address
              lines={ar ? company.showroom.linesAr : company.showroom.lines}
              className="mt-4 not-italic"
            />
            <p className="mt-6 text-sm text-ink-muted">{t("Showroom.hours")}</p>
            <p dir={ar ? "rtl" : "ltr"}>{t("Showroom.hoursValue")}</p>
          </div>
          <div className="border-t border-charcoal/20 pt-6">
            <h3 className="eyebrow text-walnut">{t("Showroom.headOffice")}</h3>
            <Address
              lines={ar ? company.headOffice.linesAr : company.headOffice.lines}
              className="mt-4 not-italic"
            />
          </div>
        </div>

        <div className="border-t border-charcoal/20 pt-12 lg:col-span-12">
          <div className="grid items-end gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <h3 className="font-display text-display-lg text-balance">{t("Consultation.title")}</h3>
              <p className="mt-4 max-w-copy text-ink-muted">{t("Consultation.body")}</p>
            </div>
            <div className="flex flex-wrap gap-3 lg:col-span-5 lg:justify-end">
              <Button asChild size="lg">
                <a href={telHref(main)}>
                  <Phone aria-hidden />
                  {t("Consultation.call")} <span dir="ltr">{main.display}</span>
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={`mailto:${company.email}`}>
                  <Mail aria-hidden /> {t("Consultation.email")}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
