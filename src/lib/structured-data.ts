import { company } from "@/config/company";
import { siteUrl } from "@/config/site";
import { localizedPath } from "@/lib/seo";
import type { Locale } from "@/i18n/routing";

/**
 * Organization and showroom JSON-LD from verified facts only. Opening days and map coordinates
 * are left out until confirmed (docs/OPEN_QUESTIONS.md #7, #9). No review markup.
 */
export function organizationJsonLd(locale: Locale) {
  const url = new URL(localizedPath("/", locale), siteUrl).toString();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: company.legalName,
        url,
        email: company.email,
        telephone: company.phones.map((p) => p.e164),
        sameAs: [company.instagram.url],
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
        email: company.email,
        telephone: company.phones[0].e164,
        address: {
          "@type": "PostalAddress",
          streetAddress: "Building 2253B, Road 90, Block 1014",
          addressLocality: "Al-Hamalah",
          addressCountry: "BH",
        },
      },
    ],
  };
}
