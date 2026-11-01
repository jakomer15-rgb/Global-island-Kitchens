import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createStaffUser } from "@/server/auth/accounts";
import { ForbiddenError, resolveActor, userWithRolesInclude, type Actor } from "@/server/auth/staff";
import { createPrismaClient } from "@/server/db/client";
import { localDriver, writeLocal } from "@/server/storage/local";
import {
  deleteCategory,
  deleteItem,
  listCategories,
  moveCategory,
  moveItem,
  projectCategoryOptions,
  publicCategories,
  saveCategory,
  saveItem,
} from "./categories";
import { deleteMedia, finishMediaUpload, startMediaUpload } from "./media";
import { saveProject } from "./portfolio";

const db = createPrismaClient();
const uid = () => Math.random().toString(36).slice(2, 10);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(120).fill(7)]);

let root: string;
let storage: ReturnType<typeof localDriver>;
let editor: Actor;
let sales: Actor;

async function staff(roleKeys: string[]): Promise<Actor> {
  const id = await db.$transaction((tx) =>
    createStaffUser(tx, {
      email: `${roleKeys[0]}-${uid()}@example.test`,
      name: `${roleKeys[0]} ${uid()}`,
      password: "a long test password",
      roleKeys,
      actorId: null,
      via: "test",
    }),
  );
  return resolveActor(await db.user.findUniqueOrThrow({ where: { id }, include: userWithRolesInclude }))!;
}

async function uploadImage(kind: "catalog_image" | "blog_image") {
  const started = await startMediaUpload(db, storage, editor, {
    kind,
    name: "line.png",
    type: "image/png",
    size: PNG.length,
  });
  const key = (await db.fileAsset.findUniqueOrThrow({ where: { id: started.id } })).storageKey;
  await writeLocal(root, key, PNG);
  await finishMediaUpload(db, storage, editor, {
    id: started.id,
    ticket: started.ticket,
    credit: "Our photo",
  });
  return started.id;
}

const category = (over: Partial<Parameters<typeof saveCategory>[3]> = {}) => ({
  slug: `laundry-${uid()}`,
  nameEn: "Laundry rooms",
  nameAr: "غرف الغسيل",
  descriptionEn: "Fitted cabinets and smart storage.",
  descriptionAr: null,
  imageFileId: null,
  published: true,
  ...over,
});

const item = (categoryId: string, nameEn = "Tall laundry unit") => ({
  categoryId,
  nameEn,
  nameAr: "وحدة غسيل طويلة",
  descriptionEn: null,
  descriptionAr: null,
  imageFileId: null,
  published: true,
});

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "gik-categories-"));
  storage = localDriver(root, "test-secret");
  [editor, sales] = await Promise.all([staff(["content_editor"]), staff(["sales_manager"])]);
});

afterAll(async () => {
  await db.$disconnect();
  await rm(root, { recursive: true, force: true });
});

