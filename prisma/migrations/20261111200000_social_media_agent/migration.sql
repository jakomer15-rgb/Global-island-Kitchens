-- Stage 6: AI Social Media Agent. Posts (drafted by staff or the AI), their approval, publishing per platform
-- and engagement figures. The database refuses to publish a post that was never approved and keeps approved
-- content unchanged until it goes back to draft.

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('instagram', 'facebook', 'linkedin', 'tiktok');

-- CreateEnum
CREATE TYPE "SocialPostType" AS ENUM ('image', 'text', 'reel', 'story');

-- CreateEnum
CREATE TYPE "SocialPostStatus" AS ENUM ('draft', 'pending_approval', 'approved', 'scheduled', 'published', 'failed');

-- CreateEnum
CREATE TYPE "SocialLanguage" AS ENUM ('en', 'ar', 'both');

-- CreateEnum
CREATE TYPE "SocialTargetStatus" AS ENUM ('pending', 'published', 'failed', 'manual');

-- CreateTable
CREATE TABLE "social_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "starts_on" DATE,
    "ends_on" DATE,
    "created_by_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "social_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brief" TEXT,
    "type" "SocialPostType" NOT NULL DEFAULT 'image',
    "platforms" "SocialPlatform"[],
    "language" "SocialLanguage" NOT NULL DEFAULT 'both',
    "caption_en" TEXT,
    "caption_ar" TEXT,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "script" TEXT,
    "image_brief" TEXT,
    "image_file_id" TEXT,
    "suggested_image_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "planned_at" TIMESTAMPTZ(3),
    "status" "SocialPostStatus" NOT NULL DEFAULT 'draft',
    "campaign_id" TEXT,
    "created_by_id" TEXT,
    "submitted_at" TIMESTAMPTZ(3),
    "decided_by_id" TEXT,
    "approved_at" TIMESTAMPTZ(3),
    "decision_note" TEXT,
    "published_at" TIMESTAMPTZ(3),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_post_targets" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "status" "SocialTargetStatus" NOT NULL DEFAULT 'pending',
    "external_id" TEXT,
    "permalink" TEXT,
    "error" TEXT,
    "published_at" TIMESTAMPTZ(3),
    "likes" INTEGER,
    "comments" INTEGER,
    "shares" INTEGER,
    "metrics_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "social_post_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_campaigns_created_at_idx" ON "social_campaigns"("created_at");

-- CreateIndex
CREATE INDEX "social_posts_planned_at_idx" ON "social_posts"("planned_at");

-- CreateIndex
CREATE INDEX "social_posts_status_planned_at_idx" ON "social_posts"("status", "planned_at");

-- CreateIndex
CREATE INDEX "social_posts_campaign_id_idx" ON "social_posts"("campaign_id");

