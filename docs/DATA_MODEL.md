# Data model

Status: **Phases 4–8 implemented** in `prisma/schema.prisma`; Phase 4 in `prisma/migrations/20261025200000_init`:
identity and roles, Customer, Lead, LeadActivity, FollowUp, Consultation, ConsentRecord,
QuotationRequest, FileAsset, Notification, OutboxEvent, AuditLog, RateLimitBucket, SiteSetting.
Designer accounts
(Phase 7) and AI drafts / webhooks (Phase 8) are added by their phases' migrations.

Phase 4 differences from the design below: designer accounts aren't created yet; quotation requests
store preferred board families (`egger`, `mdf`, `aluminium`, `unsure`) because the materials library
arrives in Phase 5; one reference sequence serves all enquiries (`GIK-Q-…`, `GIK-C-…`, `GIK-M-…`).

Phase 5 (`20261026090000_admin_content`) adds Material, Testimonial, BlogPost, PortfolioProject and
PortfolioImage, and gives FileAsset a `visibility`, uploader and `credit` for website images.
Differences from the design below:

- Bilingual content uses paired `…En` / `…Ar` columns instead of `*Translation` tables: there are only
  two languages, every editor screen shows both side by side, and publish rules ("Arabic required")
  become simple CHECK constraints.
- Materials are limited to `egger_laminate`, `egger_melamine` and `painted_mdf` boards. `manufacturer`
  must be `EGGER` for EGGER boards and empty for painted MDF; a décor is public only once someone
  checked it against the current range (`verifiedAt`) and published it, and never when discontinued.
- Testimonials can't be published without a consent note and date; blog posts can't be published
  without the Arabic title and text; a portfolio client name needs `clientNamePermission`; a public
  file needs a credit, and customer uploads can never be public. All are CHECK constraints with DB tests.
- Site settings are grouped per screen (`contact`, `locations`, `banner`, `homeHero`, `seo`), each
  validated by a Zod schema in `src/lib/site-settings.ts`; invalid or missing values fall back to the
  verified defaults.

Phase 6 (`20261026120000_quotations_projects`) adds Quotation, QuotationRevision, QuotationLineItem,
Order, Project and ProjectStageChange. Differences from the design below:

- Statuses are `draft | sent | approved | rejected | converted` (no automatic `expired`; validity is
  shown on the document). Approval is by `whatsapp` or `phone` with a required note, recorded by
  staff who hold `quotation.approve`.
- Numbers come from database sequences (`GIK-QT-`, `GIK-OR-`, `GIK-PR-` + year + 5 digits).
- Quantities are stored in thousandths and VAT in basis points; line total = round half up of
  quantity x price. VAT applies to subtotal minus discount. CHECK constraints enforce the totals and that
  approval fields are complete.
- Triggers make a sent (locked) revision and its lines immutable, apart from the approval fields and the
  PDF link, and make `project_stage_changes` append-only. A sent quotation is changed only by a new
  revision.
- `PricingRule`, `ProjectMaterial` and `ProjectMessage` are not built: no rates are known, and
  project messages belong to the Phase 7 designer portal.

Phase 7 (`20261026150000_designer_portal`) adds DesignerAccount, DesignerProject,
DesignerProjectMaterial and DesignerMessage, and `FileAsset.designerProjectId`. Differences from the design above:

- A designer's sign-in is a User of kind `designer` with a `DesignerAccount` (status pending, approved,
  rejected or suspended; a decision records who and when, by CHECK). Triggers keep designer profiles on
  designer users only and stop a designer holding staff roles. Designers can sign in whatever their state;
  the portal checks the state on every request and the admin ignores designer sessions.
- A submitted project is a `QuotationRequest` plus Lead (`designer_portal`); `DesignerProject` links it to
  the designer and holds the conversation. The designer's own CRM contact is a Customer of the matching type.
  Their clients' contact details are never collected (only a free-text label).
- Messages are append-only (trigger); internal notes can only be written by staff (CHECK).
- A designer's files are linked to both the project and the request, so staff download them as before.

Phase 8 (`20261026180000_ai_automation`) adds AiDraft (kind, status, input, output, requester, reviewer) and
`LeadActivity.externalId` (unique; makes webhook retries harmless). A decision records who and when (CHECK), lead
drafts belong to a lead and blog drafts do not, an approved blog draft points at the post it created, and a trigger
makes a reviewed draft read-only. Consent stays in ConsentRecord (latest per channel wins; `source` is
`unsubscribe_link` for withdrawals).

Conventions:

- IDs are `cuid` strings. Timestamps are `timestamptz` (`createdAt`, `updatedAt`).
- Money is **integer fils** (1 BHD = 1000 fils) with `BigInt` columns; never floats.
- Translatable public content uses a `*Translation` table keyed by `(parentId, locale)` with `locale`
  in `en | ar`.
- Business rules that must never break are also database constraints (CHECK, UNIQUE, FK), and each
  has a DB test.
- Soft archive (`archivedAt`) for business records; hard delete only for drafts and test data.

