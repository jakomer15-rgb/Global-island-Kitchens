-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('draft', 'sent', 'approved', 'rejected', 'converted');

-- CreateEnum
CREATE TYPE "LineItemKind" AS ENUM ('product', 'material', 'hardware', 'labour', 'installation', 'other');

-- CreateEnum
CREATE TYPE "LineUnit" AS ENUM ('unit', 'set', 'linear_metre', 'square_metre');

-- CreateEnum
CREATE TYPE "ApprovalMethod" AS ENUM ('whatsapp', 'phone');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('confirmed', 'in_production', 'installed', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "ProjectStage" AS ENUM ('inquiry', 'measurement', 'design', 'quotation', 'approval', 'production', 'installation', 'completion');

-- AlterEnum
ALTER TYPE "FileKind" ADD VALUE 'quotation_pdf';

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "request_id" TEXT,
    "title" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'en',
    "status" "QuotationStatus" NOT NULL DEFAULT 'draft',
    "rejected_reason" TEXT,
    "created_by_id" TEXT,
    "assigned_to_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_revisions" (
    "id" TEXT NOT NULL,
    "quotation_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "subtotal_fils" BIGINT NOT NULL DEFAULT 0,
    "discount_fils" BIGINT NOT NULL DEFAULT 0,
    "vat_rate_basis_points" INTEGER NOT NULL DEFAULT 0,
    "vat_fils" BIGINT NOT NULL DEFAULT 0,
    "total_fils" BIGINT NOT NULL DEFAULT 0,
    "vat_number" TEXT,
    "valid_until" DATE,
    "notes" TEXT,
    "terms" TEXT,
    "sent_at" TIMESTAMPTZ(3),
    "sent_by_id" TEXT,
    "locked_at" TIMESTAMPTZ(3),
    "pdf_file_id" TEXT,
    "approved_at" TIMESTAMPTZ(3),
    "approval_method" "ApprovalMethod",
    "approval_note" TEXT,
    "approval_recorded_by_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "quotation_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_line_items" (
    "id" TEXT NOT NULL,
    "revision_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "kind" "LineItemKind" NOT NULL DEFAULT 'product',
    "description" TEXT NOT NULL,
    "material_id" TEXT,
    "width_mm" INTEGER,
    "height_mm" INTEGER,
    "depth_mm" INTEGER,
    "unit" "LineUnit" NOT NULL DEFAULT 'unit',
    "quantity_milli" INTEGER NOT NULL,
    "unit_price_fils" BIGINT NOT NULL,
    "line_total_fils" BIGINT NOT NULL,

    CONSTRAINT "quotation_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "quotation_revision_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "total_fils" BIGINT NOT NULL,
    "deposit_fils" BIGINT,
    "deposit_received_at" TIMESTAMPTZ(3),
    "status" "OrderStatus" NOT NULL DEFAULT 'confirmed',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "order_id" TEXT,
    "title" TEXT NOT NULL,
    "site_address" TEXT,
    "stage" "ProjectStage" NOT NULL DEFAULT 'inquiry',
    "assigned_to_id" TEXT,
    "target_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_stage_changes" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "from_stage" "ProjectStage",
    "to_stage" "ProjectStage" NOT NULL,
    "changed_by_id" TEXT,
    "note" TEXT,
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_stage_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotations_number_key" ON "quotations"("number");

-- CreateIndex
CREATE INDEX "quotations_status_updated_at_idx" ON "quotations"("status", "updated_at");

-- CreateIndex
CREATE INDEX "quotations_customer_id_idx" ON "quotations"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_revisions_quotation_id_revision_key" ON "quotation_revisions"("quotation_id", "revision");

-- CreateIndex
CREATE INDEX "quotation_line_items_revision_id_sort_order_idx" ON "quotation_line_items"("revision_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_quotation_revision_id_key" ON "orders"("quotation_revision_id");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "projects_reference_key" ON "projects"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "projects_order_id_key" ON "projects"("order_id");

-- CreateIndex
CREATE INDEX "projects_stage_updated_at_idx" ON "projects"("stage", "updated_at");

-- CreateIndex
CREATE INDEX "project_stage_changes_project_id_changed_at_idx" ON "project_stage_changes"("project_id", "changed_at");

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "quotation_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_revisions" ADD CONSTRAINT "quotation_revisions_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_revisions" ADD CONSTRAINT "quotation_revisions_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_revisions" ADD CONSTRAINT "quotation_revisions_approval_recorded_by_id_fkey" FOREIGN KEY ("approval_recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_revisions" ADD CONSTRAINT "quotation_revisions_pdf_file_id_fkey" FOREIGN KEY ("pdf_file_id") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_line_items" ADD CONSTRAINT "quotation_line_items_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "quotation_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_line_items" ADD CONSTRAINT "quotation_line_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_quotation_revision_id_fkey" FOREIGN KEY ("quotation_revision_id") REFERENCES "quotation_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_stage_changes" ADD CONSTRAINT "project_stage_changes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_stage_changes" ADD CONSTRAINT "project_stage_changes_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ───────────────── Hand-written integrity rules (NULL-safe) ─────────────────

-- Document numbers shown to customers: GIK-QT-2026-00001, GIK-OR-…, GIK-PR-…
CREATE SEQUENCE "quotation_number_seq" START 1;
CREATE SEQUENCE "order_number_seq" START 1;
CREATE SEQUENCE "project_reference_seq" START 1;

ALTER TABLE "quotations" ADD CONSTRAINT "quotations_title_not_blank" CHECK (length(btrim("title")) > 0);
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_rejected_needs_reason"
  CHECK ("status" <> 'rejected' OR length(btrim(coalesce("rejected_reason", ''))) > 0);

-- Totals: total = subtotal − discount + VAT, nothing negative, discount never above the subtotal.
ALTER TABLE "quotation_revisions" ADD CONSTRAINT "quotation_revisions_amounts_valid" CHECK (
  "subtotal_fils" >= 0 AND "discount_fils" >= 0 AND "vat_fils" >= 0 AND "total_fils" >= 0
  AND "discount_fils" <= "subtotal_fils"
  AND "total_fils" = "subtotal_fils" - "discount_fils" + "vat_fils"
  AND "vat_rate_basis_points" BETWEEN 0 AND 10000
  AND ("vat_rate_basis_points" > 0 OR "vat_fils" = 0)
);
ALTER TABLE "quotation_revisions" ADD CONSTRAINT "quotation_revisions_revision_positive" CHECK ("revision" >= 1);
ALTER TABLE "quotation_revisions" ADD CONSTRAINT "quotation_revisions_sent_is_locked"
  CHECK ("sent_at" IS NULL OR "locked_at" IS NOT NULL);
ALTER TABLE "quotation_revisions" ADD CONSTRAINT "quotation_revisions_approval_complete" CHECK (
  "approved_at" IS NULL
  OR ("locked_at" IS NOT NULL AND "approval_method" IS NOT NULL AND length(btrim(coalesce("approval_note", ''))) > 0)
);

-- Line totals are quantity (in thousandths) × unit price, rounded half up to the fils.
ALTER TABLE "quotation_line_items" ADD CONSTRAINT "quotation_line_items_amounts_valid" CHECK (
  "quantity_milli" > 0 AND "unit_price_fils" >= 0
  AND "line_total_fils" = ("quantity_milli"::bigint * "unit_price_fils" + 500) / 1000
);
ALTER TABLE "quotation_line_items" ADD CONSTRAINT "quotation_line_items_description_not_blank"
  CHECK (length(btrim("description")) > 0);
ALTER TABLE "quotation_line_items" ADD CONSTRAINT "quotation_line_items_dimensions_positive" CHECK (
  ("width_mm" IS NULL OR "width_mm" > 0) AND ("height_mm" IS NULL OR "height_mm" > 0)
  AND ("depth_mm" IS NULL OR "depth_mm" > 0)
);

-- A sent (locked) revision can't change, except recording the customer's approval and its PDF.
CREATE FUNCTION "protect_locked_revision"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."locked_at" IS NOT NULL THEN
      RAISE EXCEPTION 'quotation revision % is locked', OLD."id" USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD."locked_at" IS NOT NULL AND (
       NEW."quotation_id" IS DISTINCT FROM OLD."quotation_id"
    OR NEW."revision" IS DISTINCT FROM OLD."revision"
    OR NEW."subtotal_fils" IS DISTINCT FROM OLD."subtotal_fils"
    OR NEW."discount_fils" IS DISTINCT FROM OLD."discount_fils"
    OR NEW."vat_rate_basis_points" IS DISTINCT FROM OLD."vat_rate_basis_points"
    OR NEW."vat_fils" IS DISTINCT FROM OLD."vat_fils"
    OR NEW."total_fils" IS DISTINCT FROM OLD."total_fils"
    OR NEW."vat_number" IS DISTINCT FROM OLD."vat_number"
    OR NEW."valid_until" IS DISTINCT FROM OLD."valid_until"
    OR NEW."notes" IS DISTINCT FROM OLD."notes"
    OR NEW."terms" IS DISTINCT FROM OLD."terms"
    OR NEW."sent_at" IS DISTINCT FROM OLD."sent_at"
    OR NEW."sent_by_id" IS DISTINCT FROM OLD."sent_by_id"
    OR NEW."locked_at" IS DISTINCT FROM OLD."locked_at"
  ) THEN
    RAISE EXCEPTION 'quotation revision % is locked', OLD."id" USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "quotation_revisions_locked" BEFORE UPDATE OR DELETE ON "quotation_revisions"
  FOR EACH ROW EXECUTE FUNCTION "protect_locked_revision"();

CREATE FUNCTION "protect_locked_lines"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE rev text := CASE WHEN TG_OP = 'DELETE' THEN OLD."revision_id" ELSE NEW."revision_id" END;
BEGIN
  IF EXISTS (SELECT 1 FROM "quotation_revisions" r WHERE r."id" = rev AND r."locked_at" IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND EXISTS (
       SELECT 1 FROM "quotation_revisions" r WHERE r."id" = OLD."revision_id" AND r."locked_at" IS NOT NULL)) THEN
    RAISE EXCEPTION 'quotation revision % is locked', rev USING ERRCODE = 'check_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER "quotation_line_items_locked" BEFORE INSERT OR UPDATE OR DELETE ON "quotation_line_items"
  FOR EACH ROW EXECUTE FUNCTION "protect_locked_lines"();

ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts_valid" CHECK (
  "total_fils" >= 0 AND ("deposit_fils" IS NULL OR ("deposit_fils" >= 0 AND "deposit_fils" <= "total_fils"))
);
ALTER TABLE "orders" ADD CONSTRAINT "orders_deposit_received_needs_amount"
  CHECK ("deposit_received_at" IS NULL OR "deposit_fils" IS NOT NULL);

ALTER TABLE "projects" ADD CONSTRAINT "projects_title_not_blank" CHECK (length(btrim("title")) > 0);

-- Project stage history is append-only.
CREATE TRIGGER "project_stage_changes_append_only" BEFORE UPDATE OR DELETE ON "project_stage_changes"
  FOR EACH ROW EXECUTE FUNCTION "forbid_change"();
