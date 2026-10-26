# Missing business details

Information the website needs that is **not** in the company profile or the owner's instructions.
Until answered, the site leaves the item out (or shows it only inside the admin as "to confirm").
★ = blocks a phase.

## Brand and imagery

1. ★ **Logo** files (vector: SVG, AI or PDF) in English and Arabic, and brand colours if any exist.
2. ✔ **Photographs:** the owner confirmed (2026-10-26) that the photos in the company profile are the
   company's own work and may be published. **Still open:** higher-resolution originals. The profile's
   images are small (500–1130 px wide), so they are shown at card size; larger originals would allow a
   full-width hero and sharper project pages.
3. Who took the project photos? Any credit required?

## Company

4. ★ **Arabic company name** as registered.
5. Commercial Registration (CR) number, for the footer and legal pages (optional but common in Bahrain).
6. Year founded (the profile says "over 11 years").
7. Showroom **days** of opening (hours are 9:00 AM – 8:00 PM: every day? Friday?). Factory visiting hours, if visits are allowed.
8. Which phone number is for sales, and which has **WhatsApp**? Which number should the WhatsApp button use?
9. Google Maps links (or exact pins) for the showroom and the head office/factory.
10. Head office: is it also the factory? (The brief says the factory is in Hamad Town; the profile lists the head office there.)
11. Languages the team speaks with customers (English, Arabic, others?).

## Products and materials

12. ★ **Wall cladding material** (profile says "timber"; the materials rule says EGGER boards and painted MDF only).
13. Wording for "all wood interior work" in the project list (suggested: "complete joinery").
14. Which **appliances and accessories** the company supplies (brands, if any) — or should the website leave them out?
15. Ceiling umbrellas (powder-coated): keep them on the website?
16. Murphy beds, laundry rooms, laminate doors: confirm they should appear.
17. Painted MDF: sheens offered (matt, satin, gloss) and colour system (RAL, NCS, other).
18. Which EGGER décors are kept in stock or shown in the showroom (codes and names), for the materials gallery.
19. Aluminium kitchens: profile systems, glass types and colours offered.
20. Worktop materials offered (if any).
21. Hardware brands used (hinges, runners), if they may be named.
22. Warranty terms, if any.
23. Typical lead times (only if the owner wants them published).

## Projects

24. ★ Permission to **name each client/developer** on project pages (the profile names 11 Pearls,
    Kooheji Contracting, Dadabai, Black Sand Contracting, Nexum, Al Rashdan Contracting, Kadi
    Construction, Almoayyed Contracting).
25. Which projects to feature first, with photos for each.
26. Completion years for each project.

## Sales process

27. ★ **VAT:** is the company VAT-registered in Bahrain? VAT number and rate to show on quotations.
28. ★ Quotation **terms and conditions**, validity period, payment terms (deposit %).
29. Quotation and project numbering format, if the company already has one.
30. Consultation types offered (showroom, site measurement, online?), and whether site visits are free.
31. Areas served (all of Bahrain? GCC?). The profile mentions markets "abroad".
32. Who receives new-lead notifications (names, emails), and who handles designers.

## Designers and trade

33. Benefits offered to interior designers and architects (trade terms, sample access, dedicated contact) — only what the company actually offers.

## Legal and accounts

34. ★ Privacy policy and terms: drafts are live at `/privacy-policy` and `/terms`, describing only what the site does today (no forms, cookies or analytics; Bahrain PDPL rights). They need review by the company's legal adviser, and an update when forms (Phase 4) and analytics (Phase 9) arrive.
35. Domain name, and accounts for hosting, email, storage, analytics, Search Console, n8n, WhatsApp Business.

## Testimonials

36. Real customer reviews with written consent (or a Google Business Profile to link to). None will be written for the site. Staff can now add them in Admin → Testimonials; the homepage section appears with the first published one.

## Added in Phase 3

37. Arabic spelling of **Baquwa** (project location, shown in Latin script on Arabic pages until confirmed), and of the garden communities (Fahad Garden, Palace Garden, Bahama, Mesheal, Venus Garden).
38. Location of the **Marassi Bay** flats (shown as "Bahrain").
39. Whether the **Arabic translations** of building names (Al Faris Suite 2, Vicuna, Capri Suites, Burj Kadi) should be transliterated as written on the site, or kept in Latin script.
40. **Blog:** who will write articles. The blog stays unpublished (not linked, 404) until the first article is published in Admin → Blog (English and Arabic required).

## Added in Phase 4

