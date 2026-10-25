---
name: seo-optimization
description: Technical and local Bahrain SEO for the Global Island Kitchens website — metadata, hreflang, structured data, sitemap, robots, analytics consent. Use when adding or changing public pages, or preparing for launch.
---

# SEO optimisation

## Every public page

- `generateMetadata` with a unique title (≤ 60 characters incl. brand) and description (≤ 160).
- Canonical URL; `alternates.languages` for `en` and `ar` plus `x-default`.
- Open Graph title, description and an image the company owns.
- One `h1`; headings in order; descriptive link text.

## Structured data (JSON-LD)

- Site-wide: `Organization` with name, logo, phone, email, Instagram.
- Showroom and head office: `FurnitureStore` / `LocalBusiness` with the exact addresses from
  `docs/BUSINESS_FACTS.md`, phone, opening hours (once days are confirmed) and geo (once pins exist).
- `BreadcrumbList` on inner pages; `FAQPage` on the FAQ page.
- No `Review` or `AggregateRating` without real, consented reviews.

## Local search themes (Bahrain)

Custom kitchens, aluminium kitchens, fitted and sliding wardrobes, walk-in closets, TV units, wall
cladding, bathroom vanities, bedroom furniture, joinery manufacturer for contractors and developers;
place names as the company writes them: Hamad Town, Al-Hamalah. Arabic pages target Arabic phrasing.

## Site files

`app/sitemap.ts` lists published pages in both languages (drafts and the empty blog excluded);
`app/robots.ts` blocks `/admin`, `/api` and portal pages.

## Analytics

GA4 and other trackers load only after cookie consent; Search Console verification via an
environment variable.

## Verify

Run the structured-data check and Lighthouse SEO audit; record the numbers in the test report.
