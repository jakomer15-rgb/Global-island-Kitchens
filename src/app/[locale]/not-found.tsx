import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("NotFound");
  return (
    <section className="container-site flex min-h-[60svh] flex-col items-start justify-center py-24">
      <p className="eyebrow text-walnut">404</p>
      <h1 className="mt-6 font-display text-display-xl">{t("title")}</h1>
      <p className="mt-6 max-w-copy text-ink-muted">{t("body")}</p>
      <Button asChild className="mt-10">
        <Link href="/">{t("home")}</Link>
      </Button>
    </section>
  );
}
