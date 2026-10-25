# Implementation roadmap

Each phase ends with the same gate:

1. Run the relevant tests (lint, typecheck, unit, DB, E2E as they exist).
2. Verify the working features in a browser (desktop and mobile, English and Arabic).
3. Fix what the checks find.
4. Update the docs (`docs/`, `README.md`, `AGENTS.md`).
5. Summarise completed work and remaining tasks for the owner.
6. Ask for approval before major architectural changes, and before starting the next phase.

| Phase | Scope | Done when |
|---|---|---|
| **1. Plan** ✅ (this commit) | Read the company profile, architecture, data model, agents, skills, roadmap, open questions | Owner approves the decisions in [ARCHITECTURE.md §9](ARCHITECTURE.md#9-decisions-needing-approval) |
| **2. Design system and homepage** | Scaffold Next.js/TypeScript/Tailwind/shadcn, lint/format/CI, design tokens (walnut, beige, ivory, charcoal), typography for English and Arabic, layout shell (header, footer, WhatsApp button), homepage in English and Arabic from verified facts | Homepage passes axe, Lighthouse measured, RTL checked |
| **3. Public pages** | The 22 pages in the site map, responsive, bilingual, with static content from `BUSINESS_FACTS.md` (moved to the database in Phase 4) | Every page reachable, no broken links, no invented content |
| **4. Database, backend, auth** | Prisma schema and migrations, seed, Better Auth, roles and permissions, services layer, storage, outbox, rate limiting, audit log; forms (quote wizard, consultation, contact) saving to the database | DB tests for every constraint; forms work end to end |
| **5. Admin portal and CRM** | `/admin` dashboard with real metrics, leads, customers, follow-ups, communication history, consultations, content management, materials library, media, settings, staff and roles | Permission matrix tests; E2E admin journey |
| **6. Quotations and projects** | Quotation builder, revisions, VAT, BHD totals, branded PDF (English/Arabic), approval, conversion to order and project, project stage tracking, optional pricing rules | Money tests, PDF snapshot tests, E2E quote-to-project journey |
| **7. Designer portal** | Registration, staff approval, project submission, drawing uploads, material selection, quotation requests, status tracking, messages | Access tests: a designer can never see another designer's data |
| **8. AI and automation** | Furniture, lead and content assistants (drafts only), n8n events and example workflows, consent and unsubscribe, WhatsApp Business integration points | AI off by default; approval required; signed webhooks tested |
| **9. Security, testing, SEO, performance** | Security review, full E2E suite, accessibility audit, structured data, sitemap, robots, canonical URLs, analytics consent, image optimisation, Lighthouse 90+ targets measured | Report with measured scores and fixed findings |
| **10. Deployment and handover** | Production hosting, environments, Sentry, backups and a tested restore, CI/CD, technical docs, admin user guide | Production verified against a launch checklist |

## Owner inputs needed by phase

- Before Phase 2: approvals in ARCHITECTURE §9; logo files; permission to use the profile's photographs.
- Before Phase 3: answers to the content questions in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).
- Before Phase 6: VAT registration status and rate, quotation terms and conditions, quotation numbering.
- Before Phase 8: n8n instance, WhatsApp Business account, email provider account.
- Before Phase 10: domain name, hosting accounts, who receives alerts.
