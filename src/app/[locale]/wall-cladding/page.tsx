import type { Metadata } from "next";
import { ProductPage, productMetadata } from "@/components/pages/product-page";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({ params }: PageProps<"/[locale]/wall-cladding">): Promise<Metadata> {
  return productMetadata("wallCladding", (await params).locale as Locale);
}

export default async function Page({ params }: PageProps<"/[locale]/wall-cladding">) {
  return <ProductPage productKey="wallCladding" locale={(await params).locale as Locale} />;
}
