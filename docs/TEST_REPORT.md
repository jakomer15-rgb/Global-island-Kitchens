# Test report

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
