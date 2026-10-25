/**
 * Company facts used by the website. Every value comes from docs/BUSINESS_FACTS.md
 * ([P] = company profile PDF page, [O] = owner's instructions). Unknown details are null and
 * are not shown. Contact details, addresses and hours are the defaults for the site settings the
 * admin can edit (src/server/settings); public pages read those settings, not these constants.
 */

export interface Phone {
  /** As printed in the profile. */
  display: string;
  /** E.164 for tel: links (Bahrain +973). */
  e164: string;
}

// [P1, P8]
const phones = [
  { display: "3459 7636", e164: "+97334597636" },
  { display: "7790 1988", e164: "+97377901988" },
] as const satisfies readonly Phone[];

export const company = {
  legalName: "Global Island Kitchens W.L.L", // [P1]
  shortName: "Global Island Kitchens",
  /** Arabic company name is not yet confirmed (docs/OPEN_QUESTIONS.md #4); the Latin name is used. */
  arabicName: null as string | null,
  yearsOfExperience: 11, // "over 11 years" [P2]
  projectsShowcased: 20, // "20+" [P2]
  coreProductLines: 9, // [P2]
  phones,
  email: "globalkitchen.bh@gmail.com", // [P1, P8]
  instagram: { handle: "global_islandkitchens", url: "https://www.instagram.com/global_islandkitchens/" }, // [P1, P8]
  /**
   * WhatsApp number: not yet confirmed which phone has WhatsApp (OPEN_QUESTIONS #8).
   * Set it in Admin → Settings → Contact (or NEXT_PUBLIC_WHATSAPP_NUMBER before the first seed).
   */
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") || null,
  headOffice: {
    // [P8]; the factory is in Hamad Town [O]
    lines: ["Bldg 3301, Road 360", "Block 1203, Hamad Town", "Kingdom of Bahrain"],
    linesAr: ["مبنى 3301، طريق 360", "مجمع 1203، مدينة حمد", "مملكة البحرين"],
  },
  showroom: {
    // [P8]
    lines: ["Building 2253B, Road 90", "Block 1014, Al-Hamalah", "Kingdom of Bahrain"],
    linesAr: ["مبنى 2253B، طريق 90", "مجمع 1014، الهملة", "مملكة البحرين"],
    /** 9:00 AM – 8:00 PM [O]; opening days are not yet confirmed (OPEN_QUESTIONS #7). */
    opens: "09:00",
    closes: "20:00",
  },
  machinery: ["sliding-panel-saw", "edge-banding", "boring-station", "miter-station"] as const, // [P8]
} as const;

export function telHref(phone: Phone) {
  return `tel:${phone.e164}`;
}

export function instagramUrl(handle: string) {
  return `https://www.instagram.com/${handle}/`;
}

/** mailto: link with a pre-filled subject and body. */
export function mailtoHref(email: string, subject?: string, body?: string) {
  const params = [
    subject && `subject=${encodeURIComponent(subject)}`,
    body && `body=${encodeURIComponent(body)}`,
  ].filter(Boolean);
  return `mailto:${email}${params.length ? `?${params.join("&")}` : ""}`;
}

export function whatsappHref(number: string, message?: string) {
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${number}${text}`;
}
