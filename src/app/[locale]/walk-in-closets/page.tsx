import type { Metadata } from "next";
import { ProductPage, productMetadata } from "@/components/pages/product-page";
import type { Locale } from "@/i18n/routing";
import { getBuiltInCategory } from "@/server/content/catalog";
import { getPortfolio } from "@/server/content/portfolio";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/walk-in-closets">): Promise<Metadata> {
  return productMetadata("walkInClosets", (await params).locale as Locale);
}

export default async function Page({ params }: PageProps<"/[locale]/walk-in-closets">) {
  return (
    <ProductPage
      productKey="walkInClosets"
      locale={(await params).locale as Locale}
      portfolio={await getPortfolio()}
      category={await getBuiltInCategory("walkInClosets")}
    />
  );
}
