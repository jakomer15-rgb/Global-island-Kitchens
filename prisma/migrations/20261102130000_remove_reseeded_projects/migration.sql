-- One-off data fix (owner's request, 2026-11-02). The first production deployment that ran the seed
-- (2026-11-01 22:56–22:57 UTC) re-created 7 company-profile projects that had been removed from the live
-- portfolio. This deletes exactly those: created by the seed in that window, with no photos and no
-- category. Matches nothing in any other database. The seed now loads the portfolio only when it is empty.
DELETE FROM "portfolio_projects" p
WHERE p."created_at" >= TIMESTAMPTZ '2026-11-01 22:56:40+00'
  AND p."created_at" < TIMESTAMPTZ '2026-11-01 22:57:10+00'
  AND p."category_id" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "portfolio_images" i WHERE i."project_id" = p."id");
