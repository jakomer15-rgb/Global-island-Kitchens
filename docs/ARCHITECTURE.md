# Technical architecture

Status: **Approved by the owner on 2026-10-25** (all six decisions in §9). Items marked **(approve)**
below were part of that approval.

## 1. Goals and constraints

- A bilingual (English / Arabic, full RTL) marketing website plus a business platform: CRM, quotations,
  projects, designer portal and content management, all on real PostgreSQL persistence.
- Company content comes only from [BUSINESS_FACTS.md](BUSINESS_FACTS.md). Unknown information is shown as
  a missing item in the admin, never invented on the public site.
- No prices are calculated unless staff configure real pricing rules.
- Every phase ends with tests, verification and updated docs ([ROADMAP.md](ROADMAP.md)).

## 2. Stack

Exact versions are pinned when the project is scaffolded in Phase 2 (current stable releases at that
date, checked against each project's release notes).

| Concern               | Choice                                                                               | Notes                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework             | Next.js (App Router), React, TypeScript `strict`                                     | Server Components by default; Server Actions for forms                                                                                                                                     |
| Styling               | Tailwind CSS, shadcn/ui (Radix primitives)                                           | Components copied into the repo and restyled to the brand                                                                                                                                  |
| Motion                | Motion (formerly Framer Motion)                                                      | Respects `prefers-reduced-motion`. Public-page reveals are CSS scroll-driven (no JS); the library is installed when an interactive feature needs it (Phase 4 wizard)                       |
| Forms                 | React Hook Form + Zod                                                                | One Zod schema per form, shared by client and server                                                                                                                                       |
| Database              | PostgreSQL, Prisma ORM                                                               | Migrations committed; DB constraints back business rules                                                                                                                                   |
| Auth **(approve)**    | Better Auth                                                                          | Auth.js is now maintained by the Better Auth team, which recommends Better Auth for new projects. Email + password for staff and designers, optional TOTP 2FA for staff, database sessions |
| Files                 | S3-compatible storage (Cloudflare R2 recommended)                                    | Private bucket, presigned uploads, server-checked type and size                                                                                                                            |
| Email                 | Transactional provider (Resend recommended) via an outbox table                      | Sends only when configured                                                                                                                                                                 |
| Charts                | Recharts                                                                             | Admin dashboard only                                                                                                                                                                       |
| i18n                  | next-intl                                                                            | `/` English, `/ar` Arabic; `dir="rtl"` and Arabic typography                                                                                                                               |
| AI **(approve)**      | Anthropic Claude API, server-side only                                               | Optional; off until a key is set; every output is a draft needing human approval                                                                                                           |
| Automation            | n8n via signed webhooks                                                              | Outbound events + inbound authenticated endpoints                                                                                                                                          |
| Testing               | Vitest (unit + DB integration), Playwright (E2E), axe (accessibility), Lighthouse CI |                                                                                                                                                                                            |
| Monitoring            | Sentry (errors, performance)                                                         | Enabled by DSN; PII scrubbed                                                                                                                                                               |
| Hosting **(approve)** | Vercel + managed Postgres (Neon)                                                     | Region close to Bahrain where available; see DEPLOYMENT in Phase 10                                                                                                                        |

## 3. Application structure

One Next.js application with clearly separated layers. Separate deployable services are not needed at
this scale and would add cost and failure points.

```
src/
  app/
    [locale]/                 public website (en, ar)
      (marketing)/            home, about, product pages, materials, projects, blog, faq, legal
      (forms)/                request-a-quote, book-a-consultation, contact
      designers/              designer portal (sign-in, register, dashboard, projects)
    admin/                    staff portal (English UI), protected
    api/                      route handlers: uploads, webhooks (n8n), cron, health
  components/
    ui/                       shadcn/ui primitives, restyled
    site/                     public website sections
    admin/                    admin building blocks (tables, filters, forms, charts)
  features/                   one folder per business area: UI-facing actions + components
    leads/  quotations/  projects/  consultations/  designers/  content/  materials/  ai/
  server/                     server-only code (import "server-only")
    db/                       Prisma client, transactions
    auth/                     session, roles, permission checks
    services/                 business logic per area, called by actions and route handlers
    storage/  email/  outbox/  audit/  ai/  automation/
  lib/                        shared pure helpers (formatting, BHD money, validation schemas)
  i18n/  messages/            next-intl config and UI strings (en.json, ar.json)
prisma/
  schema.prisma  migrations/  seed/
e2e/                          Playwright tests
docs/                         architecture, data model, roadmap, guides
```

Layer rules (enforced by ESLint import rules in Phase 2):

- `components/*` never import from `server/*`.
- Only `server/services/*` talks to Prisma. Actions and route handlers call services.
- Every service function takes the acting user and checks permission first.

## 4. Site map

Public pages, each in English and Arabic (`/ar/...`). The brief's 22 required pages, mapped to the
product lines in the company profile:

| #   | Page                            | URL                     | Profile products it covers                            |
| --- | ------------------------------- | ----------------------- | ----------------------------------------------------- |
| 1   | Home                            | `/`                     | —                                                     |
| 2   | About us                        | `/about`                | Company story, team structure, factory and machinery  |
| 3   | Customised wooden kitchens      | `/kitchens/wooden`      | Modern kitchens (EGGER boards and painted MDF)        |
| 4   | Aluminium kitchens              | `/kitchens/aluminium`   | Aluminum kitchens                                     |
| 5   | Wardrobes                       | `/wardrobes`            | Hinged and sliding door wardrobes, glass-door closets |
| 6   | Walk-in closets                 | `/walk-in-closets`      | Walk-in closets                                       |
| 7   | Bedroom furniture               | `/bedroom-furniture`    | Bed sets, dressing tables, Murphy beds                |
| 8   | TV units                        | `/tv-units`             | TV units / feature walls                              |
| 9   | Wall cladding                   | `/wall-cladding`        | Wall cladding, living area cladding                   |
| 10  | Bathroom vanities               | `/bathroom-vanities`    | Vanities                                              |
| 11  | Materials and finishes          | `/materials`            | EGGER laminate/melamine and painted MDF gallery       |
| 12  | Our projects                    | `/projects`             | Portfolio from the profile (once approved)            |
| 13  | Project detail                  | `/projects/[slug]`      | —                                                     |
| 14  | Interior designer collaboration | `/designers`            | Trade/designer programme + portal entry               |
| 15  | Request a quotation             | `/request-a-quote`      | Six-step wizard                                       |
| 16  | Book a consultation             | `/book-a-consultation`  | Showroom, site or online consultation                 |
| 17  | Our showroom                    | `/showroom`             | Al-Hamalah showroom                                   |
| 18  | Blog                            | `/blog`, `/blog/[slug]` | Hidden until a post is published                      |
| 19  | FAQs                            | `/faq`                  | —                                                     |
| 20  | Contact us                      | `/contact`              | —                                                     |
| 21  | Privacy policy                  | `/privacy-policy`       | —                                                     |
| 22  | Terms and conditions            | `/terms`                | —                                                     |
| 23  | Product category (admin-added)  | `/products/[slug]`      | Categories staff add in Manage categories             |

Profile products without a page of their own in the brief (laundry rooms, laminate doors, ceiling
umbrellas, custom cabinets, bespoke furniture) go on a **"More we make"** page (`/bespoke`, built in Phase 3) if the owner
agrees **(approve)**.

Since 2026-11-02 the product lines are database categories (Manage categories in the admin): the
menu, footer and homepage tiles list them in the order staff set, and a new category gets a page at
`/products/[slug]` listing its products. The eight lines above keep their pages and copy in the code,
linked by `pageKey`. If the database is unreachable they are shown from `src/content/categories.ts`.
The same screen manages project categories (grouping `/projects`) and factory categories (machinery on
`/about`). See DATA_MODEL.md.

Portals:

- `/admin/*` staff portal: dashboard, leads, customers, consultations, quotations, orders, projects,
  designers, content, materials, media, blog, testimonials, settings, staff, audit log.
- `/[locale]/designers/*` designer portal: register, sign in, dashboard, projects, uploads, quotation
  requests, status tracking.

## 5. Authentication and authorisation

- Two kinds of account: **staff** (admin portal) and **designer** (designer portal). Customers do not
  need accounts in the first release; they receive a reference number and email updates. Customer
  accounts can be added later if the owner wants them **(approve)**.
- Staff roles (proposed from the team structure in the profile): `owner` (Managing Director),
  `general_manager`, `sales_manager`, `production_supervisor`, `content_editor`. Permissions are
  fine-grained (`lead.read`, `quotation.approve`, ...) and roles are sets of permissions, editable by
  the owner.
- Designers: register → `pending` → approved by staff → can see only their own projects and files.
- Sessions in the database, `HttpOnly`, `Secure`, `SameSite=Lax` cookies; idle and absolute timeouts;
  sign-in rate limiting; optional TOTP for staff (required for `owner`).
- Every protected page and every server action checks the session and permission on the server.
  Middleware/proxy only redirects; it is never the security boundary.

## 6. Data flows

**Quotation request (public wizard):** client validation → server action re-validates with the same
Zod schema → rate limit + honeypot → one transaction writes customer, lead, quotation request,
attachments and an outbox event → reference number shown (e.g. `GIK-Q-2026-00042`) → outbox worker
emails the admin and customer when email is configured → n8n webhook event → lead appears in the CRM.

**Uploads:** browser asks the server for a presigned URL (type, size and count checked) → uploads
directly to the private bucket → server verifies the object (size, magic bytes) before linking it to a
record → files are served only through permission-checked, short-lived signed URLs.

**Quotation (staff):** draft built from line items (product, dimensions, material, hardware, labour,
installation) → discount → configurable VAT → total in BHD stored as integer fils → branded PDF
rendered server-side (English and Arabic) → sent → customer approval recorded → converted to an order
and a project. Revisions keep history; an approved revision is locked.

**Project tracking:** stages `inquiry → measurement → design → quotation → approval → production →
installation → completion`, each change audited with who and when.

## 7. Cross-cutting concerns

- **Audit log:** every create/update/delete on business records and every permission change.
- **Consent:** marketing consent stored per channel (email, WhatsApp) with source and timestamp;
  unsubscribe links work without sign-in (signed tokens).
- **Rate limiting:** Postgres-backed counters (no extra service) for forms, sign-in and uploads.
- **CSRF:** Server Actions use Next.js's origin checks; route handlers that change data require the
  session cookie plus an origin check, and webhooks require an HMAC signature.
- **Security headers:** strict CSP with nonces, HSTS, `frame-ancestors 'none'`, `Referrer-Policy`,
  `Permissions-Policy`.
- **Secrets:** environment variables only; `.env.example` documents each one; startup validates them
  with Zod.
- **Analytics:** Google Analytics 4 loads only after cookie consent; Search Console verification via
  environment variable.
- **Backups:** managed Postgres point-in-time recovery + a scheduled logical dump to a separate bucket;
  restore procedure tested in Phase 10.

## 8. AI and automation (Phase 8)

- **Furniture assistant (public):** answers only from the site's own published content (products,
  materials, FAQ, showroom details); never quotes prices; offers to book a consultation.
- **Lead assistant (admin):** classifies new enquiries, summarises requirements, drafts replies. Staff
  edit and send; nothing goes out automatically.
- **Content assistant (admin):** drafts blog posts, project descriptions and social captions. Drafts are
  saved unpublished and need staff approval.
- **n8n:** the app emits signed events (`lead.created`, `quotation.sent`, `consultation.booked`, ...)
  from the outbox; n8n workflows handle notifications, follow-ups, reminders and reporting. WhatsApp
  messaging only through the official WhatsApp Business Platform, only to contacts who opted in.

## 9. Decisions (approved 2026-10-25)

1. Better Auth for authentication (section 2).
2. Vercel + Neon hosting, Cloudflare R2 storage, Resend email.
3. Anthropic Claude for the optional AI features.
4. No customer accounts in the first release.
5. A `/bespoke` "More we make" page for products without their own page.
6. Staff roles as listed in section 5.
