import type { Metadata } from "next";
import { ProductPage, productMetadata } from "@/components/pages/product-page";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/kitchens/aluminium">): Promise<Metadata> {
  return productMetadata("aluminiumKitchens", (await params).locale as Locale);
}

export default async function Page({ params }: PageProps<"/[locale]/kitchens/aluminium">) {
  return <ProductPage productKey="aluminiumKitchens" locale={(await params).locale as Locale} />;
}
