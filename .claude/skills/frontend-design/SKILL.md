---
name: frontend-design
description: How to build Global Island Kitchens pages and components with Next.js App Router, Tailwind, shadcn/ui, Motion and next-intl, including RTL. Use when creating or changing any public page, portal screen or shared component.
---

# Frontend design and build

## Structure

- Pages in `src/app/[locale]/...` (public) and `src/app/admin/...` (staff). Sections in
  `src/components/site`, admin pieces in `src/components/admin`, primitives in `src/components/ui`.
- Server Components by default. Client components are small leaves (menus, wizard steps, galleries).
- Data comes from `src/server/services` via the page (server), never from client code.

## Styling

- Design tokens live in the Tailwind theme (`walnut`, `beige`, `ivory`, `charcoal`, plus neutrals).
  Don't hard-code hex values in components.
- Use logical properties (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`) so English
  and Arabic share one stylesheet. Flip directional icons with `rtl:rotate-180`.
- Typography: one display serif and one sans for English, matched Arabic faces; load with `next/font`
  and preload only what each locale uses.
- Spacing scale and max-widths come from the design system doc; no one-off margins.

## Motion

- Motion for reveals and transitions only; durations 150–400 ms; no parallax on mobile.
- Wrap animations so `prefers-reduced-motion` disables them.
- Never animate the LCP element on load.

## Accessibility checklist

Landmarks and one `h1` per page · alt text in both languages · labelled form fields with error text
linked by `aria-describedby` · visible focus ring · keyboard-operable menus and dialogs · colour
contrast AA · `lang` and `dir` set per locale.

## Done means

Lint and typecheck pass, axe reports no serious issues, and the page is checked at 375 px and
1440 px in English and Arabic.
