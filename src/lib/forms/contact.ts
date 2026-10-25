import { z } from "zod";
import { normalisePhone } from "@/lib/phone";
import { consent, locale, name, optionalEmail, spamTraps } from "./common";

/** Contact form: a phone number or an email (at least one), and a message. */
export const contactSchema = z
  .object({
    ...spamTraps,
    locale,
    name,
    phone: z
      .string()
      .trim()
      .max(30, "phone")
      .optional()
      .transform((v, ctx) => {
        if (!v) return undefined;
        const e164 = normalisePhone(v);
        if (!e164) {
          ctx.addIssue({ code: "custom", message: "phone" });
          return z.NEVER;
        }
        return e164;
      }),
    email: optionalEmail,
    message: z.string().trim().min(10, "messageShort").max(2000, "tooLong"),
    ...consent,
  })
  // `when`: check this together with the other fields, so visitors see every problem at once.
  .refine((v) => Boolean(v.phone || v.email), { message: "phoneOrEmail", path: ["phone"], when: () => true });

export type ContactInput = z.input<typeof contactSchema>;
export type ContactRequest = z.output<typeof contactSchema>;
