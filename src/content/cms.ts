import type { L } from "./types";

/**
 * Fixed copy around content that staff manage in the admin (blog posts, testimonials, the
 * décor library). The managed content itself lives in the database.
 */

export const blogPage = {
  metaTitle: { en: "Blog", ar: "المدونة" } satisfies L,
  metaDescription: {
    en: "Articles from Global Island Kitchens on kitchens, wardrobes, EGGER boards and painted MDF.",
    ar: "مقالات من Global Island Kitchens عن المطابخ وخزائن الملابس وألواح EGGER وألواح MDF المطلية.",
  } satisfies L,
  eyebrow: { en: "Blog", ar: "المدونة" } satisfies L,
  title: { en: "Notes from the workshop", ar: "من الورشة" } satisfies L,
  intro: {
    en: "Practical articles about planning, materials and care, written by our team.",
    ar: "مقالات عملية عن التخطيط والمواد والعناية، يكتبها فريقنا.",
  } satisfies L,
  published: { en: "Published", ar: "نُشر في" } satisfies L,
  readMore: { en: "Read the article", ar: "اقرؤوا المقال" } satisfies L,
  back: { en: "All articles", ar: "كل المقالات" } satisfies L,
};

export const testimonialsSection = {
  eyebrow: { en: "In their words", ar: "بكلماتهم" } satisfies L,
  title: { en: "What our clients say", ar: "ماذا يقول عملاؤنا" } satisfies L,
  note: {
    en: "Shared with each client's permission.",
    ar: "تُنشر بإذن كل عميل.",
  } satisfies L,
};

export const decorLibrary = {
  title: { en: "Décors we work with", ar: "الديكورات التي نعمل بها" } satisfies L,
  intro: {
    en: "A selection from the EGGER range and our painted MDF colours, checked against what we can currently supply. Ask us for samples and the full range.",
    ar: "مختارات من تشكيلة EGGER وألوان MDF المطلية لدينا، تحققنا من توفرها حاليًا. اطلبوا منا العينات والتشكيلة الكاملة.",
  } satisfies L,
  boards: {
    egger_laminate: { en: "EGGER laminate", ar: "لامينيت EGGER" },
    egger_melamine: { en: "EGGER melamine", ar: "ميلامين EGGER" },
    painted_mdf: { en: "Painted MDF", ar: "MDF مطلي" },
  } satisfies Record<string, L>,
  availability: {
    in_stock: { en: "Usually in stock", ar: "متوفر عادةً" },
    to_order: { en: "To order", ar: "حسب الطلب" },
    unverified: { en: "Ask about availability", ar: "استفسروا عن التوفر" },
    discontinued: { en: "Discontinued", ar: "متوقف" },
  } satisfies Record<string, L>,
  swatchNote: {
    en: "Colours on screen are approximate; please see a physical sample before you choose.",
    ar: "الألوان على الشاشة تقريبية؛ يُرجى رؤية عينة فعلية قبل الاختيار.",
  } satisfies L,
};
