import type { Metadata } from "next";
import { ProductPage, productMetadata } from "@/components/pages/product-page";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({ params }: PageProps<"/[locale]/tv-units">): Promise<Metadata> {
  return productMetadata("tvUnits", (await params).locale as Locale);
}

export default async function Page({ params }: PageProps<"/[locale]/tv-units">) {
  return <ProductPage productKey="tvUnits" locale={(await params).locale as Locale} />;
}
