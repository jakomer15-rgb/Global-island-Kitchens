# Implementation roadmap

Each phase ends with the same gate:

1. Run the relevant tests (lint, typecheck, unit, DB, E2E as they exist).
2. Verify the working features in a browser (desktop and mobile, English and Arabic).
3. Fix what the checks find.
4. Update the docs (`docs/`, `README.md`, `AGENTS.md`).
5. Summarise completed work and remaining tasks for the owner.
6. Ask for approval before major architectural changes, and before starting the next phase.

| Phase                                         | Scope                                                                                                                                                                                                                                              | Done when                                                                                          |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **1. Plan** ✅                                | Read the company profile, architecture, data model, agents, skills, roadmap, open questions                                                                                                                                                        | Owner approves the decisions in [ARCHITECTURE.md §9](ARCHITECTURE.md#9-decisions-needing-approval) |
| **2. Design system and homepage** ✅          | Scaffold Next.js/TypeScript/Tailwind/shadcn, lint/format/CI, design tokens (walnut, beige, ivory, charcoal), typography for English and Arabic, layout shell (header, footer, WhatsApp button), homepage in English and Arabic from verified facts | Homepage passes axe, Lighthouse measured, RTL checked                                              |
| **3. Public pages** ✅                        | The 22 pages in the site map, responsive, bilingual, with static content from `BUSINESS_FACTS.md` (moved to the database in Phase 4)                                                                                                               | Every page reachable, no broken links, no invented content                                         |
| **4. Database, backend, auth** ✅             | Prisma schema and migrations, seed, Better Auth, roles and permissions, services layer, storage, outbox, rate limiting, audit log; forms (quote wizard, consultation, contact) saving to the database                                              | DB tests for every constraint; forms work end to end                                               |
| **5. Admin portal and CRM** ✅                | `/admin` dashboard with real metrics, leads, customers, follow-ups, communication history, consultations, content management, materials library, media, settings, staff and roles                                                                  | Permission matrix tests; E2E admin journey                                                         |
| **6. Quotations and projects** ✅             | Quotation builder, revisions, VAT, BHD totals, branded PDF (English/Arabic), approval, conversion to order and project, project stage tracking, optional pricing rules                                                                             | Money tests, PDF snapshot tests, E2E quote-to-project journey                                      |
| **7. Designer portal**                        | Registration, staff approval, project submission, drawing uploads, material selection, quotation requests, status tracking, messages                                                                                                               | Access tests: a designer can never see another designer's data                                     |
| **8. AI and automation**                      | Furniture, lead and content assistants (drafts only), n8n events and example workflows, consent and unsubscribe, WhatsApp Business integration points                                                                                              | AI off by default; approval required; signed webhooks tested                                       |
| **9. Security, testing, SEO, performance** ✅ | Security review, full E2E suite, accessibility audit, structured data, sitemap, robots, canonical URLs, analytics consent, image optimisation, Lighthouse 90+ targets measured                                                                     | Report with measured scores and fixed findings                                                     |
| **10. Deployment and handover**               | Production hosting, environments, Sentry, backups and a tested restore, CI/CD, technical docs, admin user guide                                                                                                                                    | Production verified against a launch checklist                                                     |

Phase 9 (Phases 7 and 8 were deferred at the owner's request and remain to do): independent security
review with all findings fixed or documented, Content-Security-Policy and COOP headers, per-address
limit on confirmation emails, upload bytes moved to a key the signed URL can't reach after checking,
sent quotation PDFs can't be replaced, sign-in lockout no longer lets a stranger lock staff out,
Lighthouse re-measured. Mobile performance is 81-86 (target 90); see TEST_REPORT.

Phase 6: quotations (draft, sent and locked, approved, declined, converted) with revisions, line items
priced by hand, BHD totals in integer fils, optional VAT (off until the owner enters a registration
number and rate), English or Arabic PDF rendered by Chrome and stored, approval recorded by phone or
WhatsApp with a note, conversion to an order and a project, project stages with history, and sales
figures on the dashboard. Not built: automatic price estimates (no rates are known, so none are
invented) and uploading a WhatsApp screenshot as proof of approval (the note is the record).

Phase 5: the admin portal at `/admin`: dashboard (real counts and a 12-week chart), leads (filters,
status, assignment, communication history, follow-ups), customers (edit, consent history),
consultations, notifications; website content (homepage hero, banner, SEO, materials library,
portfolio with photos, testimonials, blog, website images); settings (contact details, addresses,
hours, WhatsApp number); staff, roles and permissions; audit log. Public pages read the settings and
content from the database and fall back to the verified defaults when it can't be reached. The blog,
testimonials and décor library appear on the site only once staff publish real content.

Phase 4: database, staff sign-in with roles, and the quotation, consultation and contact forms saving
to it (with uploads, consent, outbox delivery and audit). A read-only enquiries view at `/admin` lets
staff see submissions until the Phase 5 CRM. Email sending needs the owner's notification addresses
and an email account (OPEN_QUESTIONS #41).

Phase 3: 21 of the 22 brief pages are live in English and Arabic, plus `/bespoke` and 21 project pages;
the blog waits for its first article (Phase 4). Quotation and consultation requests go by pre-filled email
and phone until the Phase 4 forms.

Phase 2 results: [TEST_REPORT.md](TEST_REPORT.md). Mobile Lighthouse performance (English 84–90,
Arabic 70–76) is below target and carried into Phase 9.

## Owner inputs needed by phase

- Before Phase 2: approvals in ARCHITECTURE §9; logo files; permission to use the profile's photographs.
- Before Phase 3: answers to the content questions in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).
- Before Phase 6 (answered in part: VAT off, approval by phone or WhatsApp; the rest is in OPEN_QUESTIONS 48-52): VAT registration, quotation terms.
- Before Phase 8: n8n instance, WhatsApp Business account, email provider account.
- Before Phase 10: domain name, hosting accounts, who receives alerts.
