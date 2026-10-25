-- CreateEnum
CREATE TYPE "FileVisibility" AS ENUM ('private', 'public');

-- CreateEnum
CREATE TYPE "MaterialBoard" AS ENUM ('egger_melamine', 'egger_laminate', 'painted_mdf');

-- CreateEnum
CREATE TYPE "MaterialAvailability" AS ENUM ('unverified', 'in_stock', 'to_order', 'discontinued');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('draft', 'published');

-- CreateEnum
CREATE TYPE "PortfolioSegment" AS ENUM ('residential', 'villas', 'commercial');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FileKind" ADD VALUE 'material_image';
ALTER TYPE "FileKind" ADD VALUE 'project_photo';
ALTER TYPE "FileKind" ADD VALUE 'blog_image';

-- AlterTable
ALTER TABLE "file_assets" ADD COLUMN     "credit" TEXT,
ADD COLUMN     "uploaded_by_id" TEXT,
ADD COLUMN     "visibility" "FileVisibility" NOT NULL DEFAULT 'private';

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "board" "MaterialBoard" NOT NULL,
    "manufacturer" TEXT,
    "code" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT,
    "description_en" TEXT,
    "description_ar" TEXT,
    "texture" TEXT,
    "colour_family" TEXT,
    "swatch_hex" CHAR(7),
    "image_file_id" TEXT,
    "availability" "MaterialAvailability" NOT NULL DEFAULT 'unverified',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "verified_at" TIMESTAMPTZ(3),
    "verified_by_id" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "text_en" TEXT,
    "text_ar" TEXT,
    "source" TEXT NOT NULL,
    "consent_note" TEXT,
    "consent_recorded_at" TIMESTAMPTZ(3),
    "status" "PublishStatus" NOT NULL DEFAULT 'draft',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "title_ar" TEXT,
    "excerpt_en" TEXT,
    "excerpt_ar" TEXT,
    "body_en" TEXT NOT NULL,
    "body_ar" TEXT,
    "cover_file_id" TEXT,
    "status" "PublishStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMPTZ(3),
    "author_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_projects" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "segment" "PortfolioSegment" NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "location_en" TEXT NOT NULL,
    "location_ar" TEXT NOT NULL,
    "size_en" TEXT,
    "size_ar" TEXT,
    "scope_en" TEXT NOT NULL,
    "scope_ar" TEXT NOT NULL,
    "scope_tags" TEXT[],
    "client_name" TEXT,
    "client_name_permission" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "portfolio_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_images" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "alt_en" TEXT NOT NULL,
    "alt_ar" TEXT NOT NULL,
    "usage_permission" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "materials_published_sort_order_idx" ON "materials"("published", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "materials_board_code_key" ON "materials"("board", "code");

-- CreateIndex
CREATE INDEX "testimonials_status_sort_order_idx" ON "testimonials"("status", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_status_published_at_idx" ON "blog_posts"("status", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_projects_slug_key" ON "portfolio_projects"("slug");

-- CreateIndex
CREATE INDEX "portfolio_projects_published_segment_sort_order_idx" ON "portfolio_projects"("published", "segment", "sort_order");

-- CreateIndex
CREATE INDEX "portfolio_images_project_id_sort_order_idx" ON "portfolio_images"("project_id", "sort_order");

-- CreateIndex
CREATE INDEX "file_assets_visibility_kind_idx" ON "file_assets"("visibility", "kind");

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_image_file_id_fkey" FOREIGN KEY ("image_file_id") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_cover_file_id_fkey" FOREIGN KEY ("cover_file_id") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_images" ADD CONSTRAINT "portfolio_images_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "portfolio_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_images" ADD CONSTRAINT "portfolio_images_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "file_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ───────────────── Hand-written integrity rules (NULL-safe) ─────────────────

-- Materials: EGGER boards name EGGER; painted MDF names no manufacturer. Public only when verified.
ALTER TABLE "materials" ADD CONSTRAINT "materials_manufacturer_matches_board"
  CHECK ("manufacturer" IS NOT DISTINCT FROM (CASE WHEN "board" = 'painted_mdf' THEN NULL ELSE 'EGGER' END));
ALTER TABLE "materials" ADD CONSTRAINT "materials_published_needs_verification"
  CHECK (NOT "published" OR "verified_at" IS NOT NULL);
ALTER TABLE "materials" ADD CONSTRAINT "materials_published_not_discontinued"
  CHECK (NOT "published" OR "availability" <> 'discontinued');
ALTER TABLE "materials" ADD CONSTRAINT "materials_swatch_hex_format"
  CHECK ("swatch_hex" IS NULL OR "swatch_hex" ~ '^#[0-9a-fA-F]{6}$');
ALTER TABLE "materials" ADD CONSTRAINT "materials_code_not_blank" CHECK (length(btrim("code")) > 0);

-- Testimonials: never published without recorded consent and text.
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_published_needs_consent"
  CHECK ("status" <> 'published' OR ("consent_recorded_at" IS NOT NULL AND length(btrim(coalesce("consent_note", ''))) > 0));
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_has_text"
  CHECK ("text_en" IS NOT NULL OR "text_ar" IS NOT NULL);

-- Blog: published posts have a date and both languages (the site is bilingual).
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_published_complete"
  CHECK ("status" <> 'published' OR ("published_at" IS NOT NULL AND "title_ar" IS NOT NULL AND "body_ar" IS NOT NULL));
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Portfolio: a client name is stored only with permission to show it.
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_client_name_needs_permission"
  CHECK ("client_name" IS NULL OR "client_name_permission");
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Website images must carry a credit (usage rights); customer uploads stay private.
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_public_needs_credit"
  CHECK ("visibility" <> 'public' OR length(btrim(coalesce("credit", ''))) > 0);
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_customer_uploads_private"
  CHECK ("quotation_request_id" IS NULL OR "visibility" = 'private');