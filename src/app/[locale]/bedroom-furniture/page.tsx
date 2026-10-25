import type { Metadata } from "next";
import { ProductPage, productMetadata } from "@/components/pages/product-page";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/bedroom-furniture">): Promise<Metadata> {
  return productMetadata("bedroomFurniture", (await params).locale as Locale);
}

export default async function Page({ params }: PageProps<"/[locale]/bedroom-furniture">) {
  return <ProductPage productKey="bedroomFurniture" locale={(await params).locale as Locale} />;
}
