import type { L } from "./types";

/**
 * Privacy policy and website terms. They describe only what the website does today (no forms,
 * no cookies, no analytics) and must be updated when forms (Phase 4) and analytics (Phase 9) are
 * added. Pending review by the company's legal adviser (docs/OPEN_QUESTIONS.md #34).
 */

export interface LegalSection {
  heading: L;
  body: L[];
}

export interface LegalDoc {
  metaTitle: L;
  metaDescription: L;
  title: L;
  updated: L;
  sections: LegalSection[];
}

const updated: L = { en: "Last updated: 25 October 2026", ar: "آخر تحديث: 25 أكتوبر 2026" };

export const privacy: LegalDoc = {
  metaTitle: { en: "Privacy Policy", ar: "سياسة الخصوصية" },
  metaDescription: {
    en: "How Global Island Kitchens W.L.L handles personal information on this website and when you contact us.",
    ar: "كيف تتعامل Global Island Kitchens W.L.L مع المعلومات الشخصية على هذا الموقع وعند تواصلكم معنا.",
  },
  title: { en: "Privacy policy", ar: "سياسة الخصوصية" },
  updated,
  sections: [
    {
      heading: { en: "Who we are", ar: "من نحن" },
      body: [
        {
          en: "This website is operated by Global Island Kitchens W.L.L, Bldg 3301, Road 360, Block 1203, Hamad Town, Kingdom of Bahrain. Email: globalkitchen.bh@gmail.com. Telephone: 3459 7636 / 7790 1988.",
          ar: "يُدار هذا الموقع من قبل Global Island Kitchens W.L.L، مبنى 3301، طريق 360، مجمع 1203، مدينة حمد، مملكة البحرين. البريد الإلكتروني: globalkitchen.bh@gmail.com. الهاتف: 3459 7636 / 7790 1988.",
        },
      ],
    },
    {
      heading: { en: "What this website collects", ar: "ما يجمعه هذا الموقع" },
      body: [
        {
          en: "This website does not use forms, accounts, analytics or advertising, and it does not set cookies.",
          ar: "لا يستخدم هذا الموقع نماذج أو حسابات أو أدوات تحليل أو إعلانات، ولا يضع ملفات تعريف الارتباط (الكوكيز).",
        },
        {
          en: "Like any website, the server that delivers it records technical information such as your IP address, browser type and the pages requested, for security and to keep the site running.",
          ar: "وكأي موقع إلكتروني، يسجّل الخادم الذي يقدّم الموقع معلومات تقنية مثل عنوان IP ونوع المتصفح والصفحات المطلوبة، لأغراض الأمان ولضمان عمل الموقع.",
        },
      ],
    },
    {
      heading: { en: "When you contact us", ar: "عند تواصلكم معنا" },
      body: [
        {
          en: "If you call, email or message us, we use the details you give us (such as your name, phone number, email address, project information, photos and drawings) to respond, prepare quotations and carry out your project. We do not sell your information.",
          ar: "عند اتصالكم بنا أو مراسلتنا، نستخدم البيانات التي تقدمونها (مثل الاسم ورقم الهاتف والبريد الإلكتروني ومعلومات المشروع والصور والرسومات) للرد عليكم وإعداد عروض الأسعار وتنفيذ مشروعكم. ولا نبيع معلوماتكم.",
        },
      ],
    },
    {
      heading: { en: "Links to other services", ar: "روابط لخدمات أخرى" },
      body: [
        {
          en: "Links to Instagram, WhatsApp or your email application take you to services run by other companies under their own privacy policies.",
          ar: "تنقلكم الروابط إلى إنستغرام أو واتساب أو تطبيق البريد الإلكتروني إلى خدمات تديرها شركات أخرى وفق سياسات الخصوصية الخاصة بها.",
        },
      ],
    },
    {
      heading: { en: "Your rights", ar: "حقوقكم" },
      body: [
        {
          en: "Under Bahrain's Personal Data Protection Law (Law No. 30 of 2018) you may ask to access, correct or delete the personal information we hold about you, or object to its use. Contact us using the details above.",
          ar: "بموجب قانون حماية البيانات الشخصية في البحرين (القانون رقم 30 لسنة 2018)، يحق لكم طلب الاطلاع على بياناتكم الشخصية التي نحتفظ بها أو تصحيحها أو حذفها، أو الاعتراض على استخدامها. تواصلوا معنا عبر البيانات أعلاه.",
        },
      ],
    },
    {
      heading: { en: "Changes", ar: "التعديلات" },
      body: [
        {
          en: "We will update this policy when the website changes, for example when online forms are added.",
          ar: "سنحدّث هذه السياسة عند تغيّر الموقع، مثل إضافة نماذج إلكترونية.",
        },
      ],
    },
  ],
};

export const terms: LegalDoc = {
  metaTitle: { en: "Terms and Conditions", ar: "الشروط والأحكام" },
  metaDescription: {
    en: "Terms of use for the Global Island Kitchens W.L.L website.",
    ar: "شروط استخدام موقع Global Island Kitchens W.L.L.",
  },
  title: { en: "Terms and conditions", ar: "الشروط والأحكام" },
  updated,
  sections: [
    {
      heading: { en: "About these terms", ar: "عن هذه الشروط" },
      body: [
        {
          en: "These terms apply to your use of this website, operated by Global Island Kitchens W.L.L, Kingdom of Bahrain. Quotations, orders and installations are governed by the terms set out in each written quotation.",
          ar: "تنطبق هذه الشروط على استخدامكم لهذا الموقع الذي تديره Global Island Kitchens W.L.L، مملكة البحرين. أما عروض الأسعار والطلبات وأعمال التركيب فتخضع للشروط المذكورة في كل عرض سعر مكتوب.",
        },
      ],
    },
    {
      heading: { en: "Information on this website", ar: "المعلومات على هذا الموقع" },
      body: [
        {
          en: "We aim to keep the information on this website accurate, but it is for general information only. Product details, materials and availability are confirmed in your written quotation. Material swatches on this website are illustrations, not photographs of actual décors.",
          ar: "نسعى إلى إبقاء المعلومات على هذا الموقع دقيقة، لكنها للاطلاع العام فقط. تُؤكَّد تفاصيل المنتجات والخامات وتوفرها في عرض السعر المكتوب. العينات المعروضة على الموقع رسوم توضيحية وليست صورًا للتصاميم الفعلية.",
        },
      ],
    },
    {
      heading: { en: "Trademarks and content", ar: "العلامات التجارية والمحتوى" },
      body: [
        {
          en: "The content of this website belongs to Global Island Kitchens W.L.L. EGGER is a trademark of its owner; naming the brand does not imply a partnership or endorsement.",
          ar: "محتوى هذا الموقع مملوك لـ Global Island Kitchens W.L.L. وإيجر (EGGER) علامة تجارية لمالكها، ولا يعني ذكرها وجود شراكة أو تأييد.",
        },
      ],
    },
    {
      heading: { en: "Links", ar: "الروابط" },
      body: [
        {
          en: "Links to other websites and services are provided for convenience; we are not responsible for their content.",
          ar: "تُقدَّم الروابط إلى المواقع والخدمات الأخرى للتسهيل، ولسنا مسؤولين عن محتواها.",
        },
      ],
    },
    {
      heading: { en: "Governing law", ar: "القانون الواجب التطبيق" },
      body: [
        {
          en: "These terms are governed by the laws of the Kingdom of Bahrain.",
          ar: "تخضع هذه الشروط لقوانين مملكة البحرين.",
        },
      ],
    },
  ],
};
