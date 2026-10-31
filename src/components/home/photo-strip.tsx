import { useLocale } from "next-intl";
import { Reveal } from "@/components/site/reveal";
import { photos } from "@/content/photos";
import type { Locale } from "@/i18n/routing";

/** Interiors from the company profile, between the product cards and the materials, as an editorial mosaic. */
export function PhotoStrip() {
  const locale = useLocale() as Locale;
  const [main, ...side] = [photos.livingRoom, photos.kitchenLaundry, photos.alFarisBedroom1];

  const img = (photo: typeof main, className: string) => (
    // eslint-disable-next-line @next/next/no-img-element -- static file, already optimised
    <img
      src={photo.src}
      alt={photo.alt[locale]}
      width={photo.width}
      height={photo.height}
      loading="lazy"
      decoding="async"
      className={`w-full bg-sand object-cover ${className}`}
    />
  );

  return (
    <Reveal className="pb-24 md:pb-32">
      <ul className="container-site grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-12">
        <li className="col-span-2 lg:col-span-7 lg:row-span-2">
          {img(main, "aspect-[3/2] lg:aspect-auto lg:h-full")}
        </li>
        {side.map((photo) => (
          <li key={photo.src} className="lg:col-span-5">
            {img(photo, "aspect-[4/3] lg:aspect-[16/9]")}
          </li>
        ))}
      </ul>
    </Reveal>
  );
}
