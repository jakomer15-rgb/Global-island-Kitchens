import { useTranslations } from "next-intl";
import { whatsappHref } from "@/config/company";

/**
 * Floating WhatsApp button. Hidden until the WhatsApp number is confirmed and set in the contact
 * settings, so it never opens a chat with the wrong number.
 */
export function WhatsAppButton({ number }: { number: string | null }) {
  const t = useTranslations("Common");
  if (!number) return null;

  return (
    <a
      href={whatsappHref(number, t("whatsappMessage"))}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("whatsappLabel")}
      className="fixed end-5 bottom-5 z-30 inline-flex size-14 items-center justify-center rounded-full bg-[#1f7a4d] text-white shadow-lg shadow-charcoal/20 transition-transform duration-300 hover:scale-105"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-7" fill="currentColor">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91A9.84 9.84 0 0 0 12.04 2Zm0 18.15h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24a8.2 8.2 0 0 1 8.24 8.25c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.24-.64.8-.78.97-.14.17-.29.18-.54.06a6.73 6.73 0 0 1-3.37-2.94c-.25-.44.25-.41.72-1.36.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42h-.48a.92.92 0 0 0-.67.31c-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.24 3.74 1.58.68 2.2.74 2.99.62.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.1-.22-.16-.47-.29Z" />
      </svg>
    </a>
  );
}
