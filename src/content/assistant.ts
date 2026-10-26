/**
 * Wording for the unsubscribe page and the public furniture assistant. Arabic needs a fluent review
 * (docs/OPEN_QUESTIONS.md).
 */
export const unsubscribePage = {
  title: { en: "Unsubscribe", ar: "إلغاء الاشتراك" },
  body: {
    email: {
      en: "Stop emails from Global Island Kitchens that are not replies to your own requests?",
      ar: "هل تريدون إيقاف رسائل البريد الإلكتروني من Global Island Kitchens غير المرتبطة بطلباتكم؟",
    },
    whatsapp: {
      en: "Stop WhatsApp messages from Global Island Kitchens that are not replies to your own requests?",
      ar: "هل تريدون إيقاف رسائل واتساب من Global Island Kitchens غير المرتبطة بطلباتكم؟",
    },
  },
  button: { en: "Unsubscribe", ar: "إلغاء الاشتراك" },
  done: {
    en: "Done. You will not receive these messages. We may still reply to a request you send us.",
    ar: "تم. لن تصلكم هذه الرسائل. قد نرد على أي طلب ترسلونه إلينا.",
  },
  invalid: {
    en: "This link is not valid. Please contact us and we will update your choice.",
    ar: "هذا الرابط غير صالح. يرجى التواصل معنا لتحديث اختياركم.",
  },
} as const;

export const furniturePage = {
  eyebrow: { en: "Furniture assistant", ar: "مساعد الأثاث" },
  title: { en: "Not sure which product fits?", ar: "لستم متأكدين أي منتج يناسبكم؟" },
  intro: {
    en: "Describe the room or what you need. An AI assistant suggests which of our product lines may fit and what our team will need to know. It is a first idea, not a quotation.",
    ar: "صفوا الغرفة أو ما تحتاجونه. يقترح مساعد ذكاء اصطناعي أي خطوط منتجاتنا قد تناسبكم وما يحتاج فريقنا إلى معرفته. إنها فكرة أولية وليست عرض سعر.",
  },
  notice: {
    en: "Your text is sent to an AI provider to write the answer. Please do not type names, phone numbers or other personal details. The answer can be wrong: our team confirms everything in a quotation.",
    ar: "يُرسل نصكم إلى مزوّد ذكاء اصطناعي لكتابة الإجابة. يرجى عدم كتابة أسماء أو أرقام هواتف أو بيانات شخصية. قد تكون الإجابة غير دقيقة: يؤكد فريقنا كل شيء في عرض السعر.",
  },
  label: { en: "What do you need?", ar: "ما الذي تحتاجونه؟" },
  hint: {
    en: "For example: a small kitchen in an apartment, light wood look, family of four.",
    ar: "مثال: مطبخ صغير في شقة، بمظهر خشب فاتح، لعائلة من أربعة أفراد.",
  },
  submit: { en: "Get suggestions", ar: "احصلوا على اقتراحات" },
  asking: { en: "Thinking…", ar: "جارٍ التفكير…" },
  suggested: { en: "Product lines to look at", ar: "خطوط المنتجات المقترحة" },
  nextQuestion: { en: "Our team would also ask", ar: "وسيسألكم فريقنا أيضًا" },
  quote: { en: "Request a quotation", ar: "اطلبوا عرض سعر" },
  errors: {
    aiOff: { en: "The assistant is not available right now.", ar: "المساعد غير متاح حاليًا." },
    tooShort: { en: "Please write a little more.", ar: "يرجى كتابة المزيد." },
    tooMany: { en: "Too many questions. Please try again later.", ar: "أسئلة كثيرة. يرجى المحاولة لاحقًا." },
    busy: {
      en: "The assistant is busy. Please try again tomorrow.",
      ar: "المساعد مشغول. يرجى المحاولة غدًا.",
    },
    server: { en: "Something went wrong. Please try again.", ar: "حدث خطأ. يرجى المحاولة مجددًا." },
  },
} as const;
