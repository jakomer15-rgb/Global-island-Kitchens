import type { Metadata } from "next";
import { ProductPage, productMetadata } from "@/components/pages/product-page";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/bathroom-vanities">): Promise<Metadata> {
  return productMetadata("bathroomVanities", (await params).locale as Locale);
}

export default async function Page({ params }: PageProps<"/[locale]/bathroom-vanities">) {
  return <ProductPage productKey="bathroomVanities" locale={(await params).locale as Locale} />;
}