-- CreateIndex
CREATE INDEX "social_post_targets_status_published_at_idx" ON "social_post_targets"("status", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "social_post_targets_post_id_platform_key" ON "social_post_targets"("post_id", "platform");

-- AddForeignKey
ALTER TABLE "social_campaigns" ADD CONSTRAINT "social_campaigns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_image_file_id_fkey" FOREIGN KEY ("image_file_id") REFERENCES "file_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "social_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_post_targets" ADD CONSTRAINT "social_post_targets_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rules kept by the database.
ALTER TABLE "social_campaigns" ADD CONSTRAINT "social_campaigns_name_length" CHECK (char_length(btrim("name")) BETWEEN 2 AND 120),
  ADD CONSTRAINT "social_campaigns_dates" CHECK ("starts_on" IS NULL OR "ends_on" IS NULL OR "ends_on" >= "starts_on");

ALTER TABLE "social_posts"
  ADD CONSTRAINT "social_posts_title_length" CHECK (char_length(btrim("title")) BETWEEN 2 AND 160),
  ADD CONSTRAINT "social_posts_platforms" CHECK (cardinality("platforms") BETWEEN 1 AND 4),
  -- Instagram allows 2,200 characters and 30 hashtags.
  ADD CONSTRAINT "social_posts_text_lengths" CHECK (
    coalesce(char_length("caption_en"), 0) <= 2200 AND coalesce(char_length("caption_ar"), 0) <= 2200
    AND coalesce(char_length("script"), 0) <= 5000 AND coalesce(char_length("image_brief"), 0) <= 2000
    AND coalesce(char_length("brief"), 0) <= 2000 AND coalesce(cardinality("hashtags"), 0) <= 30),
  -- Approved, scheduled, published or failed: someone approved it.
  ADD CONSTRAINT "social_posts_approved" CHECK ("status" IN ('draft', 'pending_approval') OR "approved_at" IS NOT NULL),
  ADD CONSTRAINT "social_posts_scheduled" CHECK ("status" <> 'scheduled' OR "planned_at" IS NOT NULL),
  ADD CONSTRAINT "social_posts_published" CHECK ("status" <> 'published' OR "published_at" IS NOT NULL);

-- Approved content stays exactly as approved: changing it means going back to draft (and approval again).
-- A published post is final, and a post already published on some platform can't go back to draft.
CREATE FUNCTION "protect_approved_social_post"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" = 'published' OR EXISTS (
      SELECT 1 FROM "social_post_targets" WHERE "post_id" = OLD."id" AND "status" = 'published') THEN
      RAISE EXCEPTION 'social_posts: a published post is kept' USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD."status" = 'published' AND NEW."status" <> 'published' THEN
    RAISE EXCEPTION 'social_posts: a published post is final' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW."status" = 'draft' AND OLD."status" <> 'draft' AND EXISTS (
    SELECT 1 FROM "social_post_targets" WHERE "post_id" = OLD."id" AND "status" = 'published') THEN
    RAISE EXCEPTION 'social_posts: already published on a platform' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD."status" IN ('approved', 'scheduled', 'published', 'failed') AND NEW."status" <> 'draft' AND (
    NEW."type", NEW."platforms", NEW."language", NEW."caption_en", NEW."caption_ar", NEW."hashtags", NEW."image_file_id")
    IS DISTINCT FROM
    (OLD."type", OLD."platforms", OLD."language", OLD."caption_en", OLD."caption_ar", OLD."hashtags", OLD."image_file_id") THEN
    RAISE EXCEPTION 'social_posts: approved content can''t change' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "social_posts_protect" BEFORE UPDATE OR DELETE ON "social_posts"
  FOR EACH ROW EXECUTE FUNCTION "protect_approved_social_post"();

ALTER TABLE "social_post_targets"
  ADD CONSTRAINT "social_post_targets_published" CHECK (("status" = 'published') = ("published_at" IS NOT NULL)),
  ADD CONSTRAINT "social_post_targets_metrics" CHECK (
    coalesce("likes", 0) >= 0 AND coalesce("comments", 0) >= 0 AND coalesce("shares", 0) >= 0);

-- Never publish a post nobody approved; a published platform result is a record (only figures change).
CREATE FUNCTION "protect_social_post_target"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" = 'published' THEN
      RAISE EXCEPTION 'social_post_targets: a published result is kept' USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."status" = 'published' AND (
    NEW."status", NEW."platform", NEW."post_id", NEW."external_id", NEW."published_at")
    IS DISTINCT FROM (OLD."status", OLD."platform", OLD."post_id", OLD."external_id", OLD."published_at") THEN
    RAISE EXCEPTION 'social_post_targets: a published result is final' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW."status" = 'published' AND NOT EXISTS (
    SELECT 1 FROM "social_posts" WHERE "id" = NEW."post_id" AND "approved_at" IS NOT NULL
      AND "status" IN ('approved', 'scheduled', 'published', 'failed')) THEN
    RAISE EXCEPTION 'social_post_targets: the post is not approved' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "social_post_targets_protect" BEFORE INSERT OR UPDATE OR DELETE ON "social_post_targets"
  FOR EACH ROW EXECUTE FUNCTION "protect_social_post_target"();