-- Autopilot (2026-11-19): its morning summary is recorded once per day like the emailed reports.
ALTER TABLE "analytics_report_runs" DROP CONSTRAINT "analytics_report_runs_kind";
ALTER TABLE "analytics_report_runs" ADD CONSTRAINT "analytics_report_runs_kind" CHECK ("kind" IN ('daily', 'weekly', 'monthly', 'campaigns', 'autopilot'));
