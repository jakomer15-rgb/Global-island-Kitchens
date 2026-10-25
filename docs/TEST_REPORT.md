# Test report

## Phase 4 — database, backend, authentication, forms (2026-10-25)

Environment: as before, plus local PostgreSQL 17 (embedded, port 5434); integration and E2E tests run
against `gik_test` only.

### Automated checks

| Check                           | Result                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint, typecheck, format, build  | Pass (the build needs no database)                                                                                                                                                                                                                                                                                                                                                                                                |
| Migration                       | Applies cleanly to an empty database; no drift between schema and database                                                                                                                                                                                                                                                                                                                                                        |
| `npm test` (unit)               | 56 / 56: phone normalisation (incl. Arabic digits), quotation/consultation/contact schemas (every problem reported at once), spam traps, file signatures, upload policy, storage tokens, storage choice, role permissions, outbox delivery (not configured; partial failure kept so retries don't resend), EN/AR placeholder parity                                                                                               |
| `npm run test:db` (integration) | 16 / 16: customer/lead/file/consent constraints, append-only audit log, unique references, full quotation submission in one transaction (customer, lead, request, verified file, consent, outbox, audit), upload rejection (wrong ticket, not uploaded, wrong type, reused), customer reuse without overwriting, consultations, contact, outbox retry/backoff, rate limits, upload clean-up, staff accounts and permission denial |
| `npm run test:e2e` (Playwright) | E2E_RESULT                                                                                                                                                                                                                                                                                                                                                                                                                        |

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
