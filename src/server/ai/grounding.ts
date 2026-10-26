import { company } from "@/config/company";
import { products } from "@/content/products";

/**
 * What the assistants may say about the company: only facts from docs/BUSINESS_FACTS.md as they
 * appear in src/config and src/content, plus hard rules. Anything not here is "the team will confirm".
 */
export function groundingFacts(): string {
  const lines = [
    `Company: ${company.legalName}, Kingdom of Bahrain. Manufacturer, supplier and installer of kitchens, wardrobes and interior joinery.`,
    `Head office and factory: ${company.headOffice.lines.join(", ")}. Showroom: ${company.showroom.lines.join(", ")}.`,
    "Products:",
    ...products.map((p) => `- ${p.name.en}: ${p.makes.en.join("; ")}`),
    "Materials: only EGGER laminate and melamine-faced boards and painted MDF. Aluminium is used for aluminium kitchens and glass for glass fronts.",
  ];
  return lines.join("\n");
}

export const hardRules = [
  "Use only the facts given. If something is not given, say the team will confirm it.",
  "Never state prices, discounts, delivery or installation times, warranty terms, certifications, client names or project counts.",
  "Never mention materials, brands or finishes other than those listed.",
  "Do not promise anything on the company's behalf. Do not ask for passwords, card numbers or identity documents.",
  "Write plain text only: no HTML or markdown links.",
].join("\n");

const contactLine = /^\s*(name|phone|mobile|email|e-mail)\s*:.*$/gim;
const emailPattern = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const phonePattern = /\+?\d[\d\s().-]{6,}\d/g;

/** Takes contact details out of text before it goes to the AI provider. */
export function redactContact(text: string): string {
  return text
    .replace(contactLine, "")
    .replace(emailPattern, "[email removed]")
    .replace(phonePattern, "[number removed]")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
