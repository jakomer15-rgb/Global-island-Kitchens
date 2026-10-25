# Global Island Kitchens — website and business platform

Bilingual (English / Arabic) website and business platform for Global Island Kitchens W.L.L, a
manufacturer and installer of kitchens, wardrobes and interior joinery in the Kingdom of Bahrain
(head office: Hamad Town · showroom: Al-Hamalah).

**Status:** Phase 3 complete: every public page in English and Arabic (the blog appears with its first
article). Forms, database and admin arrive from Phase 4 (see [docs/ROADMAP.md](docs/ROADMAP.md)).

Company content lives in `src/content/` (English and Arabic side by side), written only from
[docs/BUSINESS_FACTS.md](docs/BUSINESS_FACTS.md).

This is a fresh start on the `fresh-start` branch. The earlier project is preserved on the `main`
branch.

## Getting started

Requires Node 24.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Commands and workflow: [AGENTS.md](AGENTS.md#commands).

## Read first

- [AGENTS.md](AGENTS.md) — ground rules, agents and workflow
- [docs/BUSINESS_FACTS.md](docs/BUSINESS_FACTS.md) — the only approved company facts
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — stack, structure, site map, decisions to approve
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — database design
- [docs/ROADMAP.md](docs/ROADMAP.md) — ten phases and their gates
- [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md) — missing business details
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — colours, typography, components
- [docs/TEST_REPORT.md](docs/TEST_REPORT.md) — latest test and Lighthouse results

## Source material

The company profile (`Global_Island_Kitchens_Company_Profile.pdf`) stays in the project folder but is
not committed. Its facts are transcribed, with page references, into `docs/BUSINESS_FACTS.md`.
