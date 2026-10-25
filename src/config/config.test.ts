import { describe, expect, it } from "vitest";
import { company, telHref, whatsappHref } from "./company";
import { hrefFor, pages } from "./routes";

describe("company facts", () => {
  it("formats Bahrain phone numbers as tel: links", () => {
    expect(company.phones.map(telHref)).toEqual(["tel:+97334597636", "tel:+97377901988"]);
  });

  it("matches the printed numbers", () => {
    for (const phone of company.phones) {
      expect(phone.e164).toBe(`+973${phone.display.replace(/\s/g, "")}`);
    }
  });

  it("builds WhatsApp links with an encoded message", () => {
    expect(whatsappHref("97334597636", "Hello & welcome")).toBe(
      "https://wa.me/97334597636?text=Hello%20%26%20welcome",
    );
  });

  it("has no WhatsApp number unless configured", () => {
    expect(company.whatsappNumber).toBeNull();
  });
});

describe("routes", () => {
  it("links only to pages that are built", () => {
    expect(hrefFor("home")).toBe("/");
    expect(hrefFor("woodenKitchens")).toBe("/kitchens/wooden");
    // No articles yet: the blog is not linked anywhere.
    expect(hrefFor("blog")).toBeNull();
  });

  it("has unique paths", () => {
    const paths = Object.values(pages).map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
