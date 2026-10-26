-- CreateEnum
CREATE TYPE "DesignerStatus" AS ENUM ('pending', 'approved', 'rejected', 'suspended');

-- CreateEnum
CREATE TYPE "DesignerProfession" AS ENUM ('interior_designer', 'architect', 'contractor', 'developer', 'other');

-- AlterTable
ALTER TABLE "file_assets" ADD COLUMN     "designer_project_id" TEXT;

-- CreateTable
CREATE TABLE "designer_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "company" TEXT,
    "profession" "DesignerProfession" NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "DesignerStatus" NOT NULL DEFAULT 'pending',
    "status_note" TEXT,
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "designer_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "designer_projects" (
    "id" TEXT NOT NULL,
    "designer_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "client_label" TEXT,
    "target_date" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "designer_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "designer_project_materials" (
    "project_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,

    CONSTRAINT "designer_project_materials_pkey" PRIMARY KEY ("project_id","material_id")
);

-- CreateTable
CREATE TABLE "designer_messages" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "from_staff" BOOLEAN NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "designer_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "designer_accounts_user_id_key" ON "designer_accounts"("user_id");

-- CreateIndex
CREATE INDEX "designer_accounts_status_created_at_idx" ON "designer_accounts"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "designer_projects_request_id_key" ON "designer_projects"("request_id");

-- CreateIndex
CREATE INDEX "designer_projects_designer_id_created_at_idx" ON "designer_projects"("designer_id", "created_at");

-- CreateIndex
CREATE INDEX "designer_messages_project_id_created_at_idx" ON "designer_messages"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "file_assets_designer_project_id_idx" ON "file_assets"("designer_project_id");

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_designer_project_id_fkey" FOREIGN KEY ("designer_project_id") REFERENCES "designer_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "designer_accounts" ADD CONSTRAINT "designer_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "designer_accounts" ADD CONSTRAINT "designer_accounts_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "designer_accounts" ADD CONSTRAINT "designer_accounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "designer_projects" ADD CONSTRAINT "designer_projects_designer_id_fkey" FOREIGN KEY ("designer_id") REFERENCES "designer_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "designer_projects" ADD CONSTRAINT "designer_projects_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "quotation_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "designer_project_materials" ADD CONSTRAINT "designer_project_materials_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "designer_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "designer_project_materials" ADD CONSTRAINT "designer_project_materials_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "designer_messages" ADD CONSTRAINT "designer_messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "designer_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "designer_messages" ADD CONSTRAINT "designer_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written rules (Phase 7)

-- A decision (anything but pending) records who made it and when.
ALTER TABLE "designer_accounts" ADD CONSTRAINT "designer_decision_recorded"
  CHECK ("status" = 'pending' OR ("decided_by_id" IS NOT NULL AND "decided_at" IS NOT NULL));

-- Only designer sign-ins can have a designer profile (and designers are never staff).
CREATE FUNCTION designer_account_user_kind() RETURNS trigger AS $$
BEGIN
  IF (SELECT "kind" FROM "users" WHERE "id" = NEW."user_id") IS DISTINCT FROM 'designer' THEN
    RAISE EXCEPTION 'A designer profile needs a user of kind designer';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER designer_account_user_kind BEFORE INSERT OR UPDATE OF "user_id" ON "designer_accounts"
  FOR EACH ROW EXECUTE FUNCTION designer_account_user_kind();

-- A designer user can never hold staff roles.
CREATE FUNCTION designer_no_staff_roles() RETURNS trigger AS $$
BEGIN
  IF (SELECT "kind" FROM "users" WHERE "id" = NEW."user_id") = 'designer' THEN
    RAISE EXCEPTION 'Designers cannot hold staff roles';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER designer_no_staff_roles BEFORE INSERT OR UPDATE ON "user_roles"
  FOR EACH ROW EXECUTE FUNCTION designer_no_staff_roles();

-- Internal notes can only come from staff; message text is 1-2000 characters.
ALTER TABLE "designer_messages" ADD CONSTRAINT "designer_message_internal_staff"
  CHECK (NOT "internal" OR "from_staff");
ALTER TABLE "designer_messages" ADD CONSTRAINT "designer_message_length"
  CHECK (char_length("body") BETWEEN 1 AND 2000);

-- Messages are never edited or deleted.
CREATE TRIGGER designer_messages_append_only BEFORE UPDATE OR DELETE ON "designer_messages"
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