## Identity and access

| Model             | Key fields                                                                                                                                                                                        | Rules                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `User`            | email (unique, lowercased), name, kind `staff \| designer`, status `active \| disabled`, twoFactorEnabled                                                                                         | Managed through Better Auth tables (`Session`, `Account`, `Verification`) |
| `Role`            | key (unique), name, description, system (bool)                                                                                                                                                    | System roles can't be deleted                                             |
| `Permission`      | key (unique), e.g. `lead.read`, `quotation.approve`                                                                                                                                               | Seeded from code                                                          |
| `RolePermission`  | roleId, permissionId                                                                                                                                                                              | PK (roleId, permissionId)                                                 |
| `UserRole`        | userId, roleId                                                                                                                                                                                    | Staff only (CHECK via trigger or service rule + test)                     |
| `DesignerAccount` | userId (unique), company, profession `interior_designer \| architect \| contractor \| developer \| other`, phone, status `pending \| approved \| rejected \| suspended`, approvedById, approvedAt | Only `approved` designers can sign in to the portal                       |

## CRM

| Model           | Key fields                                                                                                                                                                                                                                                                            | Rules                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `Customer`      | name, phone (normalised +973), email, preferredLanguage, type `homeowner \| designer \| architect \| developer \| contractor \| business`, notes                                                                                                                                      | Unique on normalised phone **or** email (partial unique indexes)   |
| `Lead`          | reference (unique), customerId, source `website_quote \| website_contact \| consultation \| designer_portal \| whatsapp \| phone \| walk_in \| referral \| instagram`, categoryId, status `new \| contacted \| qualified \| quoted \| won \| lost`, lostReason, assignedToId, summary | `lost` requires `lostReason` (CHECK)                               |
| `LeadActivity`  | leadId, kind `note \| call \| email \| whatsapp \| meeting \| status_change \| assignment`, body, internal (bool), authorId                                                                                                                                                           | Communication history; append-only                                 |
| `FollowUp`      | leadId, dueAt, assignedToId, doneAt, note                                                                                                                                                                                                                                             |                                                                    |
| `Consultation`  | reference, customerId, leadId, type `showroom \| site_visit \| online`, preferredDate, preferredSlot, confirmedAt, status `requested \| confirmed \| completed \| cancelled \| no_show`, address (site visits)                                                                        |                                                                    |
| `ConsentRecord` | customerId, channel `email \| whatsapp \| sms`, granted (bool), source, ipHash, recordedAt                                                                                                                                                                                            | Latest record per channel wins; unsubscribe writes `granted=false` |

## Quotation requests (public wizard and designer portal)

| Model                      | Key fields                                                                                                                                                                                                                                                                                                         | Rules                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `QuotationRequest`         | reference (unique, `GIK-Q-YYYY-NNNNN`), leadId, customerId, designerAccountId, categoryId, measurements (JSON, validated by Zod), unit `mm \| cm \| m`, preferredBoards (`egger_melamine \| egger_laminate \| painted_mdf`)[], styleNotes, budgetBand, message, status `received \| reviewing \| quoted \| closed` |                                                                                                                |
| `QuotationRequestMaterial` | requestId, materialId                                                                                                                                                                                                                                                                                              | Customer's preferred specific décors                                                                           |
| `FileAsset`                | storageKey (unique), originalName, mimeType, sizeBytes, sha256, kind `reference_photo \| drawing \| quotation_pdf \| project_photo \| material_image \| blog_image \| other`, visibility `private \| public`, uploadedById, verifiedAt, linked owner FKs (nullable, exactly one set)                               | Allowed types: JPG, PNG, WebP, HEIC, PDF, DWG/DXF; max size per kind; `verifiedAt` set only after server check |

## Quotations, orders, projects

| Model                | Key fields                                                                                                                                                                                                              | Rules                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `Quotation`          | number (unique, `GIK-QT-YYYY-NNNNN`), customerId, leadId, requestId, currentRevisionId, status `draft \| sent \| approved \| rejected \| expired \| converted`                                                          |                                                                                                                            |
| `QuotationRevision`  | quotationId, revision (int), subtotalFils, discountFils, vatRateBasisPoints, vatFils, totalFils, validUntil, termsMarkdown, pdfFileId, approvedAt, approvedById / approvedByCustomer (bool), lockedAt                   | UNIQUE (quotationId, revision); `discount ≤ subtotal`; `total = subtotal − discount + vat`; locked revisions are immutable |
| `QuotationLineItem`  | revisionId, sortOrder, kind `product \| material \| hardware \| labour \| installation \| other`, description, categoryId, materialId, widthMm, heightMm, depthMm, quantity (numeric 3dp), unitPriceFils, lineTotalFils | Amounts ≥ 0                                                                                                                |
| `PricingRule`        | categoryId, basis `per_linear_metre \| per_square_metre \| per_unit`, materialBoard, rateFils, activeFrom, activeTo, createdById                                                                                        | Estimates are calculated **only** from active rules; none are seeded                                                       |
| `Order`              | number (unique), quotationRevisionId (unique), customerId, totalFils, depositFils, status `confirmed \| in_production \| installed \| completed \| cancelled`                                                           | Created only from an approved revision                                                                                     |
| `Project`            | reference (unique), orderId, customerId, designerAccountId, title, siteAddress, stage `inquiry \| measurement \| design \| quotation \| approval \| production \| installation \| completion`, assignedToId, targetDate |                                                                                                                            |
| `ProjectStageChange` | projectId, fromStage, toStage, changedById, note, changedAt                                                                                                                                                             | Append-only                                                                                                                |
| `ProjectMaterial`    | projectId, materialId, application `kitchen_doors \| carcass \| worktop \| wardrobe \| cladding \| furniture \| vanity \| shelving`                                                                                     | PK (projectId, materialId, application)                                                                                    |
| `ProjectMessage`     | projectId, authorId, body, internal (bool)                                                                                                                                                                              | Designers never see `internal` messages                                                                                    |

