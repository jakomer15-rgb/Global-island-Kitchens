-- Stage 5: AI Marketing and Lead Generation Agent. Prospects (businesses that may buy from GIK), outreach
-- campaigns that need approval before anything is sent, and the link from a converted prospect to its lead.

ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'prospecting';

CREATE TYPE "ProspectType" AS ENUM ('interior_designer', 'architect', 'construction_company', 'real_estate_developer', 'property_management', 'renovation_contractor', 'commercial_contractor', 'homeowner_new_build', 'other');
CREATE TYPE "ProspectStatus" AS ENUM ('new', 'contacted', 'interested', 'not_interested', 'converted', 'do_not_contact');
CREATE TYPE "ProspectSource" AS ENUM ('manual', 'import', 'google_places', 'referral', 'event', 'other');
CREATE TYPE "ProspectPriority" AS ENUM ('high', 'medium', 'low');

CREATE TABLE "prospects" (
    "id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_role" TEXT,
    "type" "ProspectType" NOT NULL DEFAULT 'other',
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "country" TEXT NOT NULL DEFAULT 'BH',
    "area" TEXT,
    "source" "ProspectSource" NOT NULL DEFAULT 'manual',
    "source_note" TEXT,
    "place_id" TEXT,
    "status" "ProspectStatus" NOT NULL DEFAULT 'new',
    "score" INTEGER NOT NULL DEFAULT 0,
    "priority" "ProspectPriority" NOT NULL DEFAULT 'low',
    "opportunity" TEXT,
    "notes" TEXT,
    "assigned_to_id" TEXT,
    "last_contacted_at" TIMESTAMPTZ(3),
    "unsubscribed_at" TIMESTAMPTZ(3),
    "converted_lead_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "prospects_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "prospects_company_name_length" CHECK (char_length(btrim("company_name")) BETWEEN 2 AND 200),
    CONSTRAINT "prospects_country" CHECK ("country" IN ('BH', 'SA', 'AE', 'KW', 'QA', 'OM')),
    CONSTRAINT "prospects_email_lowercase" CHECK ("email" IS NULL OR "email" = lower("email")),
    CONSTRAINT "prospects_phone_e164" CHECK ("phone" IS NULL OR "phone" ~ '^\+[1-9][0-9]{6,14}$'),
    CONSTRAINT "prospects_website_http" CHECK ("website" IS NULL OR "website" ~ '^https?://'),
    CONSTRAINT "prospects_score_range" CHECK ("score" BETWEEN 0 AND 100),
    CONSTRAINT "prospects_text_lengths" CHECK (
      coalesce(char_length("notes"), 0) <= 4000 AND coalesce(char_length("opportunity"), 0) <= 2000
      AND coalesce(char_length("area"), 0) <= 120 AND coalesce(char_length("source_note"), 0) <= 300),
    -- Someone who asked not to be contacted stays that way.
    CONSTRAINT "prospects_unsubscribed_dnc" CHECK ("unsubscribed_at" IS NULL OR "status" = 'do_not_contact')
);
CREATE UNIQUE INDEX "prospects_email_key" ON "prospects" ("email") WHERE "email" IS NOT NULL;
CREATE UNIQUE INDEX "prospects_phone_key" ON "prospects" ("phone") WHERE "phone" IS NOT NULL;
CREATE UNIQUE INDEX "prospects_place_id_key" ON "prospects" ("place_id") WHERE "place_id" IS NOT NULL;
CREATE INDEX "prospects_status_score_idx" ON "prospects"("status", "score");
CREATE INDEX "prospects_type_country_idx" ON "prospects"("type", "country");
CREATE INDEX "prospects_created_at_idx" ON "prospects"("created_at");
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_assigned_to_id_fkey"
  FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_converted_lead_id_fkey"
  FOREIGN KEY ("converted_lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'pending_approval', 'approved', 'sent', 'rejected', 'cancelled');
CREATE TYPE "CampaignMessageStatus" AS ENUM ('draft', 'queued', 'sent', 'failed', 'skipped');

CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "language" "Locale" NOT NULL DEFAULT 'en',
    "audience" JSONB NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "created_by_id" TEXT,
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMPTZ(3),
    "decision_note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "campaigns_name_length" CHECK (char_length(btrim("name")) BETWEEN 2 AND 120),
    CONSTRAINT "campaigns_brief_length" CHECK (char_length(btrim("brief")) BETWEEN 10 AND 2000),
    CONSTRAINT "campaigns_decided" CHECK ("status" IN ('draft', 'pending_approval', 'cancelled') OR "decided_at" IS NOT NULL)
);
CREATE INDEX "campaigns_status_created_at_idx" ON "campaigns"("status", "created_at");
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_decided_by_id_fkey"
  FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "campaign_messages" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "prospect_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "CampaignMessageStatus" NOT NULL DEFAULT 'draft',
    "sent_at" TIMESTAMPTZ(3),
    "error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "campaign_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "campaign_messages_lengths" CHECK (char_length(btrim("subject")) BETWEEN 3 AND 200 AND char_length(btrim("body")) BETWEEN 10 AND 5000),
    CONSTRAINT "campaign_messages_sent_at" CHECK (("status" = 'sent') = ("sent_at" IS NOT NULL))
);
CREATE UNIQUE INDEX "campaign_messages_campaign_id_prospect_id_key" ON "campaign_messages"("campaign_id", "prospect_id");
CREATE INDEX "campaign_messages_status_idx" ON "campaign_messages"("status");
CREATE INDEX "campaign_messages_prospect_id_idx" ON "campaign_messages"("prospect_id");
ALTER TABLE "campaign_messages" ADD CONSTRAINT "campaign_messages_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campaign_messages" ADD CONSTRAINT "campaign_messages_prospect_id_fkey"
  FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A sent email is a record of what the business received: final.
CREATE FUNCTION "protect_sent_campaign_message"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" = 'sent' THEN
    RAISE EXCEPTION 'campaign_messages: a sent message is final' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "campaign_messages_sent_final" BEFORE UPDATE OR DELETE ON "campaign_messages"
  FOR EACH ROW EXECUTE FUNCTION "protect_sent_campaign_message"();
