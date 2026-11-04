import { getTranslations } from "next-intl/server";
import { ContactForm } from "@/components/forms/contact-form";
import { FormMessages } from "@/components/forms/form-messages";
import type { Locale } from "@/i18n/routing";

/** The contact form on a product or project page; enquiries are saved like those from the contact page. */
export async function EnquirySection({ locale, subject }: { locale: Locale; subject: string }) {
  const t = await getTranslations({ locale, namespace: "Page" });
  return (
    <section aria-labelledby="enquiry-title" className="border-t border-line py-20 md:py-28">
      <div className="container-site grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <h2 id="enquiry-title" className="font-display text-display-lg">
            {t("enquiryTitle")}
          </h2>
          <p className="mt-4 text-ink-muted">{t("enquiryIntro")}</p>
        </div>
        <div className="lg:col-span-7 lg:col-start-6">
          <FormMessages>
            <ContactForm initialMessage={t("enquiryMessage", { subject })} />
          </FormMessages>
        </div>
      </div>
    </section>
  );
}
