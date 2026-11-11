-- Stage 7: AI Business Analytics Agent. Management questions with the queries and figures used, and a
-- record of emailed reports so each period is sent once.

-- CreateTable
CREATE TABLE "analytics_questions" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "queries" JSONB NOT NULL,
    "results" JSONB NOT NULL,
    "answer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "asked_by_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_report_runs" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "period_start" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_report_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_questions_created_at_idx" ON "analytics_questions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_report_runs_kind_period_start_key" ON "analytics_report_runs"("kind", "period_start");

-- AddForeignKey
ALTER TABLE "analytics_questions" ADD CONSTRAINT "analytics_questions_asked_by_id_fkey" FOREIGN KEY ("asked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Rules kept by the database.
ALTER TABLE "analytics_questions" ADD CONSTRAINT "analytics_questions_lengths" CHECK (char_length(btrim("question")) BETWEEN 3 AND 500 AND char_length("answer") <= 5000);
ALTER TABLE "analytics_report_runs" ADD CONSTRAINT "analytics_report_runs_kind" CHECK ("kind" IN ('daily', 'weekly', 'monthly'));
