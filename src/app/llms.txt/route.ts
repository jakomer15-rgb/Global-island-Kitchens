import { pathFor, type PageKey } from "@/config/routes";
import { company } from "@/config/company";
import { siteUrl } from "@/config/site";
import { products } from "@/content/products";
import { getSiteSettings } from "@/server/settings/site";

/**
 * /llms.txt: a plain-text summary of the company for AI search tools (ChatGPT, Perplexity, Gemini),
 * written only from approved facts (docs/BUSINESS_FACTS.md) and the admin's contact settings, so it
 * never disagrees with the website.
 */
export async function GET(): Promise<Response> {
  const { contact, locations } = await getSiteSettings();
  const url = (key: PageKey) => new URL(pathFor(key), siteUrl).toString();
  const lines = [
    `# ${company.legalName}`,
    "",
    `> ${company.shortName} manufactures, supplies and installs kitchens, wardrobes and interior joinery in the Kingdom of Bahrain, for homes, residential buildings, villas and commercial spaces. Over ${company.yearsOfExperience} years of experience; specialised in bulk kitchen and wardrobe production and fixing. Kitchens and joinery are made in the company's factory in Hamad Town from EGGER laminate and melamine boards or painted MDF, with aluminium and glass for aluminium kitchens.`,
    "",
    "## Contact",
    "",
    `- Phone: ${contact.phones.map((p) => p.display).join(" / ")} (Bahrain, +973)`,
    `- Email: ${contact.email}`,
    `- Showroom: ${locations.showroomEn.join(", ")}. ${locations.hoursEn}`,
    `- Head office and factory: ${locations.headOfficeEn.join(", ")}`,
    `- Instagram: https://www.instagram.com/${contact.instagramHandle}/`,
    "",
    "## What we make",
    "",
    ...products.map((p) => `- [${p.name.en}](${url(p.key)}): ${p.metaDescription.en}`),
    `- [Laundry rooms, doors, Murphy beds and bespoke joinery](${url("bespoke")})`,
    "",
    "## More",
    "",
    `- [Projects](${url("projects")}): residential buildings, villas and commercial interiors across Bahrain`,
    `- [Materials & finishes](${url("materials")})`,
    `- [For designers, architects & developers](${url("designers")})`,
    `- [Showroom](${url("showroom")})`,
    `- [FAQ](${url("faq")})`,
    `- [Request a quotation](${url("requestQuote")})`,
    `- [Arabic version of the site](${new URL("/ar", siteUrl).toString()})`,
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
