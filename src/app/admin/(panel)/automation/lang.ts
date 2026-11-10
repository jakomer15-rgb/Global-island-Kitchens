import "server-only";
import { cookies } from "next/headers";
import { CENTRE_LANG_COOKIE, type CentreLang } from "@/content/automation-centre";

/** The language staff chose for the Automation Centre (English unless they switched to Arabic). */
export async function getCentreLang(): Promise<CentreLang> {
  const value = (await cookies()).get(CENTRE_LANG_COOKIE)?.value;
  return value === "ar" ? "ar" : "en";
}
