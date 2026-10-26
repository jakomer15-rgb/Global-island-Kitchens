import type { L } from "./types";

/** Fixed wording on quotation documents (English and Arabic). Amounts and terms come from the database. */
export const quotationDoc = {
  title: { en: "Quotation", ar: "عرض سعر" } satisfies L,
  draft: { en: "Draft, not sent", ar: "مسودة، لم تُرسل" } satisfies L,
  number: { en: "Quotation no.", ar: "رقم العرض" } satisfies L,
  revision: { en: "Revision", ar: "المراجعة" } satisfies L,
  date: { en: "Date", ar: "التاريخ" } satisfies L,
  validUntil: { en: "Valid until", ar: "صالح حتى" } satisfies L,
  customer: { en: "Prepared for", ar: "مُعدّ لـ" } satisfies L,
  project: { en: "Project", ar: "المشروع" } satisfies L,
  vatNumber: { en: "VAT registration no.", ar: "رقم التسجيل الضريبي" } satisfies L,
  columns: {
    item: { en: "#", ar: "#" },
    description: { en: "Description", ar: "الوصف" },
    quantity: { en: "Qty", ar: "الكمية" },
    unitPrice: { en: "Unit price", ar: "سعر الوحدة" },
    total: { en: "Amount", ar: "المبلغ" },
  } satisfies Record<string, L>,
  units: {
    unit: { en: "pc", ar: "قطعة" },
    set: { en: "set", ar: "طقم" },
    linear_metre: { en: "lm", ar: "م.ط" },
    square_metre: { en: "m²", ar: "م²" },
  } satisfies Record<string, L>,
  dimensions: { en: "Size", ar: "المقاس" } satisfies L,
  material: { en: "Material", ar: "الخامة" } satisfies L,
  subtotal: { en: "Subtotal", ar: "المجموع الفرعي" } satisfies L,
  discount: { en: "Discount", ar: "الخصم" } satisfies L,
  vat: { en: "VAT", ar: "ضريبة القيمة المضافة" } satisfies L,
  total: { en: "Total", ar: "الإجمالي" } satisfies L,
  currencyNote: {
    en: "All amounts in Bahraini dinars (BHD).",
    ar: "جميع المبالغ بالدينار البحريني.",
  } satisfies L,
  notes: { en: "Notes", ar: "ملاحظات" } satisfies L,
  terms: { en: "Terms and conditions", ar: "الشروط والأحكام" } satisfies L,
  accept: {
    en: "To accept this quotation, reply to the WhatsApp message it came with, or call us on {phone}.",
    ar: "لقبول هذا العرض، يُرجى الرد على رسالة واتساب التي وصل بها، أو الاتصال بنا على {phone}.",
  } satisfies L,
};
