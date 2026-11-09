import { products, type ProductKey } from "./products";

/**
 * Wording for the floating "GIK Smart Assistant" chat. The welcome text is the owner's (2026-11-09).
 * Arabic needs a fluent review (docs/OPEN_QUESTIONS.md). Replies in Hindi and Urdu come from the
 * assistant itself; the chat window's own labels are English or Arabic like the rest of the site.
 */

export const chatCopy = {
  name: { en: "GIK Smart Assistant", ar: "مساعد GIK الذكي" },
  role: { en: "AI assistant", ar: "مساعد ذكاء اصطناعي" },
  open: { en: "Chat with GIK Smart Assistant", ar: "تحدثوا مع مساعد GIK الذكي" },
  close: { en: "Close chat", ar: "إغلاق المحادثة" },
  restart: { en: "Start over", ar: "محادثة جديدة" },
  loading: { en: "Opening the chat…", ar: "جارٍ فتح المحادثة…" },
  welcome: {
    en: "Welcome to Global Island Kitchens!\n\nI'm your AI Interior Design & Sales Assistant.\n\nLooking for a customised kitchen, wardrobe or complete bedroom solution? I can help you explore designs, understand customisation options and arrange a quotation.\n\nHow may I assist you today?",
    ar: "أهلًا بكم في Global Island Kitchens!\n\nأنا مساعدكم الذكي للتصميم الداخلي والمبيعات.\n\nهل تبحثون عن مطبخ حسب الطلب أو خزانة ملابس أو غرفة نوم متكاملة؟ يمكنني مساعدتكم في استكشاف التصاميم وفهم خيارات التخصيص وترتيب عرض سعر.\n\nكيف يمكنني مساعدتكم اليوم؟",
  },
  notice: {
    en: "You are chatting with an AI assistant, not a person. Please don't type phone numbers or other personal details here: if you'd like our team to contact you, the assistant will ask in a separate form.",
    ar: "أنتم تتحدثون مع مساعد ذكاء اصطناعي وليس مع شخص. يرجى عدم كتابة أرقام الهواتف أو أي بيانات شخصية هنا: إذا رغبتم في أن يتواصل معكم فريقنا، سيطلبها المساعد في نموذج منفصل.",
  },
  quickTitle: { en: "Quick options", ar: "خيارات سريعة" },
  inputLabel: { en: "Your message", ar: "رسالتكم" },
  placeholder: { en: "Type your question…", ar: "اكتبوا سؤالكم…" },
  send: { en: "Send", ar: "إرسال" },
  typing: { en: "The assistant is typing…", ar: "المساعد يكتب…" },
  you: { en: "You", ar: "أنتم" },
  assistant: { en: "Assistant", ar: "المساعد" },
  viewProduct: { en: "View", ar: "عرض" },
  requestQuote: { en: "Request a quotation", ar: "اطلبوا عرض سعر" },
  bookVisit: { en: "Book a visit", ar: "احجزوا زيارة" },
  aboutShowroom: { en: "About the showroom", ar: "عن صالة العرض" },
  call: { en: "Call", ar: "اتصلوا" },
  whatsapp: { en: "WhatsApp", ar: "واتساب" },
  email: { en: "Email", ar: "البريد الإلكتروني" },
  newTab: { en: "(opens in a new tab)", ar: "(يفتح في علامة تبويب جديدة)" },
  cards: {
    product: {
      en: "Here is an overview. Tell me about your space (room, approximate size, the look you like) and I can help you narrow down the options.",
      ar: "إليكم نظرة عامة. أخبروني عن مساحتكم (الغرفة، والمقاس التقريبي، والطابع الذي تفضلونه) وسأساعدكم في اختيار ما يناسبكم.",
    },
    quote: {
      en: "Happy to help with a quotation. Our quotation form takes a few minutes: the product, approximate measurements, preferred materials and any reference photos. Our team then prepares the quotation; prices are always confirmed by them.",
      ar: "يسعدنا مساعدتكم في عرض السعر. يستغرق نموذج طلب عرض السعر بضع دقائق: المنتج، والمقاسات التقريبية، والمواد المفضلة، وأي صور مرجعية. ثم يُعدّ فريقنا عرض السعر؛ ويؤكد الفريق الأسعار دائمًا.",
    },
    showroom: {
      en: "You are welcome at our showroom in Al-Hamalah to see finishes and talk through your project with our team.",
      ar: "يسعدنا استقبالكم في صالة العرض في الهملة لمشاهدة التشطيبات ومناقشة مشروعكم مع فريقنا.",
    },
    showroomHours: { en: "Opening hours", ar: "ساعات العمل" },
    team: {
      en: "Our sales team will be glad to help. You can reach them directly:",
      ar: "يسعد فريق المبيعات مساعدتكم. يمكنكم التواصل معهم مباشرة:",
    },
  },
  leaveDetails: { en: "Leave my details", ar: "اتركوا بياناتي" },
  requestCallback: { en: "Request a callback", ar: "طلب معاودة الاتصال" },
  fullQuoteForm: { en: "Full quotation form", ar: "نموذج طلب عرض السعر الكامل" },
  /** The in-chat contact form. Field errors and consent wording match the website's forms. */
  form: {
    title: {
      quotation: { en: "Request a quotation", ar: "طلب عرض سعر" },
      callback: { en: "Request a callback", ar: "طلب معاودة الاتصال" },
      showroom_visit: { en: "Arrange a showroom visit", ar: "ترتيب زيارة لصالة العرض" },
      human: { en: "Talk to our sales team", ar: "التحدث مع فريق المبيعات" },
    },
    intro: {
      en: "Your details go straight to our sales team, not to the AI assistant.",
      ar: "تصل بياناتكم مباشرة إلى فريق المبيعات، وليس إلى المساعد الذكي.",
    },
    name: { en: "Full name", ar: "الاسم الكامل" },
    phone: { en: "WhatsApp or mobile number", ar: "رقم واتساب أو الجوال" },
    email: { en: "Email (optional)", ar: "البريد الإلكتروني (اختياري)" },
    area: { en: "Project location in Bahrain (optional)", ar: "موقع المشروع في البحرين (اختياري)" },
    preferred: { en: "How should we contact you?", ar: "كيف تفضلون أن نتواصل معكم؟" },
    preferredOptions: {
      whatsapp: { en: "WhatsApp", ar: "واتساب" },
      call: { en: "Phone call", ar: "اتصال هاتفي" },
      email: { en: "Email", ar: "البريد الإلكتروني" },
    },
    message: { en: "Anything else we should know? (optional)", ar: "هل هناك ما تودون إضافته؟ (اختياري)" },
    photos: {
      en: "Reference photos or drawings (optional, up to 5)",
      ar: "صور أو رسومات مرجعية (اختياري، حتى 5)",
    },
    addPhotos: { en: "Add photos", ar: "إضافة صور" },
    uploading: { en: "Uploading…", ar: "جارٍ الرفع…" },
    remove: { en: "Remove", ar: "إزالة" },
    consentTitle: { en: "Updates (optional)", ar: "التحديثات (اختياري)" },
    consentEmail: {
      en: "Email me occasional news and offers.",
      ar: "أرسلوا لي أخبارًا وعروضًا من حين لآخر عبر البريد الإلكتروني.",
    },
    consentWhatsapp: {
      en: "Message me on WhatsApp about news and offers.",
      ar: "راسلوني عبر واتساب بالأخبار والعروض.",
    },
    privacyBefore: { en: "I have read the ", ar: "اطلعت على " },
    privacyLink: { en: "privacy policy", ar: "سياسة الخصوصية" },
    privacyAfter: { en: ".", ar: "." },
    submit: { en: "Send to our sales team", ar: "إرسال إلى فريق المبيعات" },
    sending: { en: "Sending…", ar: "جارٍ الإرسال…" },
    cancel: { en: "Not now", ar: "ليس الآن" },
    done: {
      en: "Thank you. Your details have been sent to our sales team, who will contact you. Your reference is",
      ar: "شكرًا لكم. أُرسلت بياناتكم إلى فريق المبيعات وسيتواصل معكم. رقم المرجع",
    },
    shown: { en: "(Contact form shown to the visitor.)", ar: "(عُرض نموذج التواصل على الزائر.)" },
    errors: {
      required: { en: "Please fill this in.", ar: "يُرجى تعبئة هذا الحقل." },
      name: { en: "Please enter your name.", ar: "يُرجى إدخال اسمكم." },
      phone: {
        en: "Please enter a valid phone number, e.g. 3xxx xxxx.",
        ar: "يُرجى إدخال رقم هاتف صحيح، مثل 3xxx xxxx.",
      },
      email: { en: "Please enter a valid email address.", ar: "يُرجى إدخال بريد إلكتروني صحيح." },
      emailForContact: {
        en: "Please enter your email address, or choose WhatsApp or a phone call.",
        ar: "يُرجى إدخال بريدكم الإلكتروني، أو اختيار واتساب أو الاتصال الهاتفي.",
      },
      tooLong: { en: "This is too long.", ar: "النص طويل جدًا." },
      privacy: {
        en: "Please confirm you have read the privacy policy.",
        ar: "يُرجى تأكيد اطلاعكم على سياسة الخصوصية.",
      },
      tooMany: {
        en: "Too many requests from your connection. Please try again in an hour, or call us.",
        ar: "طلبات كثيرة من اتصالكم. يُرجى المحاولة بعد ساعة، أو الاتصال بنا.",
      },
      invalid: {
        en: "Some details need checking. Please review the form.",
        ar: "بعض البيانات تحتاج إلى مراجعة. يُرجى مراجعة النموذج.",
      },
      server: {
        en: "Something went wrong on our side. Please try again, or call us.",
        ar: "حدث خطأ من جانبنا. يُرجى المحاولة مرة أخرى، أو الاتصال بنا.",
      },
      aiOff: {
        en: "The chat is not available right now. Please call or email us.",
        ar: "المحادثة غير متاحة حاليًا. يُرجى الاتصال بنا أو مراسلتنا عبر البريد الإلكتروني.",
      },
      uploadsOff: {
        en: "Photo upload isn't available right now. Please send the form without photos and share them on WhatsApp or by email.",
        ar: "رفع الصور غير متاح حاليًا. يُرجى إرسال النموذج دون صور ومشاركتها عبر واتساب أو البريد الإلكتروني.",
      },
      fileType: { en: "This file type isn't accepted.", ar: "نوع هذا الملف غير مقبول." },
      fileTooLarge: { en: "This file is larger than 15 MB.", ar: "حجم هذا الملف أكبر من 15 ميغابايت." },
      fileEmpty: { en: "This file is empty.", ar: "هذا الملف فارغ." },
      fileMissing: {
        en: "One of the files is no longer available. Please remove it and add it again.",
        ar: "أحد الملفات لم يعد متاحًا. يُرجى حذفه وإضافته من جديد.",
      },
      fileRejected: {
        en: "A file didn't match its type and was removed. Please check it and try again.",
        ar: "أحد الملفات لا يطابق نوعه وتمت إزالته. يُرجى التحقق منه والمحاولة مجددًا.",
      },
      fileNotUploaded: {
        en: "A file hasn't finished uploading. Please wait or add it again.",
        ar: "لم يكتمل رفع أحد الملفات. يُرجى الانتظار أو إضافته من جديد.",
      },
      uploadFailed: { en: "Upload failed. Please try again.", ar: "فشل الرفع. يُرجى المحاولة مرة أخرى." },
    },
  },
  errors: {
    aiOff: {
      en: "I can't answer typed questions right now. Please choose an option above or contact our team directly.",
      ar: "لا يمكنني الإجابة عن الأسئلة المكتوبة حاليًا. يرجى اختيار أحد الخيارات أعلاه أو التواصل مع فريقنا مباشرة.",
    },
    tooMany: {
      en: "That's a lot of messages in a short time. Please try again a little later, or contact our team directly.",
      ar: "رسائل كثيرة خلال وقت قصير. يرجى المحاولة بعد قليل، أو التواصل مع فريقنا مباشرة.",
    },
    busy: {
      en: "Our assistant has answered as many messages as it can today. Please contact our team directly, or try again tomorrow.",
      ar: "أجاب مساعدنا عن الحد الأقصى من الرسائل لهذا اليوم. يرجى التواصل مع فريقنا مباشرة، أو المحاولة غدًا.",
    },
    declined: {
      en: "I can't help with that here. I'm happy to help with kitchens and furniture, or you can contact our team directly.",
      ar: "لا يمكنني المساعدة في ذلك هنا. يسعدني مساعدتكم في المطابخ والأثاث، أو يمكنكم التواصل مع فريقنا مباشرة.",
    },
    invalid: {
      en: "Please write your message again (up to 1,000 characters).",
      ar: "يرجى كتابة رسالتكم مجددًا (حتى 1000 حرف).",
    },
    server: {
      en: "Something went wrong on our side. Please try again, or contact our team directly.",
      ar: "حدث خطأ من جهتنا. يرجى المحاولة مجددًا، أو التواصل مع فريقنا مباشرة.",
    },
  },
} as const;

