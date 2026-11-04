import { describe, expect, it } from "vitest";
import { alternates, localizedPath, pageMetadata, socialImage } from "./seo";
import { settingDefaults } from "@/lib/site-settings";
import { organizationJsonLd } from "./structured-data";

describe("seo", () => {
  it("keeps English unprefixed and puts Arabic under /ar", () => {
    expect(localizedPath("/", "en")).toBe("/");
    expect(localizedPath("/", "ar")).toBe("/ar");
    expect(localizedPath("/wardrobes", "ar")).toBe("/ar/wardrobes");
  });

  it("emits canonical and hreflang alternates", () => {
    expect(alternates("/", "ar")).toEqual({
      canonical: "/ar",
      languages: { "en-BH": "/", "ar-BH": "/ar", "x-default": "/" },
    });
  });

  it("uses a JPEG preview of a photo, an admin upload as it is, or the branded card", () => {
    expect(socialImage("/images/capri-suites.webp")).toBe("/images/og/capri-suites.jpg");
    expect(socialImage("/media/abc")).toBe("/media/abc");
    expect(socialImage()).toBe("/images/og/default.jpg");
  });

  it("gives every page a complete link preview", () => {
    const meta = pageMetadata({ title: "T", description: "D", path: "/showroom", locale: "ar" });
    expect(meta.openGraph).toMatchObject({
      siteName: "Global Island Kitchens",
      locale: "ar_BH",
      url: "/ar/showroom",
      images: [{ url: "/images/og/default.jpg", width: 1200, height: 630 }],
    });
  });
});

describe("structured data", () => {
  it("uses only verified facts and no review markup", () => {
    const { contact, locations } = settingDefaults;
    const json = JSON.stringify(organizationJsonLd("en", contact, locations));
    expect(json).toContain("Global Island Kitchens W.L.L");
    expect(json).toContain("Al-Hamalah");
    expect(json).not.toMatch(/Review|AggregateRating|geo|hasMap/);
  });

  it("gives the showroom's opening days, closed on Friday", () => {
    const { contact, locations } = settingDefaults;
    const json = JSON.stringify(organizationJsonLd("en", contact, locations));
    expect(json).toContain("Saturday");
    expect(json).toContain("Thursday");
    expect(json).not.toContain("Friday");
    expect(json).toContain('"opens":"09:00"');
  });

  it("links the map only once the admin has set one", () => {
    const { contact, locations } = settingDefaults;
    const mapUrl = "https://maps.app.goo.gl/example";
    expect(JSON.stringify(organizationJsonLd("en", contact, { ...locations, mapUrl }))).toContain(mapUrl);
  });
});
