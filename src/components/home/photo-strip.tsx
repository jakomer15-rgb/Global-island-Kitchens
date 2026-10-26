import { useLocale } from "next-intl";
import { Reveal } from "@/components/site/reveal";
import { photos } from "@/content/photos";
import type { Locale } from "@/i18n/routing";

const strip = [photos.kitchenLaundry, photos.livingRoom, photos.interiorDoors, photos.walkInCloset];

/** Four interiors from the company profile, between the product list and the materials. */
export function PhotoStrip() {
  const locale = useLocale() as Locale;
  return (
    <Reveal className="pb-24 md:pb-32">
      <ul className="container-site grid grid-cols-2 gap-3 lg:grid-cols-4">
        {strip.map((photo) => (
          <li key={photo.src}>
            {/* eslint-disable-next-line @next/next/no-img-element -- static file, already optimised */}
            <img
              src={photo.src}
              alt={photo.alt[locale]}
              width={photo.width}
              height={photo.height}
              loading="lazy"
              decoding="async"
              className="aspect-[4/5] w-full bg-sand object-cover"
            />
          </li>
        ))}
      </ul>
    </Reveal>
  );
}
