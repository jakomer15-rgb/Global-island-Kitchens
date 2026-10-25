import type { ScopeTag } from "./products";
import type { L } from "./types";

/**
 * Projects from the company profile (P5–P7). Client, developer and contractor names are left out
 * until the owner confirms permission (docs/OPEN_QUESTIONS.md #24); building and place names are
 * kept. No photographs until usage permission is confirmed (#2). The profile's "all wood interior
 * work" is written as "complete interior joinery" (conflict #2 in BUSINESS_FACTS.md).
 */

export type Segment = "residential" | "villas" | "commercial";

export interface Project {
  slug: string;
  segment: Segment;
  name: L;
  location: L;
  /** Size or units, when the profile gives them. */
  size?: L;
  scope: ScopeTag[];
  scopeText: L;
  /** Shown in the profile's "Featured interiors" (P5). */
  featured?: boolean;
  /** Added in the admin, only with the client's permission. */
  clientName?: string;
  /** Photos added in the admin with usage permission (served by /media). */
  images?: { fileId: string; alt: L }[];
}

const fullJoinery: L = { en: "Complete interior joinery", ar: "أعمال نجارة داخلية متكاملة" };

export const projects: Project[] = [
  // Residential buildings and apartments
  {
    slug: "al-faris-suite-2-juffair",
    segment: "residential",
    name: { en: "Al Faris Suite 2", ar: "الفارس سويت 2" },
    location: { en: "Juffair", ar: "الجفير" },
    scope: ["furnished"],
    scopeText: { en: "Fully furnished", ar: "مفروش بالكامل" },
    featured: true,
  },
  {
    slug: "marassi-bay-flats",
    segment: "residential",
    name: { en: "Marassi Bay", ar: "مراسي باي" },
    location: { en: "Bahrain", ar: "البحرين" },
    size: {
      en: "10 flats: 5 one-bedroom flats and 5 studios",
      ar: "10 شقق: 5 شقق بغرفة نوم واحدة و5 استوديوهات",
    },
    scope: ["furnished"],
    scopeText: { en: "Fully furnished", ar: "مفروشة بالكامل" },
    featured: true,
  },
  {
    slug: "burj-kadi-juffair",
    segment: "residential",
    name: { en: "Burj Kadi", ar: "برج كادي" },
    location: { en: "Juffair", ar: "الجفير" },
    size: { en: "5 flats", ar: "5 شقق" },
    scope: ["fullJoinery"],
    scopeText: fullJoinery,
  },
  {
    slug: "vicuna-hajiyath",
    segment: "residential",
    name: { en: "Vicuna", ar: "فيكونا" },
    location: { en: "Hajiyath", ar: "الحجيات" },
    size: { en: "3 storeys", ar: "3 طوابق" },
    scope: ["kitchens", "closets", "bedSets", "tvUnits", "vanities", "doors", "cladding"],
    scopeText: {
      en: "Kitchen, closet, bed set, TV unit, vanity, doors and cladding",
      ar: "مطبخ وخزانة وطقم غرفة نوم ووحدة تلفزيون ووحدة مغسلة وأبواب وتكسيات",
    },
  },
  {
    slug: "vista-juffair",
    segment: "residential",
    name: { en: "Vista", ar: "فيستا" },
    location: { en: "Juffair", ar: "الجفير" },
    size: { en: "10 storeys", ar: "10 طوابق" },
    scope: ["kitchens"],
    scopeText: { en: "Kitchens", ar: "مطابخ" },
  },
  {
    slug: "capri-suites-janabiya",
    segment: "residential",
    name: { en: "Capri Suites", ar: "كابري سويتس" },
    location: { en: "Janabiya", ar: "الجنبية" },
    size: { en: "5 storeys", ar: "5 طوابق" },
    scope: ["kitchens", "closets", "vanities", "cladding"],
    scopeText: {
      en: "Kitchen, closet, vanity and wall cladding",
      ar: "مطبخ وخزانة ووحدة مغسلة وتكسيات جدران",
    },
  },
  {
    slug: "residential-building-sanad",
    segment: "residential",
    name: { en: "Residential building", ar: "مبنى سكني" },
    location: { en: "Sanad", ar: "سند" },
    size: { en: "6 storeys", ar: "6 طوابق" },
    scope: ["fullJoinery"],
    scopeText: fullJoinery,
  },
  {
    slug: "residential-building-adliya",
    segment: "residential",
    name: { en: "Residential building", ar: "مبنى سكني" },
    location: { en: "Adliya", ar: "العدلية" },
    size: { en: "7 storeys", ar: "7 طوابق" },
    scope: ["fullJoinery"],
    scopeText: fullJoinery,
  },
  {
    slug: "residential-project-nuwaidrat",
    segment: "residential",
    name: { en: "Residential project", ar: "مشروع سكني" },
    location: { en: "Nuwaidrat, Sanad", ar: "النويدرات، سند" },
    scope: ["fullJoinery"],
    scopeText: fullJoinery,
  },
  // Villas
  {
    slug: "villa-baquwa",
    segment: "villas",
    name: { en: "Three-storey villa", ar: "فيلا من ثلاثة طوابق" },
    location: { en: "Baquwa", ar: "Baquwa" },
    scope: ["kitchens", "closets", "tvUnits", "vanities", "cladding"],
    scopeText: {
      en: "Kitchen, closet, TV unit, vanity and cladding",
      ar: "مطبخ وخزانة ووحدة تلفزيون ووحدة مغسلة وتكسيات",
    },
  },
  {
    slug: "villa-muharraq",
    segment: "villas",
    name: { en: "Six-storey villa", ar: "فيلا من ستة طوابق" },
    location: { en: "Muharraq", ar: "المحرق" },
    scope: ["kitchens", "closets", "vanities"],
    scopeText: { en: "Kitchen, closet and vanity", ar: "مطبخ وخزانة ووحدة مغسلة" },
  },
  {
    slug: "villa-janabiya",
    segment: "villas",
    name: { en: "Five-storey villa", ar: "فيلا من خمسة طوابق" },
    location: { en: "Janabiya", ar: "الجنبية" },
    scope: ["kitchens", "closets", "bedSets", "tvUnits", "vanities", "doors", "cladding"],
    scopeText: {
      en: "Kitchen, closet, bed set, TV unit, vanity, doors and cladding",
      ar: "مطبخ وخزانة وطقم غرفة نوم ووحدة تلفزيون ووحدة مغسلة وأبواب وتكسيات",
    },
  },
  {
    slug: "villas-hidd",
    segment: "villas",
    name: { en: "Six villas", ar: "ست فلل" },
    location: { en: "Hidd", ar: "الحد" },
    size: { en: "Two storeys each", ar: "طابقان لكل فيلا" },
    scope: ["kitchens", "closets", "vanities"],
    scopeText: { en: "Kitchen, closet and vanity", ar: "مطبخ وخزانة ووحدة مغسلة" },
  },
  {
    slug: "villas-aali",
    segment: "villas",
    name: { en: "Four-villa project", ar: "مشروع أربع فلل" },
    location: { en: "Aali", ar: "عالي" },
    scope: ["fullJoinery"],
    scopeText: { en: "Villa interior works", ar: "أعمال داخلية للفلل" },
  },
  {
    slug: "414-villa-riffa",
    segment: "villas",
    name: { en: "414 Villa", ar: "فيلا 414" },
    location: { en: "Riffa", ar: "الرفاع" },
    size: { en: "2 storeys", ar: "طابقان" },
    scope: ["fullJoinery"],
    scopeText: fullJoinery,
  },
  {
    slug: "villas-north-riffa",
    segment: "villas",
    name: { en: "Two villas", ar: "فيلتان" },
    location: { en: "North Riffa", ar: "الرفاع الشمالي" },
    scope: ["fullJoinery"],
    scopeText: fullJoinery,
  },
  {
    slug: "al-naseem-phase-2",
    segment: "villas",
    name: { en: "Al Naseem Phase 2", ar: "النسيم المرحلة 2" },
    location: { en: "Diyar Al Muharraq", ar: "ديار المحرق" },
    scope: ["bedSets", "kitchens", "closets"],
    scopeText: { en: "Three bedroom sets, kitchens and a closet", ar: "ثلاثة أطقم غرف نوم ومطابخ وخزانة" },
  },
  {
    slug: "garden-villas",
    segment: "villas",
    name: { en: "Garden villa communities", ar: "مجمعات فلل" },
    location: {
      en: "Fahad Garden (Jasra), Palace Garden (Saar), Bahama, Mesheal and Venus Garden",
      ar: "Fahad Garden (الجسرة)، Palace Garden (سار)، Bahama وMesheal وVenus Garden",
    },
    scope: ["kitchens", "closets"],
    scopeText: { en: "Kitchens and closets", ar: "مطابخ وخزائن" },
  },
  // Commercial and hospitality
  {
    slug: "cafe-booth-sitra",
    segment: "commercial",
    name: { en: "Cafe booth", ar: "ركن مقهى" },
    location: { en: "Applied Science University, Sitra", ar: "جامعة العلوم التطبيقية، سترة" },
    scope: ["commercial"],
    scopeText: { en: "Cafe booth", ar: "ركن مقهى" },
  },
  {
    slug: "cafe-interiors-hamad-town",
    segment: "commercial",
    name: { en: "Cafe interiors", ar: "تصميم داخلي لمقهى" },
    location: { en: "Hamad Town", ar: "مدينة حمد" },
    scope: ["commercial"],
    scopeText: { en: "Cafe interiors", ar: "أعمال داخلية لمقهى" },
  },
  {
    slug: "retail-interiors-diyar-al-muharraq",
    segment: "commercial",
    name: { en: "Retail interiors", ar: "تصميم داخلي لمتجر" },
    location: { en: "Diyar Al Muharraq", ar: "ديار المحرق" },
    scope: ["commercial"],
    scopeText: { en: "Retail interiors", ar: "أعمال داخلية لمتجر" },
  },
];

export const segmentLabels: Record<Segment, L> = {
  residential: { en: "Residential buildings & apartments", ar: "مبانٍ سكنية وشقق" },
  villas: { en: "Villas", ar: "فلل" },
  commercial: { en: "Commercial & hospitality", ar: "مساحات تجارية وضيافة" },
};

export function getProject(slug: string) {
  return projects.find((p) => p.slug === slug);
}

/**
 * Projects whose stated scope includes one of the tags. "Complete joinery" and "fully furnished"
 * projects are not matched to specific products: the profile doesn't say which items they included.
 */
export function projectsWithScope(tags: ScopeTag[], list: Project[] = projects) {
  return list.filter((p) => p.scope.some((s) => tags.includes(s)));
}
