import type { PageKey } from "@/config/routes";
import type { L, LList } from "./types";

export type ProductKey = Extract<
  PageKey,
  | "woodenKitchens"
  | "aluminiumKitchens"
  | "wardrobes"
  | "walkInClosets"
  | "bedroomFurniture"
  | "tvUnits"
  | "wallCladding"
  | "bathroomVanities"
>;

/** Scope tags used to match products with projects (src/content/projects.ts). */
export type ScopeTag =
  | "kitchens"
  | "closets"
  | "bedSets"
  | "tvUnits"
  | "vanities"
  | "doors"
  | "cladding"
  | "fullJoinery"
  | "furnished"
  | "commercial";

export interface Product {
  key: ProductKey;
  name: L;
  /** Meta title (≤ 60 characters with the brand suffix). */
  metaTitle: L;
  metaDescription: L;
  intro: L;
  /** What the profile says the company makes in this line. */
  makes: LList;
  /** Which board families apply (materials rule: EGGER laminate/melamine and painted MDF; aluminium for aluminium kitchens). */
  materials: ("egger" | "mdf" | "aluminium")[];
  scope: ScopeTag[];
}

export const products: Product[] = [
  {
    key: "woodenKitchens",
    name: { en: "Customised wooden kitchens", ar: "مطابخ خشبية حسب الطلب" },
    metaTitle: { en: "Custom Kitchens in Bahrain", ar: "مطابخ حسب الطلب في البحرين" },
    metaDescription: {
      en: "Modern fitted kitchens made to measure in EGGER laminate and melamine boards or painted MDF, manufactured in Hamad Town and installed across Bahrain.",
      ar: "مطابخ عصرية مجهّزة على المقاس من ألواح اللامينيت والميلامين من إيجر (EGGER) أو ألواح MDF مدهونة، تُصنع في مدينة حمد وتُركَّب في أنحاء البحرين.",
    },
    intro: {
      en: "Modern fitted kitchens, made to measure in our Hamad Town factory. The wood look comes from EGGER laminate and melamine-faced boards in wood-grain décors; for a smooth, colour-matched finish we use painted MDF.",
      ar: "مطابخ عصرية مجهّزة تُصنع على المقاس في مصنعنا في مدينة حمد. يأتي مظهر الخشب من ألواح اللامينيت والميلامين من إيجر (EGGER) بتصاميم بلون الخشب، ونستخدم ألواح MDF المدهونة لتشطيب ناعم متناسق الألوان.",
    },
    makes: {
      en: [
        "Modern fitted kitchens for homes and apartments",
        "Kitchens for residential buildings and villa projects, produced in bulk",
        "Custom sizes, shapes and finishes",
      ],
      ar: [
        "مطابخ عصرية مجهّزة للمنازل والشقق",
        "مطابخ للمباني السكنية ومشاريع الفلل، تُنتج بكميات كبيرة",
        "مقاسات وأشكال وتشطيبات حسب الطلب",
      ],
    },
    materials: ["egger", "mdf"],
    scope: ["kitchens"],
  },
  {
    key: "aluminiumKitchens",
    name: { en: "Aluminium kitchens", ar: "مطابخ الألمنيوم" },
    metaTitle: { en: "Aluminium Kitchens in Bahrain", ar: "مطابخ الألمنيوم في البحرين" },
    metaDescription: {
      en: "Aluminium kitchens made to order by Global Island Kitchens in Bahrain. Visit our Al-Hamalah showroom or contact us to discuss your kitchen.",
      ar: "مطابخ ألمنيوم تُصنع حسب الطلب لدى Global Island Kitchens في البحرين. زوروا صالة العرض في الهملة أو تواصلوا معنا لمناقشة مطبخكم.",
    },
    intro: {
      en: "Aluminium kitchens are one of our core product lines, made to order alongside our board kitchens. Talk to us about your space and we will advise on the options.",
      ar: "مطابخ الألمنيوم أحد خطوط إنتاجنا الرئيسية، وتُصنع حسب الطلب إلى جانب مطابخ الألواح. حدّثونا عن مساحتكم وسننصحكم بالخيارات المناسبة.",
    },
    makes: {
      en: ["Aluminium kitchens, made to order", "Designed, manufactured and installed by one company"],
      ar: ["مطابخ ألمنيوم تُصنع حسب الطلب", "تصميم وتصنيع وتركيب لدى شركة واحدة"],
    },
    materials: ["aluminium"],
    // The profile doesn't say which project kitchens were aluminium, so none are linked here.
    scope: [],
  },
  {
    key: "wardrobes",
    name: { en: "Wardrobes", ar: "خزائن الملابس" },
    metaTitle: { en: "Fitted Wardrobes in Bahrain", ar: "خزائن ملابس مدمجة في البحرين" },
    metaDescription: {
      en: "Hinged-door and sliding-door wardrobes and glass-door closets, made to measure in EGGER boards or painted MDF and installed across Bahrain.",
      ar: "خزائن ملابس بأبواب مفصلية وأبواب منزلقة وخزائن بأبواب زجاجية، تُصنع على المقاس من ألواح إيجر (EGGER) أو MDF مدهون وتُركَّب في أنحاء البحرين.",
    },
    intro: {
      en: "Wardrobes made to fit the room, with hinged or sliding doors, and closets with glass doors. We produce wardrobes for single homes and in bulk for residential projects.",
      ar: "خزائن ملابس تُصنع لتناسب الغرفة، بأبواب مفصلية أو منزلقة، وخزائن بأبواب زجاجية. ننتج الخزائن للمنازل الفردية وبكميات كبيرة للمشاريع السكنية.",
    },
    makes: {
      en: [
        "Hinged-door wardrobes",
        "Sliding-door wardrobes",
        "Glass-door closets",
        "Bulk production for residential projects",
      ],
      ar: [
        "خزائن بأبواب مفصلية",
        "خزائن بأبواب منزلقة",
        "خزائن بأبواب زجاجية",
        "إنتاج بكميات كبيرة للمشاريع السكنية",
      ],
    },
    materials: ["egger", "mdf"],
    scope: ["closets"],
  },
  {
    key: "walkInClosets",
    name: { en: "Walk-in closets", ar: "غرف الملابس" },
    metaTitle: { en: "Walk-in Closets in Bahrain", ar: "غرف الملابس في البحرين" },
    metaDescription: {
      en: "Walk-in closets made to measure by Global Island Kitchens, in EGGER laminate and melamine boards or painted MDF, manufactured in Hamad Town.",
      ar: "غرف ملابس تُصنع على المقاس لدى Global Island Kitchens من ألواح اللامينيت والميلامين من إيجر (EGGER) أو MDF مدهون، في مصنعنا بمدينة حمد.",
    },
    intro: {
      en: "Walk-in closets, made to measure for the room you have. Designed, manufactured in our Hamad Town factory and installed by Global Island Kitchens.",
      ar: "غرف ملابس تُصنع على مقاس الغرفة لديكم، تُصمَّم وتُصنع في مصنعنا في مدينة حمد وتُركّبها Global Island Kitchens.",
    },
    makes: {
      en: ["Walk-in closets made to measure", "Designed, manufactured and installed by one company"],
      ar: ["غرف ملابس على المقاس", "تصميم وتصنيع وتركيب لدى شركة واحدة"],
    },
    materials: ["egger", "mdf"],
    scope: ["closets"],
  },
  {
    key: "bedroomFurniture",
    name: { en: "Bedroom furniture", ar: "أثاث غرف النوم" },
    metaTitle: { en: "Custom Bedroom Furniture, Bahrain", ar: "أثاث غرف نوم حسب الطلب، البحرين" },
    metaDescription: {
      en: "Bed sets with headboard panels, bedside units and dressing tables, and Murphy beds, made to order in EGGER boards or painted MDF in Bahrain.",
      ar: "أطقم غرف نوم بألواح خلفية للسرير ووحدات جانبية وتسريحات، وأسرّة قابلة للطي (Murphy)، تُصنع حسب الطلب من ألواح إيجر (EGGER) أو MDF مدهون في البحرين.",
    },
    intro: {
      en: "Bed sets made to order: headboard panels, bedside units and dressing tables, finished to match the rest of the room. We also make Murphy beds.",
      ar: "أطقم غرف نوم تُصنع حسب الطلب: ألواح خلفية للسرير ووحدات جانبية وتسريحات، بتشطيبات تتناسق مع بقية الغرفة. ونصنع أيضًا الأسرّة القابلة للطي (Murphy).",
    },
    makes: {
      en: ["Bed sets with headboard panels", "Bedside units", "Dressing tables", "Murphy beds"],
      ar: ["أطقم أسرّة بألواح خلفية", "وحدات جانبية", "تسريحات", "أسرّة قابلة للطي (Murphy)"],
    },
    materials: ["egger", "mdf"],
    scope: ["bedSets"],
  },
  {
    key: "tvUnits",
    name: { en: "TV units", ar: "وحدات التلفزيون" },
    metaTitle: { en: "TV Units & Feature Walls, Bahrain", ar: "وحدات التلفزيون والجدران المميزة، البحرين" },
    metaDescription: {
      en: "TV units and feature walls with integrated lighting, made to measure in EGGER boards or painted MDF by Global Island Kitchens in Bahrain.",
      ar: "وحدات تلفزيون وجدران مميزة بإضاءة مدمجة، تُصنع على المقاس من ألواح إيجر (EGGER) أو MDF مدهون لدى Global Island Kitchens في البحرين.",
    },
    intro: {
      en: "TV units designed as feature walls, with integrated lighting, made to measure for your living space.",
      ar: "وحدات تلفزيون مصممة كجدران مميزة بإضاءة مدمجة، تُصنع على مقاس مساحة المعيشة لديكم.",
    },
    makes: {
      en: ["Feature walls with integrated lighting", "TV units made to measure"],
      ar: ["جدران مميزة بإضاءة مدمجة", "وحدات تلفزيون على المقاس"],
    },
    materials: ["egger", "mdf"],
    scope: ["tvUnits"],
  },
  {
    key: "wallCladding",
    name: { en: "Wall cladding", ar: "تكسيات الجدران" },
    metaTitle: { en: "Wall Cladding & Panelling, Bahrain", ar: "تكسيات وألواح الجدران، البحرين" },
    metaDescription: {
      en: "Slatted and panel wall cladding and panelled living spaces with LED accents, in EGGER boards or painted MDF, made in Bahrain.",
      ar: "تكسيات جدران شرائحية وألواح، ومساحات معيشة مكسوّة بلمسات إضاءة LED، من ألواح إيجر (EGGER) أو MDF مدهون، تُصنع في البحرين.",
    },
    intro: {
      en: "Slatted and panel cladding for walls, and fully panelled living areas with LED accents, made in our factory to fit your rooms.",
      ar: "تكسيات شرائحية وألواح للجدران، ومساحات معيشة مكسوّة بالكامل بلمسات إضاءة LED، تُصنع في مصنعنا لتناسب غرفكم.",
    },
    makes: {
      en: ["Slatted wall cladding", "Panel cladding", "Panelled living areas with LED accents"],
      ar: ["تكسيات جدران شرائحية", "تكسيات بالألواح", "مساحات معيشة مكسوّة بلمسات إضاءة LED"],
    },
    materials: ["egger", "mdf"],
    scope: ["cladding"],
  },
  {
    key: "bathroomVanities",
    name: { en: "Bathroom vanities", ar: "وحدات المغاسل" },
    metaTitle: { en: "Bathroom Vanities in Bahrain", ar: "وحدات مغاسل الحمامات في البحرين" },
    metaDescription: {
      en: "Floating and tall-unit bathroom vanities made to measure by Global Island Kitchens, manufactured in Hamad Town and installed across Bahrain.",
      ar: "وحدات مغاسل معلّقة وطويلة تُصنع على المقاس لدى Global Island Kitchens في مصنعنا بمدينة حمد وتُركَّب في أنحاء البحرين.",
    },
    intro: {
      en: "Floating vanities and tall storage units for bathrooms, made to measure for homes and residential projects.",
      ar: "وحدات مغاسل معلّقة ووحدات تخزين طويلة للحمامات، تُصنع على المقاس للمنازل والمشاريع السكنية.",
    },
    makes: {
      en: ["Floating vanities", "Tall-unit vanities", "Made to measure for homes and residential projects"],
      ar: ["وحدات مغاسل معلّقة", "وحدات مغاسل طويلة", "على المقاس للمنازل والمشاريع السكنية"],
    },
    materials: ["egger", "mdf"],
    scope: ["vanities"],
  },
];

export function getProduct(key: ProductKey) {
  const product = products.find((p) => p.key === key);
  if (!product) throw new Error(`Unknown product ${key}`);
  return product;
}

/** Other products from the profile without their own page. */
export const moreProducts: LList = {
  en: [
    "Laundry rooms with fitted cabinets and smart storage",
    "Laminate doors with concealed hinges and matching handles",
    "Murphy beds",
    "Custom cabinets and bespoke pieces",
  ],
  ar: [
    "غرف غسيل بخزائن مجهّزة وتخزين ذكي",
    "أبواب من اللامينيت بمفصلات مخفية ومقابض متطابقة",
    "أسرّة قابلة للطي (Murphy)",
    "خزائن وقطع حسب الطلب",
  ],
};
