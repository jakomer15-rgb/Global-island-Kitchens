import type { Metadata } from "next";
import { ProductPage, productMetadata } from "@/components/pages/product-page";
import type { Locale } from "@/i18n/routing";
import { getPortfolio } from "@/server/content/portfolio";

export async function generateMetadata({ params }: PageProps<"/[locale]/wardrobes">): Promise<Metadata> {
  return productMetadata("wardrobes", (await params).locale as Locale);
}

export default async function Page({ params }: PageProps<"/[locale]/wardrobes">) {
  return (
    <ProductPage
      productKey="wardrobes"
      locale={(await params).locale as Locale}
      portfolio={await getPortfolio()}
    />
  );
}
