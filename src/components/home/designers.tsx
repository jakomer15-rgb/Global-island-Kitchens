import { Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { company } from "@/config/company";

export function Designers() {
  const t = useTranslations("Designers");

  return (
    <section aria-labelledby="designers-title" className="bg-walnut-deep py-20 text-ivory md:py-24">
      <div className="container-site grid items-end gap-10 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <p className="eyebrow text-walnut-soft">{t("eyebrow")}</p>
          <h2 id="designers-title" className="mt-6 font-display text-display-lg text-balance">
            {t("title")}
          </h2>
          <p className="mt-6 max-w-copy text-ivory/80">{t("body")}</p>
        </div>
        <div className="lg:col-span-4 lg:justify-self-end">
          <Button asChild variant="outlineLight" size="lg">
            <a href={`mailto:${company.email}`}>
              <Mail aria-hidden /> {t("cta")}
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
