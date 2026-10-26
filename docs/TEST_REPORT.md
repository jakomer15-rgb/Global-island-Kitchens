# Test report

## Phase 8 — AI and automation (2026-10-26)

| Check                  | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lint, typecheck, build | Pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `npm test` (unit)      | 80 / 80 (7 new): contact details removed before text reaches the provider; unusable answers refused; provider availability; webhook signatures verify, reject tampering and replays, and match what the sender sends                                                                                                                                                                                                                                                                                                                                   |
| `npm run test:db`      | 50 / 50 (10 new): assistants off until switched on; the prompt holds no phone, email or surname; edited drafts become internal notes and nothing is sent; reviewed drafts can't be changed or deleted; roles enforced; blog drafts stay unpublished; public assistant off by default, visitor words treated as data, unknown product lines refused, rate limited; consent snapshot and unsubscribe links (tampering refused, repeat safe); lead-status events carry no contact details; WhatsApp messages logged once, new customers and leads created |
| `npm run test:e2e`     | 200 pass, 58 skipped by design, 0 fail. New: WhatsApp webhook (Meta check, unsigned and wrongly signed bodies refused, signed message logged once and shown on the lead); unsubscribe link in the browser; with no provider key there is no public assistant, no staff AI panel and a clear explanation                                                                                                                                                                                                                                                |
| AI screens (opt-in)    | `e2e/ai-ui.spec.ts` passes against a production server with the test provider (see the file header): blog draft reviewed and approved into an unpublished post; lead reply edited and approved as a note; public assistant answers in plain text with a link to a product page; switching AI off returns the public page to 404                                                                                                                                                                                                                        |

**Not tested:** a call to the real Anthropic API (no key in this environment). The request format follows Anthropic's Messages API; test it with a real key and the owner's approval before relying on it. The n8n example workflows were validated as JSON only and not imported into n8n. The WhatsApp webhook was tested with signed requests we generated, not with Meta.

### Security review (Phase 8 changes, self-review)

