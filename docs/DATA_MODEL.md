# Data model

Status: **Phase 1 design.** It becomes `prisma/schema.prisma` and the first migrations in Phase 4.

Conventions:

- IDs are `cuid` strings. Timestamps are `timestamptz` (`createdAt`, `updatedAt`).
- Money is **integer fils** (1 BHD = 1000 fils) with `BigInt` columns; never floats.
- Translatable public content uses a `*Translation` table keyed by `(parentId, locale)` with `locale`
  in `en | ar`.
- Business rules that must never break are also database constraints (CHECK, UNIQUE, FK), and each
  has a DB test.
- Soft archive (`archivedAt`) for business records; hard delete only for drafts and test data.

## Identity and access

| Model | Key fields | Rules |
|---|---|---|
| `User` | email (unique, lowercased), name, kind `staff \| designer`, status `active \| disabled`, twoFactorEnabled | Managed through Better Auth tables (`Session`, `Account`, `Verification`) |
| `Role` | key (unique), name, description, system (bool) | System roles can't be deleted |
| `Permission` | key (unique), e.g. `lead.read`, `quotation.approve` | Seeded from code |
| `RolePermission` | roleId, permissionId | PK (roleId, permissionId) |
| `UserRole` | userId, roleId | Staff only (CHECK via trigger or service rule + test) |
| `DesignerAccount` | userId (unique), company, profession `interior_designer \| architect \| contractor \| developer \| other`, phone, status `pending \| approved \| rejected \| suspended`, approvedById, approvedAt | Only `approved` designers can sign in to the portal |

## CRM

| Model | Key fields | Rules |
|---|---|---|
| `Customer` | name, phone (normalised +973), email, preferredLanguage, type `homeowner \| designer \| architect \| developer \| contractor \| business`, notes | Unique on normalised phone **or** email (partial unique indexes) |
| `Lead` | reference (unique), customerId, source `website_quote \| website_contact \| consultation \| designer_portal \| whatsapp \| phone \| walk_in \| referral \| instagram`, categoryId, status `new \| contacted \| qualified \| quoted \| won \| lost`, lostReason, assignedToId, summary | `lost` requires `lostReason` (CHECK) |
| `LeadActivity` | leadId, kind `note \| call \| email \| whatsapp \| meeting \| status_change \| assignment`, body, internal (bool), authorId | Communication history; append-only |
| `FollowUp` | leadId, dueAt, assignedToId, doneAt, note | |
| `Consultation` | reference, customerId, leadId, type `showroom \| site_visit \| online`, preferredDate, preferredSlot, confirmedAt, status `requested \| confirmed \| completed \| cancelled \| no_show`, address (site visits) | |
| `ConsentRecord` | customerId, channel `email \| whatsapp \| sms`, granted (bool), source, ipHash, recordedAt | Latest record per channel wins; unsubscribe writes `granted=false` |

## Quotation requests (public wizard and designer portal)

| Model | Key fields | Rules |
|---|---|---|
| `QuotationRequest` | reference (unique, `GIK-Q-YYYY-NNNNN`), leadId, customerId, designerAccountId, categoryId, measurements (JSON, validated by Zod), unit `mm \| cm \| m`, preferredBoards (`egger_melamine \| egger_laminate \| painted_mdf`)[], styleNotes, budgetBand, message, status `received \| reviewing \| quoted \| closed` | |
| `QuotationRequestMaterial` | requestId, materialId | Customer's preferred specific décors |
| `FileAsset` | storageKey (unique), originalName, mimeType, sizeBytes, sha256, kind `reference_photo \| drawing \| quotation_pdf \| project_photo \| material_image \| blog_image \| other`, visibility `private \| public`, uploadedById, verifiedAt, linked owner FKs (nullable, exactly one set) | Allowed types: JPG, PNG, WebP, HEIC, PDF, DWG/DXF; max size per kind; `verifiedAt` set only after server check |

## Quotations, orders, projects