41. ★ **Notification emails:** which staff addresses should receive new enquiries (`NOTIFY_EMAILS`), and the sending address/domain for customer confirmations (`EMAIL_FROM`).
42. **Staff accounts:** names, emails and roles for the first staff (owner, general manager, sales & project manager, production supervisor, content editor).
43. Retention period for enquiries that never become projects (the privacy policy currently says "as long as needed and as required by law").

## Added in Phase 5

44. **EGGER décors and painted MDF colours** to list in the materials library (codes the company stocks or orders regularly). Each must be checked against EGGER's current collection before it is published; none are entered by us.
45. **Website photographs:** which project photos may be shown (client and photographer permission), and who owns each, for the credit line. **Answered in part (2026-10-26):** the owner confirmed the profile photos may be shown; the profile gives no photographer or credit line, so none is shown. Projects without a photo stay text-only and out of search results. Photos of other projects, and any credit line, are still needed.
46. **Opening hours wording:** the consultation form hint still says "9:00 AM – 8:00 PM" in its fixed text; if hours change in Admin → Settings, that hint needs a code change (or confirm hours won't change).
47. Fluent Arabic review of the new public text (blog page, testimonials heading, décor library labels in `src/content/cms.ts`).

## Added in Phase 6

48. **VAT:** is Global Island Kitchens VAT-registered in Bahrain? If so, the VAT number and rate, then turn it on in Admin → Settings → Quotations. VAT is off until then and quotations carry no VAT line.
49. **Quotation terms and conditions** (English and Arabic): payment, deposit, delivery and installation timing, warranty. Admin → Settings → Quotations is empty until the owner provides the wording; none was invented.
50. **Quotation validity:** how many days a quotation stays valid by default (the setting exists; the owner confirms the number).
51. **Pricing:** rates per linear metre, square metre or unit if staff want automatic estimates. Until then every price is entered by hand.
52. **PDF hosting:** where production runs decides how PDFs are printed (a server with Chrome, or a remote Chrome via `BROWSER_WS_ENDPOINT`). Decided in Phase 10 with the hosting choice.
53. **Quotation layout and wording** in Arabic and English (`src/content/quotation.ts`) need a fluent Arabic review and the owner's letterhead details (logo file, stamp or signature policy).

## Added in Phase 9

54. **Bot protection on public forms:** the forms rely on a honeypot, timing, an IP limit and a limit of 3 confirmation emails a day per address. A CAPTCHA (e.g. Cloudflare Turnstile) needs an account and a decision on privacy wording; add it if spam appears after launch.
55. **Analytics:** none is installed. Choose a tool (and whether a cookie banner is needed) before launch; nothing loads without consent.
56. **Customer consent records** are recorded as claimed on the form, not verified. Marketing messages need a confirmation step (double opt-in) when Phase 8 is built.
57. **Mobile speed:** home pages score 81-86 on mobile Lighthouse. Reaching 90 needs a lighter page structure or a faster host/CDN; measure again on the production domain.

## Added in Phase 7

58. **Who approves designers** and what check counts (a call, a trade licence, a business card). The portal only opens after staff approve; the criteria are the owner's.
59. **Designer terms:** whether designers get trade pricing, a commission or any special terms. None are shown or promised; prices stay out of the portal.
60. **Designer emails:** approval, a staff reply and project updates reach designers only inside the portal until an email account is set up (OPEN_QUESTIONS 41).
61. **Arabic review** of the designer portal wording in `src/content/portal.ts`.
62. **Data requests:** how a designer's account and files are deleted on request (nothing deletes them automatically yet).

## Added in Phase 8

63. **AI provider approval:** may customer enquiry text (without phone and email) and visitor questions be sent to Anthropic? The assistants stay off until the owner says yes. The privacy policy (`src/content/legal.ts`) must then say so; its wording is the owner's.
64. **Anthropic account and budget:** who creates the account, which model, and a monthly spending limit set in the provider's console.
65. **Public furniture assistant:** switch it on at launch or later? It is a visitor-facing AI answer; it can't quote prices or dates, but the owner should read some of its answers first.
66. **Automation accounts:** n8n hosting, the email sending account and the WhatsApp Business account and templates. Until they exist, no workflow sends anything.
67. **Marketing consent wording:** the tick-boxes on the forms say email and WhatsApp may be used to contact the customer; confirm they cover marketing, or keep automation to replies only.
68. **Arabic review** of `src/content/assistant.ts` (unsubscribe page and furniture assistant).
