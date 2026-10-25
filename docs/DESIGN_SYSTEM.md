# Design system

Source of truth for tokens: `src/app/globals.css` (`@theme`). Components: `src/components/ui` (shadcn/ui,
restyled) and `src/components/site`.

## Direction

Luxury European interiors: warm ivory and beige grounds, walnut accents, charcoal type, generous space,
thin rules instead of boxes, editorial (asymmetric 12-column) layouts. No stock imagery: until the
company's photographs are approved, material swatches are CSS illustrations, labelled as such.

## Colour

| Token         | Value           | Use                                                                     |
| ------------- | --------------- | ----------------------------------------------------------------------- |
| `ivory`       | `#faf7f2`       | Page background                                                         |
| `sand`        | `#f1e9dd`       | Alternate section background                                            |
| `sand-deep`   | `#e6d9c6`       | Frames, hero illustration ground                                        |
| `walnut`      | `#6b4429`       | Accent text, icons, eyebrows on light grounds (8:1 on ivory)            |
| `walnut-deep` | `#4a2e1b`       | Dark accent band (designers section)                                    |
| `walnut-soft` | `#c9a27e`       | Accent text on dark grounds (≥ 6.5:1 on charcoal, ≥ 5:1 on walnut-deep) |
| `charcoal`    | `#23201d`       | Text, primary buttons, dark sections, footer                            |
| `ink-muted`   | `#5c544c`       | Secondary text (≥ 6.9:1 on ivory)                                       |
| `line`        | charcoal at 14% | Rules and borders                                                       |

All text combinations pass WCAG 2.1 AA; axe runs on every E2E build.

## Typography

| Role                     | English                               | Arabic                   |
| ------------------------ | ------------------------------------- | ------------------------ |
| Display (`font-display`) | Cormorant Garamond 400, italic accent | Amiri 400                |
| Text (`font-sans`)       | Jost (variable)                       | IBM Plex Sans Arabic 400 |

- Arabic pages swap the `--font-display` / `--font-sans` tokens on `html[lang^="ar"]`, so components
  use the same classes in both languages. Arabic display text gets `line-height: 1.45` and no
  letter-spacing; italics are not used in Arabic.
- The wordmark is always Latin and always uses the Latin fonts.
- Fonts are self-hosted by `next/font` with `display: swap`. Each extra weight costs the Arabic page two
  files, so weights are kept to the minimum (see `src/app/fonts.ts`).
- Fluid sizes: `text-display-2xl` (hero), `-xl`, `-lg` (section titles), `-md` (item titles); `eyebrow`
  utility for small uppercase labels (not uppercase-spaced in Arabic).

## Layout

- `container-site`: max 84 rem, 20 px gutters on mobile, 40 px from 768 px.
- Sections: `py-24 md:py-32`, alternating ivory / sand, with charcoal and walnut-deep bands for rhythm.
- Section headings: numbered eyebrow (`01 —— What we make`), display title, optional intro (max 38 rem).
- RTL: logical utilities only (`ms-`, `pe-`, `start-`, `end-`, `border-e`); directional icons flipped
  with `rtl:` variants.

## Components

| Component          | Notes                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `Button` (shadcn)  | Variants `primary`, `accent`, `outline`, `outlineLight`, `link`; sizes `md`, `lg`, `icon`; min 44 px tall             |
| `SiteHeader`       | Sticky, translucent ivory; anchor navigation while only the homepage exists; phone link; language switch; mobile menu |
| `MobileNav`        | Radix Dialog: full-screen, focus trap, Escape to close                                                                |
| `LanguageSwitcher` | Full page load to the same page in the other language (canonical URLs, correct `lang`/`dir`)                          |
| `WhatsAppButton`   | Hidden until `NEXT_PUBLIC_WHATSAPP_NUMBER` is set                                                                     |
| `Swatch`           | CSS-gradient finish illustrations (no images or SVG filters, cheap to paint)                                          |
| `Reveal`           | CSS scroll-driven fade-up; content is visible without it (no JS, reduced motion, unsupported browsers)                |
| `Wordmark`         | Typographic placeholder until the logo is supplied                                                                    |

## Motion

CSS only so far: link underlines, button colour transitions, scroll-driven reveals (150–700 ms, ease
`cubic-bezier(0.22, 1, 0.36, 1)`). Everything is disabled with `prefers-reduced-motion`. The Motion
library is added when an interactive feature needs it (e.g. quote wizard step transitions, Phase 4).
