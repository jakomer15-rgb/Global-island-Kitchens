import { describe, expect, it } from "vitest";
import { adminNav, firstAdminPage } from "@/app/admin/(panel)/nav";
import { parseSetting, settingDefaults, settingSchemas } from "@/lib/site-settings";
import { allPermissions, roleDefinitions, type Permission } from "@/server/auth/permissions";
import { settingPermission } from "@/server/settings/update";
import { canManageMedia, mediaType } from "./media";
import type { Actor } from "@/server/auth/staff";

const role = (key: string) => new Set(roleDefinitions.find((r) => r.key === key)!.permissions);
const hrefs = (permissions: ReadonlySet<Permission>) =>
  adminNav(permissions).flatMap((g) => g.items.map((i) => i.href));
const actor = (permissions: Permission[]): Actor => ({
  id: "u",
  name: "U",
  email: "u@example.test",
  roles: [],
  permissions: new Set(permissions),
});

describe("permission matrix", () => {
  it("gives the owner everything and nobody else staff management", () => {
    expect([...role("owner")].sort()).toEqual([...allPermissions].sort());
    for (const r of roleDefinitions.filter((r) => r.key !== "owner"))
      expect(r.permissions, r.key).not.toContain("staff.manage");
  });

  it("shows each role only the admin pages it may open", () => {
    expect(hrefs(role("owner"))).toEqual(
      expect.arrayContaining(["/admin", "/admin/leads", "/admin/staff", "/admin/audit", "/admin/media"]),
    );
    expect(hrefs(role("general_manager"))).not.toContain("/admin/staff");
    const sales = hrefs(role("sales_manager"));
    expect(sales).toEqual(
      expect.arrayContaining(["/admin/leads", "/admin/customers", "/admin/consultations"]),
    );
    expect(sales).not.toEqual(expect.arrayContaining(["/admin/settings"]));
    expect(
      sales.some((h) => ["/admin/settings", "/admin/content", "/admin/media", "/admin/audit"].includes(h)),
    ).toBe(false);
    const production = hrefs(role("production_supervisor"));
    expect(production).toEqual(expect.arrayContaining(["/admin/leads", "/admin/materials", "/admin/media"]));
    expect(production).not.toContain("/admin/blog");
    const editor = hrefs(role("content_editor"));
    expect(editor).toEqual(
      expect.arrayContaining(["/admin/content", "/admin/blog", "/admin/portfolio", "/admin/settings"]),
    );
    expect(editor.some((h) => h.startsWith("/admin/leads") || h === "/admin")).toBe(false);
  });

  it("sends staff to the first page they may open", () => {
    expect(firstAdminPage(role("sales_manager"))).toBe("/admin");
    expect(firstAdminPage(role("content_editor"))).toBe("/admin/content");
    expect(firstAdminPage(new Set())).toBe("/admin/no-access");
  });

  it("guards each setting with the matching permission", () => {
    expect(Object.keys(settingPermission).sort()).toEqual(Object.keys(settingSchemas).sort());
    expect(settingPermission.contact).toBe("settings.manage");
    expect(settingPermission.homeHero).toBe("content.manage");
  });

  it("lets each image kind be managed only by its editors", () => {
    expect(canManageMedia(actor(["materials.manage"]), "material_image")).toBe(true);
    expect(canManageMedia(actor(["materials.manage"]), "blog_image")).toBe(false);
    expect(canManageMedia(actor(["lead.read"]))).toBe(false);
    expect(mediaType("photo.JPG", "")).toBe("image/jpeg");
    expect(mediaType("drawing.pdf", "application/pdf")).toBeNull();
    expect(mediaType("x.heic", "image/heic")).toBeNull();
  });
});

describe("site settings", () => {
  it("has valid defaults from the verified company facts", () => {
    for (const [key, schema] of Object.entries(settingSchemas))
      expect(schema.safeParse(settingDefaults[key as keyof typeof settingDefaults]).success, key).toBe(true);
    expect(settingDefaults.contact.phones[0].e164).toBe("+97334597636");
    expect(settingDefaults.contact.whatsappNumber).toBeNull();
  });

  it("falls back to the default for a missing or invalid stored value", () => {
    expect(parseSetting("contact", undefined)).toEqual(settingDefaults.contact);
    expect(parseSetting("contact", { phones: [], email: "nope" })).toEqual(settingDefaults.contact);
  });

  it("refuses a banner switched on without both languages, and too many phones", () => {
    expect(
      settingSchemas.banner.safeParse({ enabled: true, textEn: "Closed Friday", textAr: "" }).success,
    ).toBe(false);
    expect(settingSchemas.banner.safeParse({ enabled: true, textEn: "Closed", textAr: "مغلق" }).success).toBe(
      true,
    );
    expect(settingSchemas.banner.parse({ enabled: false, textEn: "", textAr: "" })).toEqual({
      enabled: false,
      textEn: null,
      textAr: null,
    });
    const phone = settingDefaults.contact.phones[0];
    expect(
      settingSchemas.contact.safeParse({ ...settingDefaults.contact, phones: [phone, phone, phone, phone] })
        .success,
    ).toBe(false);
    expect(settingSchemas.seo.safeParse({ ...settingDefaults.seo, titleEn: "x".repeat(61) }).success).toBe(
      false,
    );
  });
});
