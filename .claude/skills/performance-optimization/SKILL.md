---
name: performance-optimization
description: Performance budgets and techniques for the Global Island Kitchens website — Core Web Vitals, images, fonts, JavaScript size, caching. Use when building pages, adding dependencies, or measuring Lighthouse.
---

# Performance optimisation

## Budgets (mobile, measured on a production build)

LCP ≤ 2.5 s · CLS ≤ 0.1 · INP ≤ 200 ms · Lighthouse Performance, Accessibility, Best Practices and
SEO ≥ 90 · first-load JS for public pages kept small (check the build output for each route).

## Techniques

- Server Components and static rendering for public pages; cache content and revalidate by tag when
  staff edit it.
- `next/image` with correct `sizes`, AVIF/WebP, `priority` only on the LCP image; originals resized
  before upload.
- `next/font` with subsets and `display: swap`; preload only the fonts each locale uses.
- Client components small and lazy where below the fold; no heavy libraries on public pages
  (Recharts and PDF code stay in admin-only routes).
- Third-party scripts only after consent and with `next/script` `lazyOnload` where possible.
- Database: indexes for every list filter; avoid N+1 with `include`/`select`.

## Measuring

Run Lighthouse against a production build (`npm run build && npm start`) for each template at mobile
and desktop, in English and Arabic. Record the numbers; never claim scores that weren't measured.
