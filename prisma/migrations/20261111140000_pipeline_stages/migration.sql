-- Stage 3: the owner's sales pipeline
-- New Inquiry → Contacted → Qualified → Site Visit → Measurement → Quotation → Negotiation → Won / Lost.
-- Existing leads keep their status. (Own migration: new enum values can't be used in the same transaction.)
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'site_visit' AFTER 'qualified';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'measurement' AFTER 'site_visit';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'negotiation' AFTER 'quoted';