| Model | Key fields | Rules |
|---|---|---|
| `Quotation` | number (unique, `GIK-QT-YYYY-NNNNN`), customerId, leadId, requestId, currentRevisionId, status `draft \| sent \| approved \| rejected \| expired \| converted` | |
| `QuotationRevision` | quotationId, revision (int), subtotalFils, discountFils, vatRateBasisPoints, vatFils, totalFils, validUntil, termsMarkdown, pdfFileId, approvedAt, approvedById / approvedByCustomer (bool), lockedAt | UNIQUE (quotationId, revision); `discount ≤ subtotal`; `total = subtotal − discount + vat`; locked revisions are immutable |
| `QuotationLineItem` | revisionId, sortOrder, kind `product \| material \| hardware \| labour \| installation \| other`, description, categoryId, materialId, widthMm, heightMm, depthMm, quantity (numeric 3dp), unitPriceFils, lineTotalFils | Amounts ≥ 0 |
| `PricingRule` | categoryId, basis `per_linear_metre \| per_square_metre \| per_unit`, materialBoard, rateFils, activeFrom, activeTo, createdById | Estimates are calculated **only** from active rules; none are seeded |
| `Order` | number (unique), quotationRevisionId (unique), customerId, totalFils, depositFils, status `confirmed \| in_production \| installed \| completed \| cancelled` | Created only from an approved revision |
| `Project` | reference (unique), orderId, customerId, designerAccountId, title, siteAddress, stage `inquiry \| measurement \| design \| quotation \| approval \| production \| installation \| completion`, assignedToId, targetDate | |
| `ProjectStageChange` | projectId, fromStage, toStage, changedById, note, changedAt | Append-only |
| `ProjectMaterial` | projectId, materialId, application `kitchen_doors \| carcass \| worktop \| wardrobe \| cladding \| furniture \| vanity \| shelving` | PK (projectId, materialId, application) |
| `ProjectMessage` | projectId, authorId, body, internal (bool) | Designers never see `internal` messages |

## Catalogue and content

| Model | Key fields | Rules |
|---|---|---|
| `FurnitureCategory` (+Translation) | slug (unique), parentId, sortOrder, published, heroImageId; translation: name, summary, body (structured JSON), seoTitle, seoDescription | |
| `Material` (+Translation) | board `egger_melamine \| egger_laminate \| painted_mdf`, manufacturer, code, texture, colourFamily, swatchHex, availability `in_stock \| to_order \| discontinued \| unverified`, applications[], verifiedAt, verifiedById, published; translation: finishName, description | `manufacturer = 'EGGER'` for EGGER boards and NULL for painted MDF (CHECK, NULL-safe); UNIQUE (board, code); published ⇒ verified |
| `MaterialImage` | materialId, fileId, kind `swatch \| close_up \| application`, credit, licenceNote | Credit and licence required |
| `PortfolioProject` (+Translation) | slug (unique), projectId (optional), location, clientName, clientNamePermission (bool), segment `residential \| villa \| commercial`, status `draft \| published`, completedYear | Published ⇒ client permission if `clientName` shown (CHECK) |
| `PortfolioImage` | portfolioProjectId, fileId, alt (en/ar), sortOrder, credit, usagePermission (bool) | Published projects only show permitted images |
| `BlogPost` (+Translation) | slug (unique), status `draft \| scheduled \| published`, publishedAt, coverImageId, authorId, aiDraftId | |
| `Testimonial` | customerName, displayName, text (en/ar), source, consentFileId, consentRecordedAt, status `draft \| published` | Published ⇒ consent recorded (CHECK). None seeded |
| `Faq` (+Translation) | topic, sortOrder, published | |
| `ContentBlock` (+Translation) | key (unique, e.g. `home.hero`), data (JSON validated by a Zod schema per key), updatedById | Banners, homepage text, CTA text; editable in the admin |
| `SiteSetting` | key (unique), value (JSON), updatedById | Contact details, hours, social links, VAT rate, SEO defaults, feature flags |

## Platform

| Model | Key fields | Rules |
|---|---|---|
| `Notification` | userId, kind, title, body, link, readAt | In-app staff notifications |
| `OutboxEvent` | type, payload (JSON), status `pending \| processing \| sent \| failed`, attempts, nextAttemptAt, lastError | Written in the same transaction as the business change; delivered to email and n8n |
| `AuditLog` | actorId, action, entityType, entityId, changes (JSON), ipHash, createdAt | Append-only (DB trigger blocks UPDATE/DELETE) |
| `RateLimitBucket` | key, windowStart, count | PK (key, windowStart) |
| `AiDraft` | kind `lead_summary \| reply \| blog \| project_description \| caption`, sourceType, sourceId, model, prompt hash, output, status `draft \| approved \| discarded`, reviewedById | AI output is never published or sent without `approved` |
| `WebhookEndpoint` | name, url, secret (encrypted), events[], active | n8n targets |

## Seed data (Phase 4)

Seeded: permissions, system roles, furniture categories and page content written **only from
[BUSINESS_FACTS.md](BUSINESS_FACTS.md)**, site settings (contact, hours, addresses), FAQs that state
only known facts. Not seeded: testimonials, prices, pricing rules, project photos, material décors
(staff add and verify them).