describe("categories", () => {
  it("keeps the built-in product lines from the seed, which can be hidden but not deleted", async () => {
    const products = await listCategories(db, editor, "products");
    const wardrobes = products.find((c) => c.pageKey === "wardrobes");
    expect(wardrobes).toBeDefined();
    await expect(deleteCategory(db, editor, wardrobes!.id)).rejects.toThrow(/can't be deleted/);
    // The address of a built-in page can't change, even if a different slug is submitted.
    await saveCategory(db, editor, { id: wardrobes!.id }, category({ slug: "something-else" }));
    const saved = await db.category.findUniqueOrThrow({ where: { id: wardrobes!.id } });
    expect(saved.slug).toBe(wardrobes!.slug);
    await saveCategory(
      db,
      editor,
      { id: wardrobes!.id },
      {
        ...category({ slug: wardrobes!.slug }),
        nameEn: wardrobes!.nameEn,
        nameAr: wardrobes!.nameAr,
        descriptionEn: wardrobes!.descriptionEn,
        descriptionAr: wardrobes!.descriptionAr,
      },
    );
  });

  it("adds a product category at the end, with products, and shows it publicly", async () => {
    const image = await uploadImage("catalog_image");
    const added = await saveCategory(db, editor, { section: "products" }, category({ imageFileId: image }));
    const all = await listCategories(db, editor, "products");
    expect(all.at(-1)!.id).toBe(added.id);
    await expect(
      saveCategory(db, editor, { section: "products" }, category({ slug: added.slug })),
    ).rejects.toThrow(/web address/);

    const a = await saveItem(db, editor, null, item(added.id, "Washer and dryer tower"));
    const b = await saveItem(db, editor, null, item(added.id, "Folding counter"));
    await saveItem(db, editor, null, { ...item(added.id, "Hidden draft"), published: false });

    const pub = (await publicCategories(db)).find((c) => c.id === added.id)!;
    expect(pub.items.map((i) => i.nameEn)).toEqual(["Washer and dryer tower", "Folding counter"]);
    expect(pub.image?.id).toBe(image);

    await moveItem(db, editor, b.id, "up");
    const reordered = (await publicCategories(db)).find((c) => c.id === added.id)!;
    expect(reordered.items.map((i) => i.id)).toEqual([b.id, a.id]);

    // An image in use can't be deleted from Website images.
    await expect(deleteMedia(db, storage, editor, image)).rejects.toThrow(/still used/);
  });

  it("reorders categories within a section", async () => {
    const first = await saveCategory(db, editor, { section: "factory" }, category({ nameEn: "Cutting" }));
    const second = await saveCategory(db, editor, { section: "factory" }, category({ nameEn: "Edging" }));
    await moveCategory(db, editor, second.id, "up");
    const ids = (await listCategories(db, editor, "factory")).map((c) => c.id);
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
    // Moving the first one up again changes nothing.
    const top = ids[0]!;
    await moveCategory(db, editor, top, "up");
    expect((await listCategories(db, editor, "factory"))[0]!.id).toBe(top);
  });

  it("moves products between categories of the same section only", async () => {
    const from = await saveCategory(db, editor, { section: "products" }, category());
    const to = await saveCategory(db, editor, { section: "products" }, category());
    const machines = await saveCategory(db, editor, { section: "factory" }, category());
    const projects = await saveCategory(db, editor, { section: "projects" }, category());
    const product = await saveItem(db, editor, null, item(from.id));

    await saveItem(db, editor, product.id, item(to.id));
    expect((await db.catalogItem.findUniqueOrThrow({ where: { id: product.id } })).categoryId).toBe(to.id);
    await expect(saveItem(db, editor, product.id, item(machines.id))).rejects.toThrow(/own section/);
    await expect(saveItem(db, editor, null, item(projects.id))).rejects.toThrow(/portfolio projects/);
  });

  it("deletes only empty categories; projects lose their category but stay", async () => {
    const products = await saveCategory(db, editor, { section: "products" }, category());
    const product = await saveItem(db, editor, null, item(products.id));
    await expect(deleteCategory(db, editor, products.id)).rejects.toThrow(/Move or delete its 1 product/);
    await deleteItem(db, editor, product.id);
    await deleteCategory(db, editor, products.id);
    expect(await db.category.count({ where: { id: products.id } })).toBe(0);

    const villas = await saveCategory(db, editor, { section: "projects" }, category({ nameEn: "Villas" }));
    expect((await projectCategoryOptions(db, editor)).map((c) => c.id)).toContain(villas.id);
    const projectId = await saveProject(db, editor, null, {
      slug: `villa-${uid()}`,
      segment: "villas",
      nameEn: "Test Villa",
      nameAr: "فيلا تجريبية",
      locationEn: "Riffa",
      locationAr: "الرفاع",
      sizeEn: null,
      sizeAr: null,
      scopeEn: "Kitchen",
      scopeAr: "مطبخ",
      scopeTags: ["kitchens"],
      clientName: null,
      clientNamePermission: false,
      categoryId: villas.id,
      featured: false,
      published: true,
      sortOrder: 0,
    });
    expect((await publicCategories(db)).find((c) => c.id === villas.id)!.projects).toHaveLength(1);
    await deleteCategory(db, editor, villas.id);
    expect((await db.portfolioProject.findUniqueOrThrow({ where: { id: projectId } })).categoryId).toBeNull();
  });

  it("checks permissions, images and the database rules", async () => {
    await expect(listCategories(db, sales, "products")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(saveCategory(db, sales, { section: "products" }, category())).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    const blogImage = await uploadImage("blog_image");
    await expect(
      saveCategory(db, editor, { section: "products" }, category({ imageFileId: blogImage })),
    ).rejects.toThrow(/Website images/);
    const factory = await saveCategory(db, editor, { section: "factory" }, category());
    await expect(
      saveProject(db, editor, null, {
        slug: `p-${uid()}`,
        segment: "residential",
        nameEn: "X",
        nameAr: "س",
        locationEn: "Manama",
        locationAr: "المنامة",
        sizeEn: null,
        sizeAr: null,
        scopeEn: "Kitchen",
        scopeAr: "مطبخ",
        scopeTags: [],
        clientName: null,
        clientNamePermission: false,
        categoryId: factory.id,
        featured: false,
        published: true,
        sortOrder: 0,
      }),
    ).rejects.toThrow(/project categories/);
    await expect(
      db.category.create({
        data: { section: "products", slug: "Bad Slug", nameEn: "X", nameAr: "س" },
      }),
    ).rejects.toThrow(/categories_slug_format/);
    await expect(
      db.category.create({
        data: { section: "factory", slug: `k-${uid()}`, pageKey: `k-${uid()}`, nameEn: "X", nameAr: "س" },
      }),
    ).rejects.toThrow(/categories_page_key_products_only/);
  });
});