## Catalogue and content

| Model                              | Key fields                                                                                                                                                                                                                                                                  | Rules                                                                                                                             |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `FurnitureCategory` (+Translation) | slug (unique), parentId, sortOrder, published, heroImageId; translation: name, summary, body (structured JSON), seoTitle, seoDescription                                                                                                                                    |                                                                                                                                   |
| `Material` (+Translation)          | board `egger_melamine \| egger_laminate \| painted_mdf`, manufacturer, code, texture, colourFamily, swatchHex, availability `in_stock \| to_order \| discontinued \| unverified`, applications[], verifiedAt, verifiedById, published; translation: finishName, description | `manufacturer = 'EGGER'` for EGGER boards and NULL for painted MDF (CHECK, NULL-safe); UNIQUE (board, code); published ⇒ verified |
| `MaterialImage`                    | materialId, fileId, kind `swatch \| close_up \| application`, credit, licenceNote                                                                                                                                                                                           | Credit and licence required                                                                                                       |
| `PortfolioProject` (+Translation)  | slug (unique), projectId (optional), location, clientName, clientNamePermission (bool), segment `residential \| villa \| commercial`, status `draft \| published`, completedYear                                                                                            | Published ⇒ client permission if `clientName` shown (CHECK)                                                                       |
| `PortfolioImage`                   | portfolioProjectId, fileId, alt (en/ar), sortOrder, credit, usagePermission (bool)                                                                                                                                                                                          | Published projects only show permitted images                                                                                     |
| `BlogPost` (+Translation)          | slug (unique), status `draft \| scheduled \| published`, publishedAt, coverImageId, authorId, aiDraftId                                                                                                                                                                     |                                                                                                                                   |
| `Testimonial`                      | customerName, displayName, text (en/ar), source, consentFileId, consentRecordedAt, status `draft \| published`                                                                                                                                                              | Published ⇒ consent recorded (CHECK). None seeded                                                                                 |
| `Faq` (+Translation)               | topic, sortOrder, published                                                                                                                                                                                                                                                 |                                                                                                                                   |
| `ContentBlock` (+Translation)      | key (unique, e.g. `home.hero`), data (JSON validated by a Zod schema per key), updatedById                                                                                                                                                                                  | Banners, homepage text, CTA text; editable in the admin                                                                           |
| `SiteSetting`                      | key (unique), value (JSON), updatedById                                                                                                                                                                                                                                     | Contact details, hours, social links, VAT rate, SEO defaults, feature flags                                                       |

## Platform

| Model             | Key fields                                                                                                                                                                      | Rules                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `Notification`    | userId, kind, title, body, link, readAt                                                                                                                                         | In-app staff notifications                                                         |
| `OutboxEvent`     | type, payload (JSON), status `pending \| processing \| sent \| failed`, attempts, nextAttemptAt, lastError                                                                      | Written in the same transaction as the business change; delivered to email and n8n |
| `AuditLog`        | actorId, action, entityType, entityId, changes (JSON), ipHash, createdAt                                                                                                        | Append-only (DB trigger blocks UPDATE/DELETE)                                      |
| `RateLimitBucket` | key, windowStart, count                                                                                                                                                         | PK (key, windowStart)                                                              |
| `AiDraft`         | kind `lead_summary \| reply \| blog \| project_description \| caption`, sourceType, sourceId, model, prompt hash, output, status `draft \| approved \| discarded`, reviewedById | AI output is never published or sent without `approved`                            |
| `WebhookEndpoint` | name, url, secret (encrypted), events[], active                                                                                                                                 | n8n targets                                                                        |

## Seed data (Phases 4–5)

Seeded (idempotent, never overwriting staff edits): permissions, system roles (new permissions are
granted to existing roles only when introduced; the owner always has all), site settings from
[BUSINESS_FACTS.md](BUSINESS_FACTS.md) (contact, hours, addresses), and the 21 portfolio projects
from the company profile (created if missing). Page copy stays in `src/content` and `src/messages`.
Not seeded: testimonials, blog posts, prices, pricing rules, photos, material décors (staff add and
verify them).
