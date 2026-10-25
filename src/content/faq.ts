import type { L } from "./types";

/**
 * FAQs answerable from docs/BUSINESS_FACTS.md only. Questions the facts can't answer (appliances,
 * warranties, lead times, prices) are left out until the owner supplies the answers.
 */
export interface Faq {
  id: string;
  question: L;
  answer: L;
}

export const faqs: Faq[] = [
  {
    id: "solid-wood",
    question: {
      en: "Are your wooden kitchens made of solid wood?",
      ar: "هل مطابخكم الخشبية مصنوعة من الخشب الصلب؟",
    },
    answer: {
      en: "No. We build with EGGER laminate and melamine-faced boards, whose wood-grain décors give the look of wood, and with painted MDF for smooth, colour-matched finishes.",
      ar: "لا. نصنعها من ألواح اللامينيت والميلامين من إيجر (EGGER)، التي تمنح تصاميمها بلون الخشب مظهر الخشب، ومن ألواح MDF المدهونة للتشطيبات الناعمة متناسقة الألوان.",
    },
  },
  {
    id: "materials",
    question: { en: "Which materials do you use?", ar: "ما الخامات التي تستخدمونها؟" },
    answer: {
      en: "EGGER laminate and melamine boards in wood-grain, solid-colour and stone-look décors, and MDF painted in the colour you choose. Aluminium kitchens are made in aluminium, and closets can have glass doors.",
      ar: "ألواح اللامينيت والميلامين من إيجر (EGGER) بتصاميم بلون الخشب وألوان سادة ومظهر الحجر، وألواح MDF المدهونة باللون الذي تختارونه. تُصنع مطابخ الألمنيوم من الألمنيوم، ويمكن أن تكون للخزائن أبواب زجاجية.",
    },
  },
  {
    id: "make-install",
    question: { en: "Do you manufacture and install yourselves?", ar: "هل تتولون التصنيع والتركيب بأنفسكم؟" },
    answer: {
      en: "Yes. We manufacture in our own factory in Hamad Town and install what we make.",
      ar: "نعم. نصنّع في مصنعنا في مدينة حمد ونركّب ما نصنعه.",
    },
  },
  {
    id: "large-projects",
    question: { en: "Do you take on large residential projects?", ar: "هل تنفذون مشاريع سكنية كبيرة؟" },
    answer: {
      en: "Yes. We specialise in bulk kitchen and wardrobe production and fixing, and have worked on residential buildings of up to 10 storeys and multi-villa projects.",
      ar: "نعم. نحن متخصصون في إنتاج وتركيب المطابخ والخزائن بكميات كبيرة، وقد عملنا في مبانٍ سكنية يصل ارتفاعها إلى 10 طوابق وفي مشاريع فلل متعددة.",
    },
  },
  {
    id: "commercial",
    question: { en: "Do you work on commercial spaces?", ar: "هل تعملون في المساحات التجارية؟" },
    answer: {
      en: "Yes. Our work includes cafe interiors, a cafe booth and retail interiors, as well as homes and residential buildings.",
      ar: "نعم. تشمل أعمالنا تصاميم داخلية لمقاهٍ وركن مقهى وتصاميم داخلية لمتاجر، إلى جانب المنازل والمباني السكنية.",
    },
  },
  {
    id: "custom",
    question: {
      en: "Can you make furniture to my exact sizes?",
      ar: "هل يمكنكم صنع الأثاث بمقاساتي الدقيقة؟",
    },
    answer: {
      en: "Yes. We make custom sizes, shapes and finishes for homes, offices and commercial spaces.",
      ar: "نعم. نصنع مقاسات وأشكالًا وتشطيبات حسب الطلب للمنازل والمكاتب والمساحات التجارية.",
    },
  },
  {
    id: "showroom",
    question: { en: "Where is your showroom, and when is it open?", ar: "أين صالة العرض، ومتى تفتح؟" },
    answer: {
      en: "Our showroom is at Building 2253B, Road 90, Block 1014, Al-Hamalah. Showroom hours are 9:00 AM to 8:00 PM.",
      ar: "صالة العرض في مبنى 2253B، طريق 90، مجمع 1014، الهملة. ساعات عمل صالة العرض من 9:00 صباحًا إلى 8:00 مساءً.",
    },
  },
  {
    id: "quotation",
    question: { en: "How do I get a quotation?", ar: "كيف أحصل على عرض سعر؟" },
    answer: {
      en: "Send us the room dimensions and any photos or drawings by email, or call us. Every piece is made to measure, so we quote for your specific design.",
      ar: "أرسلوا لنا مقاسات الغرفة وأي صور أو رسومات عبر البريد الإلكتروني، أو اتصلوا بنا. كل قطعة تُصنع على المقاس، لذا نقدّم عرض السعر لتصميمكم تحديدًا.",
    },
  },
  {
    id: "areas",
    question: { en: "Which areas do you work in?", ar: "في أي المناطق تعملون؟" },
    answer: {
      en: "We have delivered projects across Bahrain, including Juffair, Janabiya, Sanad, Adliya, Riffa, Hidd, Muharraq, Aali and Hamad Town.",
      ar: "نفّذنا مشاريع في أنحاء البحرين، منها الجفير والجنبية وسند والعدلية والرفاع والحد والمحرق وعالي ومدينة حمد.",
    },
  },
];
