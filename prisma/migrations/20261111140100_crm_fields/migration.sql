-- Stage 3: CRM fields kept by the database itself, so every way a lead changes (forms, chat, WhatsApp,
-- staff) keeps them right.

-- Customers: location, and the record a duplicate was merged into.
ALTER TABLE "customers" ADD COLUMN "location" TEXT;
ALTER TABLE "customers" ADD COLUMN "merged_into_id" TEXT;
ALTER TABLE "customers" ADD CONSTRAINT "customers_location_length" CHECK ("location" IS NULL OR char_length("location") <= 120);
ALTER TABLE "customers" ADD CONSTRAINT "customers_not_merged_into_self" CHECK ("merged_into_id" IS NULL OR "merged_into_id" <> "id");
ALTER TABLE "customers" ADD CONSTRAINT "customers_merged_is_archived" CHECK ("merged_into_id" IS NULL OR "archived_at" IS NOT NULL);
ALTER TABLE "customers" ADD CONSTRAINT "customers_merged_into_id_fkey"
  FOREIGN KEY ("merged_into_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "customers_merged_into_id_idx" ON "customers"("merged_into_id");

-- Leads: score, last contact, next follow-up.
ALTER TABLE "leads" ADD COLUMN "score" INTEGER;
ALTER TABLE "leads" ADD COLUMN "last_contact_at" TIMESTAMPTZ(3);
ALTER TABLE "leads" ADD COLUMN "next_follow_up_at" TIMESTAMPTZ(3);
ALTER TABLE "leads" ADD CONSTRAINT "leads_score_range" CHECK ("score" IS NULL OR "score" BETWEEN 0 AND 100);
CREATE INDEX "leads_score_idx" ON "leads"("score");
CREATE INDEX "leads_next_follow_up_at_idx" ON "leads"("next_follow_up_at");
CREATE INDEX "leads_last_contact_at_idx" ON "leads"("last_contact_at");

-- Lead score, 0–100: how ready the lead looks to buy, from what is known. Mirrored in
-- src/lib/lead-score.ts (shown to staff as a breakdown); a DB test keeps the two identical.
--   Rating: HOT 40, WARM 25, COLD 10.
--   Pipeline: contacted 5, qualified 10, site visit 15, measurement 20, quotation 20, negotiation 25.
--   Known requirements: product 5, dimensions 10, budget 10, timeline 10, location 5.
-- Won and lost leads have no score (nothing left to win).
CREATE FUNCTION "lead_score"(p_lead_id TEXT, p_status TEXT, p_temperature TEXT, p_category TEXT)
RETURNS INTEGER LANGUAGE plpgsql STABLE AS $$
DECLARE
  r "lead_requirements"%ROWTYPE;
  q_measured BOOLEAN := FALSE;
  q_area TEXT;
  s INTEGER := 0;
BEGIN
  IF p_status IN ('won', 'lost') THEN
    RETURN NULL;
  END IF;
  s := s + CASE p_temperature WHEN 'hot' THEN 40 WHEN 'warm' THEN 25 WHEN 'cold' THEN 10 ELSE 0 END;
  s := s + CASE p_status
    WHEN 'contacted' THEN 5 WHEN 'qualified' THEN 10 WHEN 'site_visit' THEN 15
    WHEN 'measurement' THEN 20 WHEN 'quoted' THEN 20 WHEN 'negotiation' THEN 25 ELSE 0 END;
  SELECT * INTO r FROM "lead_requirements" WHERE "lead_id" = p_lead_id;
  SELECT jsonb_typeof("measurements") = 'array' AND jsonb_array_length("measurements") > 0, "area"
    INTO q_measured, q_area
    FROM "quotation_requests" WHERE "lead_id" = p_lead_id;
  IF nullif(btrim(coalesce(p_category, '')), '') IS NOT NULL OR nullif(btrim(coalesce(r."product_category", '')), '') IS NOT NULL THEN
    s := s + 5;
  END IF;
  IF nullif(btrim(coalesce(r."dimensions", '')), '') IS NOT NULL OR coalesce(q_measured, FALSE) THEN
    s := s + 10;
  END IF;
  IF nullif(btrim(coalesce(r."budget", '')), '') IS NOT NULL THEN s := s + 10; END IF;
  IF nullif(btrim(coalesce(r."timeline", '')), '') IS NOT NULL THEN s := s + 10; END IF;
  IF nullif(btrim(coalesce(r."location", '')), '') IS NOT NULL OR nullif(btrim(coalesce(q_area, '')), '') IS NOT NULL THEN
    s := s + 5;
  END IF;
  RETURN least(s, 100);
END $$;

-- Recomputed whenever the lead's own inputs change ...
CREATE FUNCTION "leads_set_score"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."score" := "lead_score"(NEW."id", NEW."status"::TEXT, NEW."temperature"::TEXT, NEW."category");
  RETURN NEW;
END $$;
CREATE TRIGGER "leads_score" BEFORE INSERT OR UPDATE OF "status", "temperature", "category" ON "leads"
  FOR EACH ROW EXECUTE FUNCTION "leads_set_score"();

-- ... and when its requirements or quotation request change (only the score column is written, so the
-- trigger above does not fire again).
CREATE FUNCTION "lead_rescore_from_child"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "leads" SET "score" = "lead_score"("id", "status"::TEXT, "temperature"::TEXT, "category")
    WHERE "id" = NEW."lead_id";
  RETURN NULL;
END $$;
CREATE TRIGGER "lead_requirements_rescore" AFTER INSERT OR UPDATE ON "lead_requirements"
  FOR EACH ROW EXECUTE FUNCTION "lead_rescore_from_child"();
CREATE TRIGGER "quotation_requests_rescore" AFTER INSERT OR UPDATE OF "measurements", "area" ON "quotation_requests"
  FOR EACH ROW EXECUTE FUNCTION "lead_rescore_from_child"();

-- Last contact: the latest call, email, WhatsApp message or meeting logged on the lead (staff or webhook).
CREATE FUNCTION "lead_touch_last_contact"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "leads" SET "last_contact_at" = greatest(coalesce("last_contact_at", NEW."created_at"), NEW."created_at")
    WHERE "id" = NEW."lead_id";
  RETURN NULL;
END $$;
CREATE TRIGGER "lead_activities_last_contact" AFTER INSERT ON "lead_activities"
  FOR EACH ROW WHEN (NEW."kind" IN ('call', 'email', 'whatsapp', 'meeting'))
  EXECUTE FUNCTION "lead_touch_last_contact"();

-- Next follow-up: the earliest open follow-up.
CREATE FUNCTION "lead_refresh_next_follow_up"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target TEXT := coalesce(NEW."lead_id", OLD."lead_id");
BEGIN
  IF TG_OP = 'DELETE' THEN target := OLD."lead_id"; END IF;
  UPDATE "leads" SET "next_follow_up_at" =
    (SELECT min("due_at") FROM "follow_ups" WHERE "lead_id" = target AND "done_at" IS NULL)
    WHERE "id" = target;
  RETURN NULL;
END $$;
CREATE TRIGGER "follow_ups_next" AFTER INSERT OR UPDATE OR DELETE ON "follow_ups"
  FOR EACH ROW EXECUTE FUNCTION "lead_refresh_next_follow_up"();

-- Fill the new columns for existing leads.
UPDATE "leads" SET "score" = "lead_score"("id", "status"::TEXT, "temperature"::TEXT, "category");
UPDATE "leads" l SET "last_contact_at" = a.latest
  FROM (SELECT "lead_id", max("created_at") AS latest FROM "lead_activities"
        WHERE "kind" IN ('call', 'email', 'whatsapp', 'meeting') GROUP BY "lead_id") a
  WHERE a."lead_id" = l."id";
UPDATE "leads" l SET "next_follow_up_at" = f.next
  FROM (SELECT "lead_id", min("due_at") AS next FROM "follow_ups" WHERE "done_at" IS NULL GROUP BY "lead_id") f
  WHERE f."lead_id" = l."id";
