import { z } from "zod";
import { consent, locale, name, optionalEmail, optionalText, phone, spamTraps } from "./common";
import { quoteCategories } from "./quote";

export const consultationTypes = ["showroom", "site_visit", "online"] as const;
export const timeSlots = ["morning", "afternoon", "evening"] as const;

/** Today in Bahrain as YYYY-MM-DD (the form's earliest date). */
export function bahrainToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bahrain" }).format(now);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const MAX_DAYS_AHEAD = 180;

export function consultationSchema(now = new Date()) {
  const today = bahrainToday(now);
  const latest = addDays(today, MAX_DAYS_AHEAD);
  return (
    z
      .object({
        ...spamTraps,
        locale,
        type: z.enum(consultationTypes, { message: "required" }),
        preferredDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "date")
          .refine((d) => d >= today && d <= latest, "dateRange"),
        preferredSlot: z.enum(timeSlots, { message: "required" }),
        area: optionalText(120),
        category: z.enum(quoteCategories).optional(),
        notes: optionalText(1000),
        name,
        phone,
        email: optionalEmail,
        ...consent,
      })
      // `when`: check this together with the other fields, so visitors see every problem at once.
      .refine((v) => v.type !== "site_visit" || Boolean(v.area), {
        message: "areaNeeded",
        path: ["area"],
        when: () => true,
      })
  );
}

export type ConsultationInput = z.input<ReturnType<typeof consultationSchema>>;
export type ConsultationRequest = z.output<ReturnType<typeof consultationSchema>>;
