-- Stage 4: AI Sales Agent. Hand-over to a person, knowledge documents (searched by the chat), and
-- messages to customers that need approval before they are sent.

-- Hand-over: when a chat visitor asked to talk to a person (or for a callback).
ALTER TABLE "leads" ADD COLUMN "handover_requested_at" TIMESTAMPTZ(3);
CREATE INDEX "leads_handover_requested_at_idx" ON "leads"("handover_requested_at");

-- Knowledge documents ---------------------------------------------------------------------------
CREATE TYPE "KnowledgeDocKind" AS ENUM ('brochure', 'catalogue', 'product', 'company', 'policy', 'pricing', 'other');
CREATE TYPE "KnowledgeDocStatus" AS ENUM ('draft', 'published');

CREATE TABLE "knowledge_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "KnowledgeDocKind" NOT NULL DEFAULT 'other',
    "status" "KnowledgeDocStatus" NOT NULL DEFAULT 'draft',
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "extracted_with" TEXT NOT NULL,
    "truncated" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "knowledge_documents_title_length" CHECK (char_length(btrim("title")) BETWEEN 2 AND 200),
    CONSTRAINT "knowledge_documents_text_length" CHECK (char_length("text") BETWEEN 1 AND 200000),
    CONSTRAINT "knowledge_documents_size" CHECK ("size_bytes" > 0),
    CONSTRAINT "knowledge_documents_published_at" CHECK (("status" = 'published') = ("published_at" IS NOT NULL))
);
CREATE INDEX "knowledge_documents_status_kind_idx" ON "knowledge_documents"("status", "kind");
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_updated_by_id_fkey"
  FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Passages the chat searches. 'simple' text search works for English and Arabic alike (no stemming).
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tsv" tsvector GENERATED ALWAYS AS (to_tsvector('simple', "content")) STORED,
    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "knowledge_chunks_content_length" CHECK (char_length("content") BETWEEN 1 AND 4000)
);
CREATE UNIQUE INDEX "knowledge_chunks_document_id_ordinal_key" ON "knowledge_chunks"("document_id", "ordinal");
CREATE INDEX "knowledge_chunks_tsv_idx" ON "knowledge_chunks" USING GIN ("tsv");
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Messages to customers -------------------------------------------------------------------------
CREATE TYPE "MessageChannel" AS ENUM ('email', 'whatsapp');
CREATE TYPE "CustomerMessageStatus" AS ENUM ('pending_approval', 'approved', 'sent', 'failed', 'rejected', 'cancelled');

CREATE TABLE "customer_messages" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL DEFAULT 'email',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "language" "Locale" NOT NULL DEFAULT 'en',
    "status" "CustomerMessageStatus" NOT NULL DEFAULT 'pending_approval',
    "origin" TEXT NOT NULL,
    "created_by_id" TEXT,
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMPTZ(3),
    "decision_note" TEXT,
    "sent_at" TIMESTAMPTZ(3),
    "error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "customer_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_messages_origin" CHECK ("origin" IN ('staff', 'ai', 'auto_follow_up')),
    CONSTRAINT "customer_messages_body_length" CHECK (char_length(btrim("body")) BETWEEN 1 AND 5000),
    CONSTRAINT "customer_messages_subject_length" CHECK ("subject" IS NULL OR char_length("subject") <= 200),
    CONSTRAINT "customer_messages_email_subject" CHECK ("channel" <> 'email' OR "subject" IS NOT NULL),
    -- Nothing leaves without a person's decision; a sent message records when.
    CONSTRAINT "customer_messages_decided" CHECK ("status" IN ('pending_approval', 'cancelled') OR "decided_by_id" IS NOT NULL OR "decided_at" IS NOT NULL),
    CONSTRAINT "customer_messages_sent_at" CHECK (("status" = 'sent') = ("sent_at" IS NOT NULL))
);
CREATE INDEX "customer_messages_status_created_at_idx" ON "customer_messages"("status", "created_at");
CREATE INDEX "customer_messages_lead_id_idx" ON "customer_messages"("lead_id");
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_decided_by_id_fkey"
  FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A sent message is a record of what the customer received: it can't be changed afterwards.
CREATE FUNCTION "protect_sent_customer_message"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" = 'sent' THEN
    RAISE EXCEPTION 'customer_messages: a sent message is final' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "customer_messages_sent_final" BEFORE UPDATE OR DELETE ON "customer_messages"
  FOR EACH ROW EXECUTE FUNCTION "protect_sent_customer_message"();
