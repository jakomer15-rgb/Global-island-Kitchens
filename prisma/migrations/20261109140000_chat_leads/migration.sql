-- AI sales agent, Phase 5: chat conversations, chat leads, HOT / WARM / COLD and lead requirements.

-- CreateEnum
CREATE TYPE "LeadTemperature" AS ENUM ('hot', 'warm', 'cold');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('user', 'assistant', 'event');

-- AlterEnum
ALTER TYPE "LeadSource" ADD VALUE 'website_chat';

-- AlterTable
ALTER TABLE "file_assets" ADD COLUMN     "chat_conversation_id" TEXT;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "temperature" "LeadTemperature",
ADD COLUMN     "temperature_by_staff" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "lead_requirements" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "product_category" TEXT,
    "dimensions" TEXT,
    "design_preferences" TEXT,
    "material_preferences" TEXT,
    "location" TEXT,
    "budget" TEXT,
    "timeline" TEXT,
    "notes" TEXT,
    "edited_by_staff" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lead_requirements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lead_requirements_lengths_check" CHECK (
      coalesce(char_length("product_category"), 0) <= 200
      AND coalesce(char_length("dimensions"), 0) <= 500
      AND coalesce(char_length("design_preferences"), 0) <= 500
      AND coalesce(char_length("material_preferences"), 0) <= 500
      AND coalesce(char_length("location"), 0) <= 200
      AND coalesce(char_length("budget"), 0) <= 200
      AND coalesce(char_length("timeline"), 0) <= 200
      AND coalesce(char_length("notes"), 0) <= 2000
    )
);

-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'en',
    "language" TEXT,
    "lead_id" TEXT,
    "customer_id" TEXT,
    "ip_hash" TEXT,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "temperature" "LeadTemperature",
    "temperature_note" TEXT,
    "requirements" JSONB,
    "summary" TEXT,
    "analysed_at" TIMESTAMPTZ(3),
    "model" TEXT,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_read_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_write_tokens" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_conversations_counts_check" CHECK (
      "message_count" >= 0 AND "input_tokens" >= 0 AND "output_tokens" >= 0
      AND "cache_read_tokens" >= 0 AND "cache_write_tokens" >= 0
    ),
    CONSTRAINT "chat_conversations_language_check" CHECK ("language" IS NULL OR "language" IN ('en', 'ar', 'hi', 'ur', 'other')),
    CONSTRAINT "chat_conversations_text_check" CHECK (
      coalesce(char_length("summary"), 0) <= 2000 AND coalesce(char_length("temperature_note"), 0) <= 500
    )
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_messages_content_check" CHECK (char_length("content") BETWEEN 1 AND 8000)
);

-- CreateIndex
CREATE UNIQUE INDEX "lead_requirements_lead_id_key" ON "lead_requirements"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_conversations_token_hash_key" ON "chat_conversations"("token_hash");

-- CreateIndex
CREATE INDEX "chat_conversations_last_message_at_idx" ON "chat_conversations"("last_message_at");

-- CreateIndex
CREATE INDEX "chat_conversations_lead_id_idx" ON "chat_conversations"("lead_id");

-- CreateIndex
CREATE INDEX "chat_conversations_temperature_last_message_at_idx" ON "chat_conversations"("temperature", "last_message_at");

-- CreateIndex
CREATE INDEX "chat_messages_conversation_id_created_at_idx" ON "chat_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "file_assets_chat_conversation_id_idx" ON "file_assets"("chat_conversation_id");

-- CreateIndex
CREATE INDEX "leads_temperature_created_at_idx" ON "leads"("temperature", "created_at");

-- AddForeignKey
ALTER TABLE "lead_requirements" ADD CONSTRAINT "lead_requirements_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_chat_conversation_id_fkey" FOREIGN KEY ("chat_conversation_id") REFERENCES "chat_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
