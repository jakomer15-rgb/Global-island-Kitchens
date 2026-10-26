import type { Metadata } from "next";
import { fontVariables } from "@/app/fonts";
import "../globals.css";

// Printable documents for the PDF renderer (src/server/quotations/pdf.ts). Never indexed.
export const metadata: Metadata = {
  title: "Global Island Kitchens",
  robots: { index: false, follow: false },
};

export default function DocumentsLayout({ children }: LayoutProps<"/documents">) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="bg-white">{children}</body>
    </html>
  );
}
