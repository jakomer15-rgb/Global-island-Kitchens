# Global Island Kitchens — website and business platform

Bilingual (English / Arabic) website and business platform for Global Island Kitchens W.L.L, a
manufacturer and installer of kitchens, wardrobes and interior joinery in the Kingdom of Bahrain
(head office: Hamad Town · showroom: Al-Hamalah).

**Status:** Phases 1-7 and 9 complete: the public site and its quotation, consultation and contact forms, plus
the staff portal at `/admin` (dashboard, leads, customers, consultations, follow-ups, website content,
materials library, portfolio, testimonials, blog, website images, settings, staff and roles, audit
log), and quotations (revisions, locked when sent, English or Arabic PDF), recorded customer approval,\norders and project stage tracking. A designer portal for trade partners, with staff approval (see [docs/ROADMAP.md](docs/ROADMAP.md)).

Company content lives in `src/content/` (English and Arabic side by side), written only from
[docs/BUSINESS_FACTS.md](docs/BUSINESS_FACTS.md).

This is a fresh start on the `fresh-start` branch. The earlier project is preserved on the `main`
branch.

## Getting started

Requires Node 24.

```bash
npm install
npm run db:start            # in its own terminal; creates .env.local on first run
npm run db:deploy && npm run db:seed
npm run admin:create -- --email you@example.com --name "Your Name"
npm run dev
```

Commands and workflow: [AGENTS.md](AGENTS.md#commands). Environment variables, storage and the
scheduled job: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Read first

- [AGENTS.md](AGENTS.md) — ground rules, agents and workflow
- [docs/BUSINESS_FACTS.md](docs/BUSINESS_FACTS.md) — the only approved company facts
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — stack, structure, site map, decisions to approve
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — database design
- [docs/ROADMAP.md](docs/ROADMAP.md) — ten phases and their gates
- [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md) — missing business details
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — colours, typography, components
- [docs/TEST_REPORT.md](docs/TEST_REPORT.md) — latest test and Lighthouse results
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — local setup, environment, storage, cron, migrations

The earlier project on `main` used its own `.env.local`; it was kept as `.env.main-backup.local`
(copy it back to `.env.local` before working on `main`).

## Source material

The company profile (`Global_Island_Kitchens_Company_Profile.pdf`) stays in the project folder but is
not committed. Its facts are transcribed, with page references, into `docs/BUSINESS_FACTS.md`.
