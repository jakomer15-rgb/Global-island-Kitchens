-- Stage 5: a campaign's email template ({company}, {contact}, {area} and {type} are filled in for each
-- prospect when the emails are prepared; staff can still edit each email).
ALTER TABLE "campaigns" ADD COLUMN "subject_template" TEXT;
ALTER TABLE "campaigns" ADD COLUMN "body_template" TEXT;
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_template_lengths" CHECK (
  coalesce(char_length("subject_template"), 0) <= 200 AND coalesce(char_length("body_template"), 0) <= 5000);
