import { centreText, tr } from "@/content/automation-centre";
import { requireActor } from "@/server/auth/session";
import { setCentreLanguageAction } from "./actions";
import { getCentreLang } from "./lang";

/**
 * The Automation Centre's frame: its own language (English or Arabic, right-to-left) chosen with the
 * switch here, while the rest of the admin stays English. Each page still checks its own permission.
 */
export default async function AutomationLayout({ children }: LayoutProps<"/admin/automation">) {
  await requireActor("automation.read");
  const lang = await getCentreLang();
  const other = lang === "ar" ? "en" : "ar";
  return (
    <div lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} className={lang === "ar" ? "centre-ar" : undefined}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <p className="eyebrow text-walnut">{tr(centreText.name, lang)}</p>
        <form action={setCentreLanguageAction}>
          <input type="hidden" name="lang" value={other} />
          <button
            type="submit"
            lang={other}
            className="min-h-10 border border-charcoal/25 bg-white px-3 text-sm hover:bg-sand"
            aria-label={`${tr(centreText.language, lang)}: ${tr(centreText.switchTo, lang)}`}
          >
            {tr(centreText.switchTo, lang)}
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}
