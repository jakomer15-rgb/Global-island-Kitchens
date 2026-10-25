import type { Metadata } from "next";
import { fontVariables } from "@/app/fonts";
import "../globals.css";

// Root layout of the staff portal (English UI). Never indexed.
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin · Global Island Kitchens" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="en" dir="ltr" className={fontVariables}>
      <body className="min-h-svh bg-ivory">{children}</body>
    </html>
  );
}
