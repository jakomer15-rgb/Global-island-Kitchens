-- CreateEnum
CREATE TYPE "AiDraftKind" AS ENUM ('lead_reply', 'lead_summary', 'blog_post');

-- CreateEnum
CREATE TYPE "AiDraftStatus" AS ENUM ('pending_review', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "lead_activities" ADD COLUMN     "external_id" TEXT;

-- CreateTable
CREATE TABLE "ai_drafts" (
    "id" TEXT NOT NULL,
    "kind" "AiDraftKind" NOT NULL,
    "status" "AiDraftStatus" NOT NULL DEFAULT 'pending_review',
    "lead_id" TEXT,
    "blog_post_id" TEXT,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMPTZ(3),
    "review_note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_drafts_status_created_at_idx" ON "ai_drafts"("status", "created_at");

-- CreateIndex
CREATE INDEX "ai_drafts_lead_id_idx" ON "ai_drafts"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_activities_external_id_key" ON "lead_activities"("external_id");

-- AddForeignKey
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_blog_post_id_fkey" FOREIGN KEY ("blog_post_id") REFERENCES "blog_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hand-written rules (Phase 8)

-- A decision records who made it and when; lead drafts belong to a lead, blog drafts do not;
-- an approved blog draft points at the blog post it created.
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_draft_decision_recorded"
  CHECK ("status" = 'pending_review' OR ("reviewed_by_id" IS NOT NULL AND "reviewed_at" IS NOT NULL));
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_draft_target"
  CHECK (("kind" = 'blog_post') = ("lead_id" IS NULL));
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_draft_blog_created"
  CHECK ("kind" <> 'blog_post' OR "status" <> 'approved' OR "blog_post_id" IS NOT NULL);

-- A reviewed draft is a record of what was approved: it can't be changed afterwards.
CREATE FUNCTION protect_decided_ai_draft() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'pending_review' THEN
      RAISE EXCEPTION 'A reviewed AI draft cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD."status" <> 'pending_review' AND (
       NEW."output" IS DISTINCT FROM OLD."output" OR NEW."input" IS DISTINCT FROM OLD."input"
       OR NEW."status" IS DISTINCT FROM OLD."status" OR NEW."kind" IS DISTINCT FROM OLD."kind") THEN
    RAISE EXCEPTION 'A reviewed AI draft cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER protect_decided_ai_draft BEFORE UPDATE OR DELETE ON "ai_drafts"
  FOR EACH ROW EXECUTE FUNCTION protect_decided_ai_draft();