export type QuickReply =
  | { kind: "product"; key: ProductKey; label: { en: string; ar: string } }
  | { kind: "quote" | "showroom" | "team"; label: { en: string; ar: string } };

/** What the chat window shows by itself (not written by the assistant). */
export type ChatCard =
  | { card: "product"; key: ProductKey }
  | { card: "quote" | "showroom" | "team" }
  | { card: "form"; reason: string; status: "open" | "sent" | "closed" }
  | { card: "sent"; reference: string | null };

/** A card as text, for the conversation the server keeps and the AI reads. */
export function chatCardText(card: ChatCard, locale: "en" | "ar"): string {
  switch (card.card) {
    case "product": {
      const p = products.find((x) => x.key === card.key);
      return p ? `${p.name[locale]}: ${p.intro[locale]}` : "";
    }
    case "form":
      return chatCopy.form.shown[locale];
    case "sent":
      return `${chatCopy.form.done[locale]} ${card.reference ?? ""}`.trim();
    default:
      return chatCopy.cards[card.card][locale];
  }
}

let windowTexts: Set<string> | null = null;

/**
 * Whether an "assistant" message sent by the browser is one of the window's own cards. Anything else
 * claiming to be from the assistant is dropped: the assistant's real replies come from the database.
 */
export function isChatCardText(text: string): boolean {
  windowTexts ??= new Set(
    (["en", "ar"] as const).flatMap((locale) => [
      ...products.map((p) => chatCardText({ card: "product", key: p.key }, locale)),
      ...(["quote", "showroom", "team"] as const).map((card) => chatCardText({ card }, locale)),
      chatCopy.form.shown[locale],
      chatCopy.form.done[locale],
    ]),
  );
  if (windowTexts.has(text)) return true;
  return (["en", "ar"] as const).some((locale) => {
    const done = chatCopy.form.done[locale];
    return text.startsWith(`${done} `) && /^GIK-[A-Z]-\d{4}-\d{5}$/.test(text.slice(done.length + 1));
  });
}

/** The owner's quick options (2026-11-09), in order. */
export const quickReplies: QuickReply[] = [
  { kind: "product", key: "woodenKitchens", label: { en: "Wooden Kitchens", ar: "مطابخ خشبية" } },
  { kind: "product", key: "aluminiumKitchens", label: { en: "Aluminium Kitchens", ar: "مطابخ ألمنيوم" } },
  { kind: "product", key: "wardrobes", label: { en: "Wardrobes", ar: "خزائن الملابس" } },
  { kind: "product", key: "bedroomFurniture", label: { en: "Bedroom Furniture", ar: "أثاث غرف النوم" } },
  { kind: "product", key: "tvUnits", label: { en: "TV Units", ar: "وحدات التلفاز" } },
  { kind: "quote", label: { en: "Request a Quotation", ar: "طلب عرض سعر" } },
  { kind: "showroom", label: { en: "Book a Showroom Visit", ar: "حجز زيارة لصالة العرض" } },
  { kind: "team", label: { en: "Talk to Our Sales Team", ar: "تحدثوا مع فريق المبيعات" } },
];
