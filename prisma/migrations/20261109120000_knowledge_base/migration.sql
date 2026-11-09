-- AI sales agent: the knowledge base staff edit in Admin → AI agent.

-- CreateEnum
CREATE TYPE "KnowledgeKind" AS ENUM ('faq', 'policy', 'company', 'product', 'other');

-- CreateTable
CREATE TABLE "knowledge_entries" (
    "id" TEXT NOT NULL,
    "kind" "KnowledgeKind" NOT NULL DEFAULT 'faq',
    "title_en" TEXT NOT NULL,
    "body_en" TEXT NOT NULL,
    "title_ar" TEXT,
    "body_ar" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "knowledge_entries_pkey" PRIMARY KEY ("id"),
    -- Text sizes keep the assistant's prompt bounded (and its cost predictable).
    CONSTRAINT "knowledge_entries_title_en_check" CHECK (char_length(btrim("title_en")) BETWEEN 3 AND 200),
    CONSTRAINT "knowledge_entries_body_en_check" CHECK (char_length(btrim("body_en")) BETWEEN 3 AND 3000),
    CONSTRAINT "knowledge_entries_title_ar_check" CHECK ("title_ar" IS NULL OR char_length("title_ar") BETWEEN 1 AND 200),
    CONSTRAINT "knowledge_entries_body_ar_check" CHECK ("body_ar" IS NULL OR char_length("body_ar") BETWEEN 1 AND 3000),
    CONSTRAINT "knowledge_entries_sort_order_check" CHECK ("sort_order" BETWEEN 0 AND 9999)
);

-- CreateIndex
CREATE INDEX "knowledge_entries_published_kind_sort_order_idx" ON "knowledge_entries"("published", "kind", "sort_order");

-- AddForeignKey
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
