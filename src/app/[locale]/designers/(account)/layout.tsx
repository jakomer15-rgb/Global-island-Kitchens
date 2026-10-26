import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Account pages are for signed-in partners only: kept out of search results. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AccountLayout({ children }: { children: ReactNode }) {
  return children;
}