| Entry point                | Protection                                                                                                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AI drafts                  | Off by default (server key and owner switch both needed); permissions `ai.use` / `ai.review` plus the target's own permission (`lead.update`, `content.manage`); 30 drafts an hour per person; output validated against a schema; drafts are read-only once reviewed (trigger) |
| What the provider sees     | No phone, email or surname; instructions and notes are redacted too; hard rules forbid prices, dates, warranties and outside materials; provider errors and bodies are never shown or logged                                                                                   |
| Public furniture assistant | 404 unless on; visitor text wrapped as data; 600 characters; 5 an hour per visitor and 200 a day site-wide; answer limited to our own product lines and shown as text; the question is not stored                                                                              |
| WhatsApp webhook           | Meta's verify token (constant time) and `X-Hub-Signature-256` on the raw body; 1 MB limit; duplicate message ids ignored; never replies                                                                                                                                        |
| Unsubscribe                | Signed link per customer and channel; the page confirms before acting (link scanners can't unsubscribe anyone); rate limited                                                                                                                                                   |
| n8n events                 | Signed with a timestamp; only `enquiry.received` carries contact details; consent snapshot and unsubscribe link included                                                                                                                                                       |

Test-only switches: `AI_PROVIDER=mock` is refused in production unless `AI_MOCK_FOR_E2E=1` is also set (documented as never to be used in a deployment).

## Phase 7 — designer portal (2026-10-26)

| Check                  | Result                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lint, typecheck, build | Pass                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `npm test` (unit)      | 73 / 73                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `npm run test:db`      | 40 / 40 (6 new): pending designers can't use the portal; a repeated email gives the same answer and no second account; a submitted project becomes a lead and request and one designer can never see, list or message another's project; staff replies are seen, internal notes are not; permissions and reasons for decisions, suspension ends sessions; designers hold no staff roles and a decision must record who made it |
| `npm run test:e2e`     | 197 pass, 53 skipped by design, 0 fail                                                                                                                                                                                                                                                                                                                                                                                         |

New E2E (`e2e/designers.spec.ts`): registration in English with axe; pending state; designer session refused by the admin and by the staff sign-in form; staff approval; project with a drawing upload; the file downloads for its owner and returns 401 without a session; the project appears as a designer-portal lead; messages both ways with an internal note hidden from the designer; progress follows the lead status; suspension ends access at once; Arabic pages are right to left and accessible; portal pages are noindex and in robots.txt.

Visual check: new-project and project pages reviewed on desktop. The Arabic portal pages and a phone layout were checked by test (direction, axe) but not reviewed by eye.

### Security review (Phase 7 changes, self-review; the independent review ran before this phase)

| Entry point                | Protection                                                                                                                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Designer actions and pages | Session read on every request, state re-read from the database; every service asserts the designer is approved and filters by the designer's own id; other people's projects answer "not found" |
| Files                      | Download only for the project's own designer through a 60-second signed link; uploads use the existing ticket, size, signature and move-after-check steps                                       |
| Registration and sign-in   | Honeypot, timing, IP limit, 3 emails a day per address; sign-in limits as for staff (per email and IP, plus a ceiling); failed attempts audited with a hash only                                |
| Session separation         | Designers hold no roles (trigger); admin ignores designer sessions; the staff sign-in form signs a designer out and answers as for a wrong password                                             |
| Staff side                 | New permissions `designer.read` / `designer.manage`; decisions audited; rejecting or suspending needs a reason and deletes sessions                                                             |

Found and fixed while testing: the unread dot on the notifications page had an `aria-label` without a role, which axe can flag whenever an unread notification exists (this made the "every admin page" test fail intermittently; now `role="img"`); the sales-manager E2E test needed a longer timeout when the whole suite runs in parallel.

Not covered: an independent review of the designer code, Arabic text review, real devices, password reset for designers.

## Phase 9 — security, SEO, performance (2026-10-26)

| Check                  | Result                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| Lint, typecheck, build | Pass                                                                                                  |
| `npm test` (unit)      | 73 / 73 (new: local storage move never overwrites)                                                    |
| `npm run test:db`      | 34 / 34                                                                                               |
| `npm run test:e2e`     | 194 pass, 50 skipped by design, 0 fail (includes uploads through the new move step, axe on all pages) |

### Security review (independent read-only review of the whole repository)

No critical or high findings. Two medium and five low, all addressed except where noted.

| Finding                                                                                   | Result                                                                                                  |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| M1 Confirmation emails could be sent to any typed address, with free text in the greeting | Fixed: generic greeting, limit of 3 confirmations a day per address. CAPTCHA left as a decision (OQ 54) |
| M2 Upload overwritable through its signed URL after the content check (S3/R2)             | Fixed: checked bytes are moved to a key no signed URL can write to (not tested against a real bucket)   |
| L1 Rate limits trust the first `x-forwarded-for` entry                                    | Documented as a hosting requirement (DEPLOYMENT.md); checked at launch                                  |
| L2 Re-storing a PDF replaced the one already sent                                         | Fixed: an existing stored PDF is kept                                                                   |
| L3 Failed sign-in audit rows kept the typed email                                         | Fixed: keyed hash only                                                                                  |
| L4 Anyone could lock a staff account out for 15 minutes                                   | Fixed: failure lockout is per email and IP; a high ceiling (30) across all addresses                    |
| L5 Unlimited PDF preview rendering                                                        | Fixed: 20 per person per 15 minutes                                                                     |

Also added: Content-Security-Policy (same origin and the storage bucket only), Cross-Origin-Opener-Policy,
`/documents` in robots.txt. Not done: staff uploads (`finishMediaUpload`) still use the old key without
the move step (staff-only, lower risk); a lead's customer record is visible to anyone with `lead.read`
(review whether roles should separate it).

### SEO

Sitemap with English/Arabic alternates, robots (admin, API and documents blocked), canonical and hreflang,
and structured data were already tested by `e2e/pages.spec.ts`; they still pass. No analytics is installed.

### Lighthouse (production build on localhost, simulated mobile and desktop)

| Page          | Mobile perf | LCP   | TBT    | Desktop perf | Accessibility / best practices / SEO |
| ------------- | ----------- | ----- | ------ | ------------ | ------------------------------------ |
| `/`           | 84          | 3.0 s | 430 ms | 100          | 96 / 100 / 100                       |
| `/ar`         | 85          | 3.3 s | 330 ms | 100          | 96 / 100 / 100                       |
| `/contact`    | 86          | 2.3 s | 470 ms | 100          | 100 / 96 / 100                       |
| `/ar/contact` | 81          | 2.2 s | 710 ms | 100          | 100 / 96 / 100                       |

Arabic mobile improved from 70-76 (Phase 2) to 81-85. The 90 target on mobile is not met: the remaining
cost is the Next.js runtime and the page data sent with the HTML (about 125 KB of it on the home page).
Measure again on the production host (OQ 57). Scores vary a few points between runs.

## Phase 6 — quotations and projects (2026-10-26)

Environment: as in Phase 5, plus headless Chrome (installed) for PDFs.

| Check                  | Result                                                                                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint, typecheck, build | Pass                                                                                                                                                                         |
| `npm test` (unit)      | 72 / 72. New: money (fils parsing, rounding, VAT on subtotal minus discount), document tokens (expiry, tampering, wrong quotation), permission matrix                        |
| `npm run test:db`      | 34 / 34 (5 new): full quotation flow; VAT on/off and revisions; bad drafts and roles refused; database arithmetic and locked revisions/lines immutable; projects and orders  |
| `npm run test:e2e`     | 194 pass, 50 skipped by design, 0 fail. New: draft to sent with stored Arabic PDF, approval by WhatsApp, conversion to order and project, stage change, axe on all new pages |

Visual check: the Arabic and English PDFs and the quotation editor were reviewed (phone/email direction and total-row border fixed).
One earlier E2E sign-in failure was traced to the local database not running, not to rate limiting.

### Security review (Phase 6 changes)

| Entry point                  | Protection                                                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Quotation pages and actions  | `requireActor(permission)` plus `assertCan` in each service; approval needs `quotation.approve`; every change audited  |
| `/documents/quotations/<id>` | 404 without a valid 2-minute HMAC token bound to the quotation and revision; no staff cookie is ever given to Chrome   |
| Staff PDF route              | Staff only; stored PDF served through a 60-second signed URL; draft preview rendered on demand; each access audited    |
| Locked data                  | Database triggers block edits to sent revisions and lines and to stage history, so the rules hold even outside the app |
| Storage                      | PDFs are private files; the abandoned-upload sweep keeps them                                                          |

Not covered: serverless PDF hosting (needs the owner's Chrome, Phase 10), fluent Arabic review of the document wording.

## Phase 5 — admin portal and CRM (2026-10-26)

Environment: as in Phase 4 (production build, installed Chrome, `gik_test` database).

### Automated checks

| Check                           | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint, typecheck, build          | Pass. The build also passes with the database unreachable (pages fall back to the verified defaults and the built-in project list, with a logged warning)                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Migration and seed              | `20261026090000_admin_content` applies cleanly; the seed is idempotent (second run: 0 new projects) and keeps role changes made in the admin                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `npm test` (unit)               | 64 / 64. New: permission matrix (each role sees only its admin pages; only the owner manages staff; first page after sign-in), setting permissions, image kinds per editor, setting defaults valid, invalid stored settings fall back, banner needs both languages, phone/SEO limits                                                                                                                                                                                                                                                                                               |
| `npm run test:db` (integration) | 29 / 29 (13 new): lead pipeline (lost needs a reason, first contact moves to "contacted", assignment notifies, follow-ups, history, audit, search, dashboard), CRM denied to other roles, customer edits without duplicates and consent history, consultation transitions, staff create/roles/disable (sessions removed)/password reset, last-owner and self guards, role permission edits, settings audit, publish rules for décors, testimonials, blog, images and portfolio (service and CHECK constraint), image sweep keeps published images, fake image rejected             |
| `npm run test:e2e` (Playwright) | 193 pass, 49 skipped by design, 0 fail. New (`e2e/admin.spec.ts`): all 16 admin pages open for the owner with no serious axe issues; a new sales manager is created, signs in, sees only the CRM and is refused staff/settings; banner saved in the admin appears on the English and Arabic site (and a refused save keeps what was typed); an EGGER décor is refused until checked, then shown on `/materials`; a draft post is 404 until published in both languages; a lead note is added; admin menu on a phone. The forms tests now find submissions through the leads search |

Visual check: screenshots of the dashboard, leads, staff, settings, content and new-material screens
(desktop) and the dashboard and leads (mobile) reviewed. Lead references wrapped onto two lines in the
leads table (fixed). Lighthouse was not re-run: public pages render the same markup, plus the banner,
testimonials, blog and décor sections only when staff publish them.

### Security review (Phase 5 changes)

| Entry point                                   | Protection                                                                                                                                                                                     |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin pages and server actions (≈35)          | `requireActor(permission)` on every page and action, and `assertCan` again in every service; ids validated; bound arguments treated as untrusted (setting keys checked with `Object.hasOwn`)   |
| Staff management                              | Owner-only by default; no self role change or self disable; only an owner grants/removes the owner role; one active owner always kept; disabling deletes sessions; every change audited        |
| Website images (`/media/[id]`, upload action) | Staff only, per image kind; JPEG/PNG/WebP up to 8 MB; ticket, size and file signature checked; credit required (CHECK); only public, verified, non-customer files served; customer files never |
| Public content from the database              | Rendered as text (blog bodies parsed into paragraphs, headings, lists; no HTML); JSON-LD escaped; swatch colours validated by regex and CHECK; notification links limited to `/admin/`         |

Found and fixed: the dashboard chart was focusable inside an `aria-hidden` wrapper (axe); admin tables had
no accessible name (caption added); React's form action reset fields after a refused save (forms now keep
input); abandoned-upload clean-up would have deleted published website images; inherited names were
accepted as setting keys.

Not covered: real devices, Safari/Firefox, fluent Arabic review of the new public copy (`src/content/cms.ts`).

## Phase 4 — database, backend, authentication, forms (2026-10-25)

Environment: as before, plus local PostgreSQL 17 (embedded, port 5434); integration and E2E tests run
against `gik_test` only.

### Automated checks

| Check                           | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint, typecheck, format, build  | Pass (the build needs no database)                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Migration                       | Applies cleanly to an empty database; no drift between schema and database                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `npm test` (unit)               | 56 / 56: phone normalisation (incl. Arabic digits), quotation/consultation/contact schemas (every problem reported at once), spam traps, file signatures, upload policy, storage tokens, storage choice, role permissions, outbox delivery (not configured; partial failure kept so retries don't resend), EN/AR placeholder parity                                                                                                                                                                        |
| `npm run test:db` (integration) | 16 / 16: customer/lead/file/consent constraints, append-only audit log, unique references, full quotation submission in one transaction (customer, lead, request, verified file, consent, outbox, audit), upload rejection (wrong ticket, not uploaded, wrong type, reused), customer reuse without overwriting, consultations, contact, outbox retry/backoff, rate limits, upload clean-up, staff accounts and permission denial                                                                          |
| `npm run test:e2e` (Playwright) | 187 pass, 43 skipped by design. New: contact, consultation and six-step quotation (with a real upload) submitted in the browser, checked in the admin, uploaded file downloaded and compared byte for byte; signed-out download refused; Arabic validation messages; axe on the form pages; cross-site upload refused; generic sign-in error for unknown emails; cron needs its secret. One later run timed out on the three-page axe test under parallel load; it passes alone and its timeout was raised |

### Lighthouse on the form pages (localhost production build)

| Page                      | Mobile perf | Mobile CLS | Desktop (all four) | Accessibility / best practices / SEO |
| ------------------------- | ----------- | ---------- | ------------------ | ------------------------------------ |
| `/request-a-quote`        | 82          | 0          | 100                | 100 / 100 / 100                      |
| `/ar/request-a-quote`     | 70–83       | 0.017      | 100                | 100 / 100 / 100                      |
| `/contact`                | 84          | 0          | 100                | 100 / 100 / 100                      |
| `/ar/contact`             | 88          | 0.001      | 100                | 100 / 100 / 100                      |
| `/ar/book-a-consultation` | 72          | 0          | 100                | 100 / 100 / 100                      |

Found and fixed: the quotation wizard was rendered inside a Suspense boundary (to read `?category=`),
so the static page shipped without the form and it popped in on load (mobile CLS 0.246). The category
is now read after mount and the form renders statically (CLS 0). One Lighthouse run reported a 0.665
shift on the Arabic desktop page that didn't reproduce: a re-run measured 0.001, and Chrome's own
layout-shift entries at the same size total 0.001.

### Security review (Phase 4 changes)

Each entry point was checked for authentication, authorisation, ownership, validation, rate limits,
CSRF and data exposure.

| Entry point                        | Protection                                                                                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Form server actions (3)            | Same Zod schema as the browser; per-IP limit 5/hour per form; honeypot + timing trap; Next.js origin check; one transaction                                      |
| `POST /api/uploads`                | Same-origin check; per-IP limit 30/hour; type allow-list and 15 MB limit; returns a one-time ticket (stored hashed)                                              |
| `/api/files/local` (dev/test only) | Disabled in production unless explicitly overridden for E2E; HMAC-signed, expiring, single-key tokens; exclusive writes; downloads as attachments with `nosniff` |
| Attaching uploads                  | Ticket, age (2 h), size and file signature verified server-side; atomic attach; rejected files deleted                                                           |
| Staff sign-in                      | Generic error for wrong password and unknown email; per-IP limit (all attempts) and per-email limit (failed attempts only); audited                              |
| `/admin`, `/admin/files/[id]`      | Session + permission checked on the server for every request (proxy check is convenience only); downloads audited, 60-second signed URLs                         |
| `/api/cron/outbox`                 | Bearer secret compared in constant time                                                                                                                          |

Findings fixed during the phase: whole-form rules ran only after other fields were valid (UX); a
successful sign-in counted towards the per-email lockout; rich-text placeholders rendered empty (privacy
link and reference number missing); abandoned uploads were never cleaned up; outbox retries could resend
emails already delivered; the privacy policy still said the site had no forms (rewritten).

Known limits: rate limits trust `x-forwarded-for`, which is safe on Vercel (set by the platform) but
must be overwritten by any other proxy (docs/DEPLOYMENT.md). Content-Security-Policy is planned for
Phase 9. Emails are not sent until the owner provides notification addresses and an email account.

## Phase 3 — public pages (2026-10-25)

Same environment as Phase 2.

### Automated checks

| Check                           | Result                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint, typecheck, format         | Pass                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npm test` (Vitest)             | 21 / 21. New: every content entry has English and Arabic (matching list lengths); materials rule over all copy; no EGGER partnership wording; no client/developer/contractor names from the profile; meta title/description lengths; projects linked to products only by stated scope                                                                                                                                                        |
| `npm run build`                 | Pass; 89 static pages (22 page types × 2 languages + 21 project pages × 2)                                                                                                                                                                                                                                                                                                                                                                   |
| `npm run test:e2e` (Playwright) | 174 pass, 40 skipped by design (desktop-only/mobile-only tests; mobile axe runs on a sample). Every page in both languages: status 200, one `h1`, branded title, canonical, `dir`; titles unique; crawl of every internal link returns 200; axe WCAG 2.1 AA on every page (desktop) and a sample (mobile); products menu by keyboard; mobile menu; FAQ; pre-filled quotation email; project pages `noindex`; unknown project and `/blog` 404 |

### Lighthouse (localhost production build, final run)

| Page                              | Mobile perf | Mobile a11y | Mobile SEO | Desktop (all four) | Mobile LCP |
| --------------------------------- | ----------- | ----------- | ---------- | ------------------ | ---------- |
| `/`                               | 84          | 96\*        | 100        | 100                | 2.9 s      |
| `/ar`                             | 74          | 96\*        | 100        | 100                | 4.0 s      |
| `/wardrobes`                      | 93          | 96\*        | 100        | 100                | 2.1 s      |
| `/ar/kitchens/wooden`             | 70          | 100         | 100        | 100                | 3.9 s      |
| `/projects`                       | 89          | 100         | 100        | 100                | 2.9 s      |
| `/projects/capri-suites-janabiya` | 87          | 100         | 66†        | 100 (SEO 66†)      | 1.9 s      |
| `/contact`                        | 87          | 100         | 100        | 100                | 2.9 s      |
| `/faq`                            | 94          | 100         | 100        | 100                | 1.9 s      |
| `/about`                          | 93          | 100         | 100        | 100                | 1.9 s      |
| `/request-a-quote`                | 95          | 100         | 100        | 100                | 1.8 s      |

Best practices: 100 everywhere.

\* **Measurement artifact, not a contrast problem.** Off-screen sections use `content-visibility: auto`;
Lighthouse's axe measures them before the browser renders them and reads the wrong background (for
example, the walnut "Selected work" eyebrow reported on charcoal, the colour of the section above it;
on the page it sits on ivory at 8:1). Our E2E axe sweep renders every section first and reports no
issues. `content-visibility` is kept because it raised mobile performance (homepage median of 3: 79 → 88).

† Intentional: project pages are `noindex` until photographs are approved.

Mobile performance is still below 90 on Arabic pages (Amiri font) and on the homepage; carried into Phase 9.

### Issues found and fixed during the phase

| Found by       | Issue                                                                                                       | Fix                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| axe (E2E)      | Contact details list (`dl`) had icons and wrappers between `dt`/`dd` pairs (screen readers can't pair them) | Icon moved inside `dt`; `dl > div > dt + dd`                                  |
| Lighthouse     | Radix NavigationMenu and Dialog added JS to every page (mobile TBT 350 → 630 ms)                            | Products menu as a WAI disclosure; mobile menu on native `<dialog>`           |
| Lighthouse     | Style/layout of the whole long page on load                                                                 | `content-visibility: auto` on sections after the first                        |
| Content review | Projects with "complete joinery" were being shown as examples on every product page                         | Projects link to products only by explicitly stated scope; none for aluminium |
| Content review | A few product bullets went beyond the profile                                                               | Removed                                                                       |
| Lighthouse     | Missing approved page: "More we make" (`/bespoke`, ARCHITECTURE §9 decision 5)                              | Built and linked from the products menu, footer and homepage                  |

### Not covered yet

Real devices; Safari and Firefox; fluent Arabic review; legal review of the privacy policy and terms.

## Phase 2 — design system and homepage (2026-10-25)

Environment: Windows 10, Node 24.22.1, production build (`next build` + `next start`), Google Chrome
(installed) for Playwright and Lighthouse.

### Automated checks

| Check                           | Result                                                                                                                                                                                                                                                                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                  | Pass, 0 warnings                                                                                                                                                                                                                                                                                                             |
| `npm run typecheck`             | Pass                                                                                                                                                                                                                                                                                                                         |
| `npm run format:check`          | Pass                                                                                                                                                                                                                                                                                                                         |
| `npm test` (Vitest)             | 14 / 14 pass: message parity EN/AR, content rules (no solid wood/timber/veneer/lacquer, no EGGER partnership wording), phone and WhatsApp links, route registry, canonical/hreflang, structured data                                                                                                                         |
| `npm run build`                 | Pass; `/` and `/ar` statically prerendered                                                                                                                                                                                                                                                                                   |
| `npm run test:e2e` (Playwright) | 25 pass, 1 skipped (mobile-only test on desktop). Desktop and mobile × English and Arabic: language and direction, one `h1`, axe WCAG 2.1 AA (no serious/critical issues), every internal link returns 200, real contact links, language switcher, 404s, `/en` → `/` redirect, mobile menu, WhatsApp hidden until configured |

### Lighthouse (measured, localhost production build)

Final run:

| Page  | Form factor | Performance | Accessibility | Best practices | SEO | LCP   | CLS   | TBT    |
| ----- | ----------- | ----------- | ------------- | -------------- | --- | ----- | ----- | ------ |
| `/`   | Mobile      | 85          | 100           | 100            | 100 | 3.1 s | 0     | 350 ms |
| `/ar` | Mobile      | 75          | 100           | 100            | 100 | 3.8 s | 0.002 | 420 ms |
| `/`   | Desktop     | 100         | 100           | 100            | 100 | 0.7 s | 0     | 40 ms  |
| `/ar` | Desktop     | 100         | 100           | 100            | 100 | 0.4 s | 0.001 | 40 ms  |

Mobile performance varies between runs: English measured 84–90 across today's runs (median of 3: 89),
Arabic 70–76. **Mobile performance is below the 90 target, Arabic in particular**; it is carried into
Phase 9 (below).

### Issues found and fixed during the phase

| Found by                    | Issue                                                                                                           | Fix                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| axe (E2E)                   | Light walnut accent text on dark sections failed AA contrast                                                    | `walnut-soft` lightened to `#c9a27e`                                                   |
| E2E                         | Switching Arabic → English went to `/en` (duplicate URL)                                                        | Switcher builds the canonical URL with `getPathname`                                   |
| Full-page screenshot        | Sections with JS reveal animations were invisible until scrolled (and with reduced motion)                      | CSS scroll-driven reveal; content always visible without it; Motion dependency removed |
| Browser check               | SVG noise filters made sections slow to paint                                                                   | Swatches redrawn with CSS gradients                                                    |
| Screenshot + computed style | Arabic headings rendered in a Latin font (Tailwind's generated `font-display` utility overrode the Arabic rule) | Font tokens swap on `html[lang^="ar"]`                                                 |
| Visual check                | Arabic display marks touched the line above                                                                     | Arabic display line-height 1.45                                                        |
| Lighthouse                  | Render-blocking stylesheet dominated mobile FCP/LCP                                                             | `experimental.inlineCss` (HTML 32 KB gzip, was 18 KB + 9 KB CSS)                       |
| Lighthouse                  | 8 font files on Arabic pages; unused weights                                                                    | Removed Cormorant 500, Amiri 700, Plex Arabic 500 (Arabic page: 6 files)               |
| Lighthouse                  | Full translation files sent to the browser; in-page links prefetching the page                                  | Client gets the `Common` strings only; anchors don't prefetch                          |
| Lighthouse                  | Missing favicon (console 404)                                                                                   | Interim SVG icon                                                                       |

### Carried into Phase 9 (performance)

- Arabic LCP waits for Amiri's 109 KB Arabic file: subset Amiri to the glyphs used, or choose a lighter
  Arabic display face (design decision for the owner).
- The Latin wordmark costs two font files on Arabic pages: replace with the SVG logo once supplied.
- Main-thread style/layout ~1 s on the throttled profile: profile once all pages exist.
- Re-measure on the production host (real CDN, HTTP/2, compression) rather than localhost.

### Not covered yet

Real devices (only emulated Chrome mobile), Safari and Firefox (CI runs Chromium only), a fluent Arabic
review of the copy.
