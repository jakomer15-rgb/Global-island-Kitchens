-- Stage 8: workflows. Switches, options and a run log for the nine automation workflows; a weekly campaign
-- report is recorded like the other emailed reports.

-- CreateTable
CREATE TABLE "workflow_settings" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "last_checked_at" TIMESTAMPTZ(3),
    "updated_by_id" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workflow_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" TEXT NOT NULL,
    "workflow" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),
    "result" JSONB,
    "error" TEXT,
    "retry_of_id" TEXT,
    "triggered_by_id" TEXT,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflow_runs_workflow_started_at_idx" ON "workflow_runs"("workflow", "started_at");

-- CreateIndex
CREATE INDEX "workflow_runs_status_started_at_idx" ON "workflow_runs"("status", "started_at");

-- AddForeignKey
ALTER TABLE "workflow_settings" ADD CONSTRAINT "workflow_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Rules kept by the database.
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_trigger" CHECK ("trigger" IN ('schedule', 'manual', 'n8n', 'retry'));
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_status" CHECK ("status" IN ('succeeded', 'failed', 'skipped'));
ALTER TABLE "analytics_report_runs" DROP CONSTRAINT "analytics_report_runs_kind";
ALTER TABLE "analytics_report_runs" ADD CONSTRAINT "analytics_report_runs_kind" CHECK ("kind" IN ('daily', 'weekly', 'monthly', 'campaigns'));
