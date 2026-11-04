import { company, instagramUrl } from "@/config/company";
import { siteUrl } from "@/config/site";
import { localizedPath } from "@/lib/seo";
import type { Locale } from "@/i18n/routing";
import type { ContactSettings, LocationSettings } from "@/lib/site-settings";

/**
 * Organization and showroom JSON-LD from verified facts only. Map coordinates are left out until
 * confirmed (docs/OPEN_QUESTIONS.md #9). No review markup.
 */
export function organizationJsonLd(locale: Locale, contact: ContactSettings, locations: LocationSettings) {
  const url = new URL(localizedPath("/", locale), siteUrl).toString();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: company.legalName,
        url,
        email: contact.email,
        telephone: contact.phones.map((p) => p.e164),
        sameAs: [instagramUrl(contact.instagramHandle)],
        address: {
          "@type": "PostalAddress",
          streetAddress: "Bldg 3301, Road 360, Block 1203",
          addressLocality: "Hamad Town",
          addressCountry: "BH",
        },
      },
      {
        "@type": "FurnitureStore",
        "@id": `${siteUrl}/#showroom`,
        name: `${company.shortName} Showroom`,
        parentOrganization: { "@id": `${siteUrl}/#organization` },
        url,
        email: contact.email,
        telephone: contact.phones[0].e164,
        address: {
          "@type": "PostalAddress",
          streetAddress: "Building 2253B, Road 90, Block 1014",
          addressLocality: "Al-Hamalah",
          addressCountry: "BH",
        },
        openingHoursSpecification: {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: company.showroom.openDays,
          opens: company.showroom.opens,
          closes: company.showroom.closes,
        },
        ...(locations.mapUrl ? { hasMap: locations.mapUrl } : {}),
      },
    ],
  };
}
