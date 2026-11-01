-- Categories managed in the admin (products, projects, factory), the products and machines inside
-- them, and an optional category on portfolio projects. The built-in product lines are added by the
-- seed (prisma/seed.ts), linked to their pages by page_key.

-- CreateEnum
CREATE TYPE "CategorySection" AS ENUM ('products', 'projects', 'factory');

-- AlterEnum
ALTER TYPE "FileKind" ADD VALUE 'catalog_image';

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "section" "CategorySection" NOT NULL,
    "slug" TEXT NOT NULL,
    "page_key" TEXT,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "description_en" TEXT,
    "description_ar" TEXT,
    "image_file_id" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_items" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "description_en" TEXT,
    "description_ar" TEXT,
    "image_file_id" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "catalog_items_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "portfolio_projects" ADD COLUMN "category_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "categories_page_key_key" ON "categories"("page_key");

-- CreateIndex
CREATE INDEX "categories_section_published_sort_order_idx" ON "categories"("section", "published", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "categories_section_slug_key" ON "categories"("section", "slug");

-- CreateIndex
CREATE INDEX "catalog_items_category_id_published_sort_order_idx" ON "catalog_items"("category_id", "published", "sort_order");

-- CreateIndex
CREATE INDEX "portfolio_projects_category_id_idx" ON "portfolio_projects"("category_id");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_image_file_id_fkey" FOREIGN KEY ("image_file_id") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_image_file_id_fkey" FOREIGN KEY ("image_file_id") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rules (hand-written)
ALTER TABLE "categories" ADD CONSTRAINT "categories_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "categories" ADD CONSTRAINT "categories_page_key_products_only"
  CHECK ("page_key" IS NULL OR "section" = 'products');
ALTER TABLE "categories" ADD CONSTRAINT "categories_names_not_blank"
  CHECK (length(btrim("name_en")) > 0 AND length(btrim("name_ar")) > 0);
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_names_not_blank"
  CHECK (length(btrim("name_en")) > 0 AND length(btrim("name_ar")) > 0);
