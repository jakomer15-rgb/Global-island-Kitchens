-- AI Business Automation Centre (Stage 2): history of "Test connection" runs on the Integrations screen.
CREATE TABLE "integration_checks" (
    "id" TEXT NOT NULL,
    "integration" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "message" TEXT NOT NULL,
    "config_hash" TEXT NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "checked_by_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_checks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "integration_checks_integration_check" CHECK ("integration" ~ '^[a-z0-9_]{2,40}$'),
    CONSTRAINT "integration_checks_message_length" CHECK (char_length("message") BETWEEN 1 AND 300),
    CONSTRAINT "integration_checks_duration_check" CHECK ("duration_ms" >= 0)
);

CREATE INDEX "integration_checks_integration_created_at_idx" ON "integration_checks"("integration", "created_at");
CREATE INDEX "integration_checks_created_at_idx" ON "integration_checks"("created_at");

ALTER TABLE "integration_checks" ADD CONSTRAINT "integration_checks_checked_by_id_fkey"
  FOREIGN KEY ("checked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
